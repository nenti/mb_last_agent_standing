import { describe, expect, it } from "vitest";
import {
  flattenCommentsFromApiList,
  normalizeMoltbookPostId,
} from "./moltbookClient.js";

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

describe("flattenCommentsFromApiList", () => {
  it("includes nested replies and children", () => {
    const flat = flattenCommentsFromApiList([
      {
        id: "top-1",
        authorName: "A",
        content: "top",
        createdAt: 1000,
        replies: [
          {
            id: "rep-1",
            authorName: "B",
            content: "reply one",
            createdAt: 2000,
            children: [
              {
                id: "rep-2",
                authorName: "C",
                content: "nested",
                createdAt: 3000,
              },
            ],
          },
        ],
      },
    ]);
    expect(flat.map((c) => c.id)).toEqual(["top-1", "rep-1", "rep-2"]);
  });

  it("dedupes duplicate ids if the API echoes a comment twice", () => {
    const flat = flattenCommentsFromApiList([
      {
        id: "x",
        authorName: "A",
        content: "a",
        createdAt: 1,
        replies: [
          { id: "x", authorName: "A", content: "dup id", createdAt: 2 },
        ],
      },
    ]);
    expect(flat).toHaveLength(1);
    expect(flat[0].content).toBe("a");
  });
});
