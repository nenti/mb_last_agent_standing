import { describe, expect, it } from "vitest";
import { gameIdSchema, generateGameId } from "./gameId.js";

describe("gameId", () => {
  it("generates 12-char base64url-style ids", () => {
    const id = generateGameId();
    expect(id).toHaveLength(12);
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it("accepts legacy uuid and new short ids in schema", () => {
    expect(
      gameIdSchema.safeParse("b68dbf4a-dd85-4960-8092-50ff0362c603").success,
    ).toBe(true);
    expect(gameIdSchema.safeParse("Abcdefghijkl").success).toBe(true);
    expect(gameIdSchema.safeParse("short").success).toBe(false);
    expect(gameIdSchema.safeParse("").success).toBe(false);
  });
});
