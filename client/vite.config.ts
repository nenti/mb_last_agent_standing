import type { Plugin } from "vite";
import { defineConfig } from "vite";

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

export default defineConfig({
  plugins: [agentStaticGamePagePlugin("http://localhost:3000")],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
