import type { MoltbookComment } from "./types.js";

const API_BASE = "https://www.moltbook.com/api/v1";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    const numeric = Number.parseInt(value, 10);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function normalizeComment(raw: Record<string, unknown>): MoltbookComment | null {
  const id =
    asString(raw.id) ??
    asString(raw.commentId) ??
    asString(raw.comment_id) ??
    asString(raw.uuid);

  const authorName =
    asString(raw.authorName) ??
    asString(raw.author_name) ??
    asString((raw.agent as Record<string, unknown> | undefined)?.name) ??
    asString((raw.author as Record<string, unknown> | undefined)?.username) ??
    asString((raw.author as Record<string, unknown> | undefined)?.name);

  const content =
    asString(raw.content) ??
    asString(raw.text) ??
    asString(raw.message) ??
    asString(raw.body);

  const createdAt =
    asNumber(raw.createdAt) ??
    asNumber(raw.created_at) ??
    asNumber(raw.timestamp) ??
    Date.now();

  if (!id || !authorName || !content) {
    return null;
  }

  return { id, authorName, content, createdAt };
}

export interface MoltbookCommentsPage {
  comments: MoltbookComment[];
  nextCursor: string | null;
}

export class MoltbookClient {
  constructor(private readonly apiKey: string) {}

  private async request(
    path: string,
    init: RequestInit = {},
    retries = 1,
  ): Promise<Response> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        "x-api-key": this.apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 429 && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return this.request(path, init, retries - 1);
    }

    if (!response.ok) {
      throw new Error(
        `Moltbook API request failed (${response.status}) for ${path}`,
      );
    }

    return response;
  }

  async getPostComments(
    postId: string,
    cursor?: string | null,
  ): Promise<MoltbookCommentsPage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const response = await this.request(`/posts/${postId}/comments${query}`);
    const payload = (await response.json()) as Record<string, unknown>;
    const listCandidate =
      payload.comments ?? payload.items ?? payload.data ?? payload.results;
    const list = Array.isArray(listCandidate) ? listCandidate : [];
    const comments = list
      .map((entry) => normalizeComment(entry as Record<string, unknown>))
      .filter((entry): entry is MoltbookComment => entry !== null)
      .sort((a, b) => a.createdAt - b.createdAt);

    const nextCursor =
      asString(payload.next_cursor) ??
      asString(payload.nextCursor) ??
      asString((payload.meta as Record<string, unknown> | undefined)?.next_cursor) ??
      null;

    return { comments, nextCursor };
  }

  async postComment(postId: string, content: string): Promise<void> {
    await this.request(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }
}
