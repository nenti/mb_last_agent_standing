import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { GameEvent, GameRecord, ParticipantStat } from "./types.js";

export class Storage {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_king TEXT,
        last_claim_at INTEGER,
        winner TEXT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        game_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        total_claims INTEGER NOT NULL DEFAULT 0,
        valid_claims INTEGER NOT NULL DEFAULT 0,
        last_claim_at INTEGER,
        PRIMARY KEY (game_id, agent_name)
      );

      CREATE TABLE IF NOT EXISTS game_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        agent_name TEXT,
        message TEXT NOT NULL
      );
    `);
  }

  createGame(postId: string, now: number): GameRecord {
    const game: GameRecord = {
      id: randomUUID(),
      postId,
      status: "active",
      currentKing: null,
      lastClaimAt: null,
      winner: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const stmt = this.db.prepare(`
      INSERT INTO games (
        id, post_id, status, current_king, last_claim_at, winner,
        started_at, finished_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      game.id,
      game.postId,
      game.status,
      game.currentKing,
      game.lastClaimAt,
      game.winner,
      game.startedAt,
      game.finishedAt,
      game.createdAt,
      game.updatedAt,
    );
    return game;
  }

  getGame(gameId: string): GameRecord | null {
    const stmt = this.db.prepare(`
      SELECT
        id,
        post_id as postId,
        status,
        current_king as currentKing,
        last_claim_at as lastClaimAt,
        winner,
        started_at as startedAt,
        finished_at as finishedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM games
      WHERE id = ?
    `);
    return (stmt.get(gameId) as GameRecord | undefined) ?? null;
  }

  listGames(limit = 30): GameRecord[] {
    const stmt = this.db.prepare(`
      SELECT
        id,
        post_id as postId,
        status,
        current_king as currentKing,
        last_claim_at as lastClaimAt,
        winner,
        started_at as startedAt,
        finished_at as finishedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM games
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as GameRecord[];
  }

  listActiveGames(): GameRecord[] {
    const stmt = this.db.prepare(`
      SELECT
        id,
        post_id as postId,
        status,
        current_king as currentKing,
        last_claim_at as lastClaimAt,
        winner,
        started_at as startedAt,
        finished_at as finishedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM games
      WHERE status = 'active'
      ORDER BY created_at ASC
    `);
    return stmt.all() as GameRecord[];
  }

  updateClaim(gameId: string, king: string, claimAt: number, now: number): void {
    this.db
      .prepare(
        `
      UPDATE games
      SET current_king = ?, last_claim_at = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(king, claimAt, now, gameId);
  }

  finishGame(gameId: string, winner: string, finishedAt: number): void {
    this.db
      .prepare(
        `
      UPDATE games
      SET status = 'finished', winner = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(winner, finishedAt, finishedAt, gameId);
  }

  upsertParticipant(
    gameId: string,
    agentName: string,
    claimAt: number,
    isValid: boolean,
  ): void {
    const existing = this.db
      .prepare(
        "SELECT total_claims, valid_claims FROM participants WHERE game_id = ? AND agent_name = ?",
      )
      .get(gameId, agentName) as
      | { total_claims: number; valid_claims: number }
      | undefined;

    if (!existing) {
      this.db
        .prepare(
          `
        INSERT INTO participants (game_id, agent_name, total_claims, valid_claims, last_claim_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        )
        .run(gameId, agentName, 1, isValid ? 1 : 0, claimAt);
      return;
    }

    this.db
      .prepare(
        `
      UPDATE participants
      SET total_claims = ?, valid_claims = ?, last_claim_at = ?
      WHERE game_id = ? AND agent_name = ?
    `,
      )
      .run(
        existing.total_claims + 1,
        existing.valid_claims + (isValid ? 1 : 0),
        claimAt,
        gameId,
        agentName,
      );
  }

  listParticipants(gameId: string): ParticipantStat[] {
    return this.db
      .prepare(
        `
      SELECT
        agent_name as agentName,
        total_claims as totalClaims,
        valid_claims as validClaims,
        last_claim_at as lastClaimAt
      FROM participants
      WHERE game_id = ?
      ORDER BY valid_claims DESC, total_claims DESC, agent_name ASC
    `,
      )
      .all(gameId) as ParticipantStat[];
  }

  addEvent(
    gameId: string,
    type: GameEvent["type"],
    timestamp: number,
    message: string,
    agentName: string | null = null,
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO game_events (game_id, type, timestamp, agent_name, message)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(gameId, type, timestamp, agentName, message);
  }

  listEvents(gameId: string, limit = 80): GameEvent[] {
    return this.db
      .prepare(
        `
      SELECT id, game_id as gameId, type, timestamp, agent_name as agentName, message
      FROM game_events
      WHERE game_id = ?
      ORDER BY id DESC
      LIMIT ?
    `,
      )
      .all(gameId, limit) as GameEvent[];
  }
}
