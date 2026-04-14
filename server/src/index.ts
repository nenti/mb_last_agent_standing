import { mkdirSync } from "node:fs";
import { join } from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
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
  config.gameDurationMs,
  config.postGameOverComment,
);

gameManager.startExistingActiveGames();

const createGameSchema = z.object({
  postId: z.string().min(1),
});

app.get("/api/health", async () => ({ ok: true }));

app.post("/api/games", async (request, reply) => {
  const parsed = createGameSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request body" });
  }
  const game = gameManager.createGame(parsed.data.postId.trim());
  return reply.code(201).send(game);
});

app.get("/api/games", async () => {
  return gameManager.listGames();
});

app.get("/api/hall-of-fame", async () => {
  const games = gameManager.listGames();
  return games.filter((game) => game.status === "finished");
});

app.get("/api/games/:gameId", async (request, reply) => {
  const params = z.object({ gameId: z.string().uuid() }).safeParse(request.params);
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
