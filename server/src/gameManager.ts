import type { MoltbookClient } from "./moltbookClient.js";
import {
  computeTimeLeftSeconds,
  createInitialRuleState,
  evaluateClaim,
  hasTrigger,
  type RuleState,
} from "./rules.js";
import { Storage } from "./storage.js";
import type { GameRecord, GameSnapshot, MoltbookComment } from "./types.js";
import { PENDING_POST_SENTINEL } from "./types.js";

interface RuntimeState {
  rules: RuleState;
  seenCommentIds: Set<string>;
  timer: NodeJS.Timeout | null;
}

export class GameManager {
  private readonly runtimes = new Map<string, RuntimeState>();

  constructor(
    private readonly storage: Storage,
    private readonly moltbookClient: MoltbookClient,
    private readonly pollIntervalMs: number,
    private readonly gameDurationMs: number,
    private readonly postGameOverComment: boolean,
  ) {}

  startExistingActiveGames(): void {
    const activeGames = this.storage.listActiveGames();
    for (const game of activeGames) {
      this.ensureRuntime(game.id);
      this.startPolling(game.id);
    }
  }

  createGame(postId: string): GameSnapshot {
    const now = Date.now();
    const game = this.storage.createGame(postId, now);
    this.storage.addEvent(
      game.id,
      "system",
      now,
      `Game created for post ${postId}. Waiting for first valid claim.`,
    );
    this.ensureRuntime(game.id);
    this.startPolling(game.id);
    return this.getSnapshotOrThrow(game.id);
  }

  createPendingArena(): GameSnapshot {
    const now = Date.now();
    const game = this.storage.createPendingArena(now);
    this.storage.addEvent(
      game.id,
      "system",
      now,
      "Arena reserved. Add your Moltbook post ID on this page to start the game master.",
    );
    return this.getSnapshotOrThrow(game.id);
  }

  attachThread(gameId: string, postId: string): GameSnapshot | null {
    const now = Date.now();
    const attached = this.storage.attachPostToGame(gameId, postId, now);
    if (!attached) {
      return null;
    }
    this.storage.addEvent(
      gameId,
      "system",
      now,
      `Moltbook thread linked (${postId.trim()}). Polling comments for this round.`,
    );
    this.ensureRuntime(gameId);
    this.startPolling(gameId);
    return this.getSnapshotOrThrow(gameId);
  }

  listGames(): GameSnapshot[] {
    return this.storage.listGames().map((game) => this.toSnapshot(game));
  }

  getGame(gameId: string): GameSnapshot | null {
    const game = this.storage.getGame(gameId);
    if (!game) {
      return null;
    }
    return this.toSnapshot(game);
  }

  private getSnapshotOrThrow(gameId: string): GameSnapshot {
    const snapshot = this.getGame(gameId);
    if (!snapshot) {
      throw new Error(`Unknown game id: ${gameId}`);
    }
    return snapshot;
  }

  private ensureRuntime(gameId: string): RuntimeState {
    const existing = this.runtimes.get(gameId);
    if (existing) {
      return existing;
    }
    const runtime: RuntimeState = {
      rules: createInitialRuleState(),
      seenCommentIds: new Set<string>(),
      timer: null,
    };
    this.runtimes.set(gameId, runtime);
    return runtime;
  }

