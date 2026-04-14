export type GameStatus = "active" | "finished";

export interface GameRecord {
  id: string;
  postId: string;
  status: GameStatus;
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
  postId: string;
  status: GameStatus;
  currentKing: string | null;
  winner: string | null;
  lastClaimAt: number | null;
  startedAt: number;
  finishedAt: number | null;
  timeLeftSeconds: number;
  participants: ParticipantStat[];
  events: GameEvent[];
}
