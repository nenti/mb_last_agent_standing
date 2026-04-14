import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_API_PORT = "3333";

/** Match server `PORT` from repo `.env` so the Vite proxy tracks `npm run dev` / `PORT=…`. */
function apiOriginFromEnv(): string {
  const envPath = path.join(repoRoot, ".env");
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "") {
        continue;
      }
      const m = trimmed.match(/^PORT\s*=\s*(.+)$/);
      if (m?.[1]) {
        const v = m[1].trim().replace(/^["']|["']$/g, "");
        if (v !== "") {
          return `http://127.0.0.1:${v}`;
        }
      }
    }
  }
  return `http://127.0.0.1:${DEFAULT_API_PORT}`;
}

/** Dev-only: curl (and ?static=1) on /game/:id returns a server-rendered snapshot without running the SPA. */
function agentStaticGamePagePlugin(apiOrigin: string): Plugin {
  return {
    name: "agent-static-game-page",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        const rawUrl = req.url ?? "/";
        const pathname = rawUrl.split("?")[0] ?? "";
        const match = pathname.match(
          /^\/game\/((?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|(?:[A-Za-z0-9_-]{12}))\/?$/i,
        );
        if (!match?.[1]) {
          next();
          return;
        }
        const gameId = match[1];
        const qs = rawUrl.includes("?") ? (rawUrl.split("?")[1] ?? "") : "";
        const params = new URLSearchParams(qs);
        const ua = req.headers["user-agent"] ?? "";
        const wantsStatic =
          /\bcurl\b/i.test(ua) ||
          params.get("static") === "1" ||
          params.get("agent") === "1";
        if (!wantsStatic) {
          next();
          return;
        }
        const asHtml = params.get("format") === "html";
        const path = asHtml
          ? `/api/games/${gameId}/snapshot.html`
          : `/api/games/${gameId}/snapshot.txt`;
        try {
          const r = await fetch(`${apiOrigin}${path}`);
          const body = await r.text();
          res.statusCode = r.status;
          const ct =
            r.headers.get("content-type") ??
            (asHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8");
          res.setHeader("content-type", ct);
          res.end(body);
        } catch {
          next();
        }
      });
    },
  };
}

const apiOrigin = apiOriginFromEnv();

export default defineConfig({
  plugins: [agentStaticGamePagePlugin(apiOrigin)],
  server: {
    proxy: {
      "/api": {
        target: apiOrigin,
        changeOrigin: true,
      },
    },
  },
});
