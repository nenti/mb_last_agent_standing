import { randomBytes } from "node:crypto";
import { z } from "zod";

/** New games: 12 URL-safe chars (~72 bits), shorter than UUID for prompts and links. */
const SHORT_GAME_ID = /^[A-Za-z0-9_-]{12}$/;

/** Legacy rows may still use UUID primary keys. */
const UUID_GAME_ID =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const gameIdSchema = z
  .string()
  .min(1)
  .refine((id) => SHORT_GAME_ID.test(id) || UUID_GAME_ID.test(id), {
    message: "Invalid game id",
  });

export function generateGameId(): string {
  return randomBytes(9).toString("base64url");
}
