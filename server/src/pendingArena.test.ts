import { describe, expect, it } from "vitest";
import { Storage } from "./storage.js";
import { PENDING_POST_SENTINEL } from "./types.js";

describe("pending arena", () => {
  it("creates a pending game and attaches a post id", () => {
    const storage = new Storage(":memory:");
    const now = 1_700_000_000_000;
    const game = storage.createPendingArena(now, 60_000);
    expect(game.status).toBe("pending_post");
    expect(game.postId).toBe(PENDING_POST_SENTINEL);

    const ok = storage.attachPostToGame(
      game.id,
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      now + 1,
    );
    expect(ok).toBe(true);
    const updated = storage.getGame(game.id);
    expect(updated?.status).toBe("active");
    expect(updated?.postId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
});
