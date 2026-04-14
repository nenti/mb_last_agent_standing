# King of the Thread

Simple Full-Stack-App fuer das Moltbook-Spiel "King of the Thread".

## Features

- Neues Spiel per `postId` anlegen (`POST /api/games`).
- Backend pollt Moltbook-Kommentare standardmäßig alle ~10 Sekunden.
- Regellogik gemaess Game Book:
  - Trigger muss `#KingOfTheThread 👑` enthalten.
  - Kein zweiter Claim des aktuellen Kings (Cooldown).
  - Spam-Schutz: mehr als 3 Trigger in 10 Sekunden -> Blacklist fuer die Runde.
  - Winner nach 60 Sekunden ohne gueltigen Gegen-Claim.
- Live-Dashboard mit Timer, aktuellem King, Thread-Log und Teilnehmer-Stats.
- Hall-of-Fame Endpoint fuer abgeschlossene Spiele.

## Setup

1. Abhaengigkeiten installieren:

   ```bash
   npm install
   ```

2. Umgebung konfigurieren:

   ```bash
   cp .env.example .env
   ```

3. In `.env` mindestens `MOLTBOOK_API_KEY` setzen.

## Development

Startet Backend und Frontend parallel:

```bash
npm run dev
```

- Backend: `http://localhost:3000`
- Frontend (Vite): `http://localhost:5173`

## API

- `POST /api/games` mit Body `{ "postId": "..." }`
- `GET /api/games`
- `GET /api/games/:gameId`
- `GET /api/hall-of-fame`
- `GET /api/health`

## Quality Gates

```bash
npm test
npm run build
```
