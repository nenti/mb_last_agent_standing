import { mkdirSync } from "node:fs";
import { join } from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { renderGameSnapshotHtml, renderGameSnapshotText } from "./agentSnapshot.js";
import { gameIdSchema } from "./gameId.js";
import { config } from "./config.js";
import { GameManager } from "./gameManager.js";
import { MoltbookClient } from "./moltbookClient.js";
import { Storage } from "./storage.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const dataDir = join(process.cwd(), "..", "data");
mkdirSync(dataDir, { recursive: true });
const storage = new Storage(join(dataDir, "king-of-the-thread.db"));
const moltbookClient = new MoltbookClient(config.moltbookApiKey);
const gameManager = new GameManager(
  storage,
  moltbookClient,
  config.pollIntervalMs,
  config.postGameOverComment,
);

gameManager.startExistingActiveGames();

function gameDurationMsFromRequest(gameDurationSeconds: number | undefined): number {
  const sec = gameDurationSeconds ?? Math.round(config.gameDurationMs / 1000);
  return sec * 1000;
}

const createGameBodySchema = z.object({
  postId: z.string().min(1).optional(),
  /** Crown hold: no valid counter-claim for this many seconds → king wins. Default: GAME_DURATION_MS env. */
  gameDurationSeconds: z.number().int().min(15).max(7200).optional(),
});

const attachPostBodySchema = z.object({
  postId: z.string().min(1),
});

const gameIdParam = z.object({ gameId: gameIdSchema });

app.get("/api/health", async () => ({ ok: true }));

app.post("/api/games", async (request, reply) => {
  const parsed = createGameBodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request body" });
  }
  const postId = parsed.data.postId?.trim();
  const durationMs = gameDurationMsFromRequest(parsed.data.gameDurationSeconds);
  if (postId) {
    const game = gameManager.createGame(postId, durationMs);
    return reply.code(201).send(game);
  }
  const game = gameManager.createPendingArena(durationMs);
  return reply.code(201).send(game);
});

app.patch("/api/games/:gameId", async (request, reply) => {
  const params = gameIdParam.safeParse(request.params);
  const parsed = attachPostBodySchema.safeParse(request.body);
  if (!params.success || !parsed.success) {
    return reply.code(400).send({ error: "Invalid request" });
  }
  const game = gameManager.attachThread(params.data.gameId, parsed.data.postId.trim());
  if (!game) {
    return reply.code(404).send({ error: "Game not found or thread already linked" });
  }
  return game;
});

app.get("/api/games", async () => {
  return gameManager.listGames();
});

app.get("/api/hall-of-fame", async () => {
  const games = gameManager.listGames();
  return games.filter((game) => game.status === "finished");
});

app.get("/api/games/:gameId/snapshot.txt", async (request, reply) => {
  const params = gameIdParam.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).type("text/plain; charset=utf-8").send("Invalid game id\n");
  }
  const game = gameManager.getGame(params.data.gameId);
  if (!game) {
    return reply.code(404).type("text/plain; charset=utf-8").send("Game not found\n");
  }
  return reply.type("text/plain; charset=utf-8").send(renderGameSnapshotText(game));
});

app.get("/api/games/:gameId/snapshot.html", async (request, reply) => {
  const params = gameIdParam.safeParse(request.params);
  if (!params.success) {
    return reply
      .code(400)
      .type("text/html; charset=utf-8")
      .send("<!DOCTYPE html><html><body><p>Invalid game id</p></body></html>\n");
  }
  const game = gameManager.getGame(params.data.gameId);
  if (!game) {
    return reply
      .code(404)
      .type("text/html; charset=utf-8")
      .send("<!DOCTYPE html><html><body><p>Game not found</p></body></html>\n");
  }
  return reply.type("text/html; charset=utf-8").send(renderGameSnapshotHtml(game));
});

app.get("/api/games/:gameId", async (request, reply) => {
  const params = gameIdParam.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({ error: "Invalid game id" });
  }
  const game = gameManager.getGame(params.data.gameId);
  if (!game) {
    return reply.code(404).send({ error: "Game not found" });
  }
  return game;
});

const closeSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of closeSignals) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: "0.0.0.0" });
