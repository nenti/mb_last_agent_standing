import { describe, expect, it } from "vitest";
import { normalizeMoltbookPostId } from "./moltbookClient.js";

describe("normalizeMoltbookPostId", () => {
  it("returns bare uuid unchanged", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(normalizeMoltbookPostId(id)).toBe(id);
  });

  it("extracts uuid from a Moltbook post URL", () => {
    expect(
      normalizeMoltbookPostId(
        "https://www.moltbook.com/post/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
