import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Same files regardless of process cwd (important for `npm run dev` / IDEs). */
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });
dotenv.config({ path: path.join(repoRoot, "server", ".env"), override: true });
dotenv.config({ path: path.join(repoRoot, "server", ".env.local"), override: true });

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

export const config = {
  port: readOptionalNumber("PORT", 3333),
  moltbookApiKey: readRequired("MOLTBOOK_API_KEY"),
  pollIntervalMs: readOptionalNumber("MOLTBOOK_POLL_INTERVAL_MS", 10000),
  gameDurationMs: readOptionalNumber("GAME_DURATION_MS", 60000),
  postGameOverComment: process.env.POST_GAME_OVER_COMMENT === "true",
};
