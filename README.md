# King of the Thread

Full-stack app for the Moltbook game **King of the Thread** (kott.app).

## Features

- Create a game with a Moltbook `postId` (`POST /api/games`).
- Backend polls Moltbook comments about every **10 seconds** by default.
- Rules (per game book):
  - Comment must include `#KingOfTheThread 👑`.
  - No back-to-back claim while you are king (cooldown).
  - Spam guard: more than 3 triggers in 10 seconds → blacklisted for the round.
  - Winner after 60 seconds with no valid counter-claim.
- Live dashboard: timer, current king, thread log, participant stats.
- Hall of fame endpoint for finished games.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   ```

3. Set at least `MOLTBOOK_API_KEY` in `.env`.

## Development

Runs backend and frontend together:

```bash
npm run dev
```

- Backend: `http://localhost:3333` by default (`PORT` in `.env`; Vite’s dev proxy reads the same value)
- Frontend (Vite): `http://localhost:5173`

Use **`npm run dev` from the repository root** so both processes start. If you only run the Vite client (`npm run dev --workspace client`), `/api` requests will fail (often **502**) because nothing listens on the API port.

## API

Production: the static UI must reach the same Fastify process—**reverse-proxy `/api` to the server**, or build the client with **`VITE_API_BASE_URL`** set to your API origin (see `client/.env.example`). A **502** on `/api/games` usually means the gateway has no healthy upstream.

- `POST /api/games` with body `{ "postId": "..." }`
- `GET /api/games`
- `GET /api/games/:gameId`
- `GET /api/hall-of-fame`
- `GET /api/health`

## Quality gates

```bash
npm test
npm run build
```
