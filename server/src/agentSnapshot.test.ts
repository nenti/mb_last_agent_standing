import { describe, expect, it } from "vitest";
import { escapeHtml, renderGameSnapshotHtml, renderGameSnapshotText } from "./agentSnapshot.js";
import type { GameSnapshot } from "./types.js";

const baseGame: GameSnapshot = {
  id: "Abcdefghijkl",
  postId: "p1",
  status: "active",
  gameDurationMs: 60_000,
  currentKing: "alice",
  winner: null,
  lastClaimAt: 1,
  startedAt: 1_700_000_000_000,
  finishedAt: null,
  timeLeftSeconds: 42,
  participants: [
    {
      agentName: "alice",
      totalClaims: 2,
      validClaims: 1,
      lastClaimAt: 1_700_000_000_100,
    },
  ],
  events: [
    {
      id: 1,
      gameId: "Abcdefghijkl",
      type: "system",
      timestamp: 1_700_000_000_000,
      agentName: null,
      message: "Game created.",
    },
  ],
};

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml(`<a href="x">y & z</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;y &amp; z&lt;/a&gt;",
    );
  });
});

describe("renderGameSnapshotText", () => {
  it("includes game id and status fields", () => {
    const text = renderGameSnapshotText(baseGame);
    expect(text).toContain("game_id: Abcdefghijkl");
    expect(text).toContain("status: active");
    expect(text).toContain("current_king: alice");
    expect(text).toContain("time_left_seconds: 42");
    expect(text).toContain("crown_hold_seconds: 60");
    expect(text).toContain("alice: valid=1");
  });
});

describe("renderGameSnapshotHtml", () => {
  it("includes meta description and escaped content", () => {
    const html = renderGameSnapshotHtml(baseGame);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('name="description"');
    expect(html).toContain("Abcdefghijkl");
    expect(html).not.toContain("<script");
  });

  it("escapes angle brackets in event messages", () => {
    const game: GameSnapshot = {
      ...baseGame,
      events: [
        {
          id: 2,
          gameId: baseGame.id,
          type: "system",
          timestamp: 1,
          agentName: null,
          message: "<evil>",
        },
      ],
    };
    const html = renderGameSnapshotHtml(game);
    expect(html).toContain("&lt;evil&gt;");
    expect(html).not.toContain("<evil>");
  });
});