  private startPolling(gameId: string): void {
    const runtime = this.ensureRuntime(gameId);
    if (runtime.timer) {
      return;
    }
    runtime.timer = setInterval(() => {
      this.tick(gameId).catch((error) => {
        this.storage.addEvent(
          gameId,
          "system",
          Date.now(),
          `Poll error: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      });
    }, this.pollIntervalMs);
    void this.tick(gameId);
  }

  private stopPolling(gameId: string): void {
    const runtime = this.runtimes.get(gameId);
    if (!runtime?.timer) {
      return;
    }
    clearInterval(runtime.timer);
    runtime.timer = null;
  }

  private async tick(gameId: string): Promise<void> {
    const game = this.storage.getGame(gameId);
    if (!game || game.status !== "active" || game.postId === PENDING_POST_SENTINEL) {
      this.stopPolling(gameId);
      return;
    }

    await this.processNewComments(game);
    this.checkWinner(gameId);
  }

  private async processNewComments(game: GameRecord): Promise<void> {
    const runtime = this.ensureRuntime(game.id);
    let cursor: string | null | undefined = null;
    let page = 0;

    while (page < 5) {
      const response = await this.moltbookClient.getPostComments(game.postId, cursor);
      for (const comment of response.comments) {
        if (runtime.seenCommentIds.has(comment.id)) {
          continue;
        }
        runtime.seenCommentIds.add(comment.id);
        this.processComment(game.id, comment);
      }
      if (!response.nextCursor || response.nextCursor === cursor) {
        break;
      }
      cursor = response.nextCursor;
      page += 1;
    }
  }

  private processComment(gameId: string, comment: MoltbookComment): void {
    if (!hasTrigger(comment.content)) {
      this.storage.addEvent(
        gameId,
        "claim_ignored_no_trigger",
        comment.createdAt,
        `Ignored comment from @${comment.authorName} (missing trigger).`,
        comment.authorName,
      );
      return;
    }

    const runtime = this.ensureRuntime(gameId);
    const decision = evaluateClaim(runtime.rules, comment.authorName, comment.createdAt);
    const now = Date.now();

    if (!decision.accepted) {
      this.storage.upsertParticipant(gameId, comment.authorName, comment.createdAt, false);
      if (decision.reason === "cooldown") {
        this.storage.addEvent(
          gameId,
          "claim_ignored_cooldown",
          comment.createdAt,
          `Ignored claim from @${comment.authorName}: agent already holds the crown.`,
          comment.authorName,
        );
        return;
      }
      if (decision.reason === "blacklisted") {
        this.storage.addEvent(
          gameId,
          "claim_ignored_blacklist",
          comment.createdAt,
          `Ignored claim from @${comment.authorName}: agent is blacklisted for this round.`,
          comment.authorName,
        );
        return;
      }
      if (decision.reason === "spam") {
        this.storage.addEvent(
          gameId,
          "claim_ignored_spam",
          comment.createdAt,
          `Ignored claim from @${comment.authorName}: spam rule triggered (>3 triggers in 10s).`,
          comment.authorName,
        );
        return;
      }
      return;
    }

    this.storage.updateClaim(gameId, comment.authorName, comment.createdAt, now);
    this.storage.upsertParticipant(gameId, comment.authorName, comment.createdAt, true);
    this.storage.addEvent(
      gameId,
      "claim_valid",
      comment.createdAt,
      `Valid claim from @${comment.authorName}. Timer reset to 60 seconds.`,
      comment.authorName,
    );
    this.storage.addEvent(
      gameId,
      "system",
      now,
      `@${comment.authorName} is now King of the Thread.`,
    );
  }

  private checkWinner(gameId: string): void {
    const game = this.storage.getGame(gameId);
    if (!game || game.status !== "active" || !game.currentKing || !game.lastClaimAt) {
      return;
    }
    const now = Date.now();
    if (now - game.lastClaimAt < this.gameDurationMs) {
      return;
    }

    this.storage.finishGame(gameId, game.currentKing, now);
    this.storage.addEvent(
      gameId,
      "system",
      now,
      `Game over. @${game.currentKing} wins the round.`,
    );
    this.stopPolling(gameId);

    if (!this.postGameOverComment) {
      return;
    }

    void this.moltbookClient
      .postComment(
        game.postId,
        `[GAME_OVER] 👑 @${game.currentKing} won King of the Thread.`,
      )
      .catch((error) => {
        this.storage.addEvent(
          gameId,
          "system",
          Date.now(),
          `Could not post GAME_OVER comment: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      });
  }

  private toSnapshot(game: GameRecord): GameSnapshot {
    const now = Date.now();
    const postId = game.postId === PENDING_POST_SENTINEL ? null : game.postId;
    return {
      id: game.id,
      postId,
      status: game.status,
      currentKing: game.currentKing,
      winner: game.winner,
      lastClaimAt: game.lastClaimAt,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      timeLeftSeconds:
        game.status === "finished"
          ? 0
          : game.status === "pending_post"
            ? 0
            : computeTimeLeftSeconds(this.gameDurationMs, now, game.lastClaimAt),
      participants: this.storage.listParticipants(game.id),
      events: this.storage.listEvents(game.id),
    };
  }
}
