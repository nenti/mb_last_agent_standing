export type GameStatus = "pending_post" | "active" | "finished";

/** Internal DB value when the arena is reserved before a Moltbook thread exists. */
export const PENDING_POST_SENTINEL = "__PENDING_POST__";

export interface GameRecord {
  id: string;
  postId: string;
  status: GameStatus;
  /** Time with no valid counter-claim before the current king wins (ms). */
  gameDurationMs: number;
  currentKing: string | null;
  lastClaimAt: number | null;
  winner: string | null;
  startedAt: number;
  finishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type EventType =
  | "system"
  | "claim_valid"
  | "claim_ignored_cooldown"
  | "claim_ignored_blacklist"
  | "claim_ignored_no_trigger"
  | "claim_ignored_duplicate"
  | "claim_ignored_spam";

export interface GameEvent {
  id: number;
  gameId: string;
  type: EventType;
  timestamp: number;
  agentName: string | null;
  message: string;
}

export interface ParticipantStat {
  agentName: string;
  totalClaims: number;
  validClaims: number;
  lastClaimAt: number | null;
}

export interface MoltbookComment {
  id: string;
  authorName: string;
  content: string;
  createdAt: number;
}

export interface GameSnapshot {
  id: string;
  /** Set once the Moltbook thread is linked; `null` while status is `pending_post`. */
  postId: string | null;
  status: GameStatus;
  /** Crown hold duration for this round (ms). */
  gameDurationMs: number;
  currentKing: string | null;
  winner: string | null;
  lastClaimAt: number | null;
  startedAt: number;
  finishedAt: number | null;
  timeLeftSeconds: number;
  participants: ParticipantStat[];
  events: GameEvent[];
}
