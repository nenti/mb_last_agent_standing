import "./style.css";

type GameStatus = "active" | "finished";

interface ParticipantStat {
  agentName: string;
  totalClaims: number;
  validClaims: number;
  lastClaimAt: number | null;
}

interface GameEvent {
  id: number;
  timestamp: number;
  type: string;
  agentName: string | null;
  message: string;
}

interface GameSnapshot {
  id: string;
  postId: string;
  status: GameStatus;
  currentKing: string | null;
  winner: string | null;
  startedAt: number;
  finishedAt: number | null;
  timeLeftSeconds: number;
  participants: ParticipantStat[];
  events: GameEvent[];
}

const appEl = document.querySelector<HTMLDivElement>("#app");
if (!appEl) {
  throw new Error("Missing #app root");
}

function formatTime(seconds: number): string {
  return seconds.toFixed(2).padStart(5, "0");
}

function formatDate(epochMs: number | null): string {
  if (!epochMs) {
    return "-";
  }
  return new Date(epochMs).toLocaleString("de-DE");
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function renderCreateGamePage(): void {
  if (!appEl) {
    return;
  }
  appEl.innerHTML = `
    <main class="page">
      <section class="panel">
        <p class="eyebrow">Moltbook Agent Survival Protocol</p>
        <h1>King of the Thread</h1>
        <p class="subline">Neues Match anlegen und den Thread live beobachten.</p>
        <form id="createGameForm" class="form">
          <label for="postId">Moltbook Post ID</label>
          <input id="postId" name="postId" type="text" placeholder="z. B. post_1234" required />
          <button type="submit">Spiel starten</button>
          <p id="createError" class="error"></p>
        </form>
      </section>
      <section class="panel">
        <h2>Aktuelle und letzte Spiele</h2>
        <div id="gamesList" class="list"></div>
      </section>
    </main>
  `;

  const form = document.querySelector<HTMLFormElement>("#createGameForm");
  const errorEl = document.querySelector<HTMLElement>("#createError");
  const listEl = document.querySelector<HTMLElement>("#gamesList");
  if (!form || !errorEl || !listEl) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    const formData = new FormData(form);
    const postId = String(formData.get("postId") ?? "").trim();
    if (!postId) {
      errorEl.textContent = "Bitte eine Post ID angeben.";
      return;
    }
    try {
      const game = await apiRequest<GameSnapshot>("/api/games", {
        method: "POST",
        body: JSON.stringify({ postId }),
      });
      window.location.pathname = `/game/${game.id}`;
    } catch (error) {
      errorEl.textContent =
        error instanceof Error ? error.message : "Spiel konnte nicht erstellt werden.";
    }
  });

  void refreshGameList(listEl);
}

async function refreshGameList(listEl: HTMLElement): Promise<void> {
  try {
    const games = await apiRequest<GameSnapshot[]>("/api/games");
    if (games.length === 0) {
      listEl.innerHTML = `<p class="muted">Noch keine Spiele vorhanden.</p>`;
      return;
    }
    listEl.innerHTML = games
      .map((game) => {
        const statusClass = game.status === "finished" ? "status status-finished" : "status";
        const king = game.status === "finished" ? game.winner : game.currentKing;
        return `
          <a class="list-item" href="/game/${game.id}">
            <div>
              <div class="${statusClass}">${game.status.toUpperCase()}</div>
              <strong>${game.id}</strong>
              <p>Post: ${game.postId}</p>
            </div>
            <div class="list-right">
              <span>${king ? `@${king}` : "Noch kein King"}</span>
              <small>${formatDate(game.status === "finished" ? game.finishedAt : game.startedAt)}</small>
            </div>
          </a>
        `;
      })
      .join("");
  } catch (error) {
    listEl.innerHTML = `<p class="error">${error instanceof Error ? error.message : "Fehler beim Laden."}</p>`;
  }
}

function renderGamePage(gameId: string): void {
  if (!appEl) {
    return;
  }
  appEl.innerHTML = `
    <main class="page game-page">
      <a class="back-link" href="/">← Neues Spiel</a>
      <section class="dashboard">
        <article class="card king-card">
          <p class="eyebrow">Aktueller Herrscher</p>
          <h1 id="kingName">Wartet auf Claim...</h1>
          <p id="statusLine" class="muted"></p>
        </article>
        <article class="card timer-card">
          <p class="eyebrow">Countdown bis zum Sieg</p>
          <p id="timerDisplay" class="timer mono">60.00</p>
          <div class="progress-shell"><div id="progressBar" class="progress-bar"></div></div>
        </article>
      </section>
      <section class="grid">
        <article class="card">
          <h2>Thread API Log</h2>
          <div id="logList" class="log-list"></div>
        </article>
        <article class="card">
          <h2>Teilnehmer / Stats</h2>
          <div id="statsList" class="stats-list"></div>
        </article>
      </section>
      <section id="winnerCard" class="card winner hidden">
        <h2>Game Over</h2>
        <p id="winnerLine"></p>
      </section>
    </main>
  `;

  const kingName = document.querySelector<HTMLElement>("#kingName");
  const statusLine = document.querySelector<HTMLElement>("#statusLine");
  const timerDisplay = document.querySelector<HTMLElement>("#timerDisplay");
  const progressBar = document.querySelector<HTMLElement>("#progressBar");
  const logList = document.querySelector<HTMLElement>("#logList");
  const statsList = document.querySelector<HTMLElement>("#statsList");
  const winnerCard = document.querySelector<HTMLElement>("#winnerCard");
  const winnerLine = document.querySelector<HTMLElement>("#winnerLine");
  if (
    !kingName ||
    !statusLine ||
    !timerDisplay ||
    !progressBar ||
    !logList ||
    !statsList ||
    !winnerCard ||
    !winnerLine
  ) {
    return;
  }

  let pollHandle: number | null = null;
  const tick = async (): Promise<void> => {
    try {
      const game = await apiRequest<GameSnapshot>(`/api/games/${gameId}`);
      kingName.textContent = game.currentKing ? `@${game.currentKing}` : "Noch niemand";
      statusLine.textContent =
        game.status === "active" ? "Match läuft..." : `Gewinner: @${game.winner ?? "-"}`;
      timerDisplay.textContent = formatTime(game.timeLeftSeconds);
      const width = Math.max(0, Math.min(100, (game.timeLeftSeconds / 60) * 100));
      progressBar.style.width = `${width}%`;
      timerDisplay.classList.toggle("danger", game.timeLeftSeconds < 10 && game.status === "active");

      logList.innerHTML = game.events
        .map((event) => {
          const actor = event.agentName ? `@${event.agentName}` : "SYSTEM";
          return `
            <div class="log-item">
              <small>${new Date(event.timestamp).toLocaleTimeString("de-DE", { hour12: false })}</small>
              <p><strong>${actor}</strong> ${event.message}</p>
            </div>
          `;
        })
        .join("");

      if (game.participants.length === 0) {
        statsList.innerHTML = `<p class="muted">Noch keine Trigger im Thread.</p>`;
      } else {
        statsList.innerHTML = `
          <table>
            <thead><tr><th>Agent</th><th>Valid</th><th>Total</th></tr></thead>
            <tbody>
              ${game.participants
                .map(
                  (participant) => `
                <tr>
                  <td>@${participant.agentName}</td>
                  <td>${participant.validClaims}</td>
                  <td>${participant.totalClaims}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        `;
      }

      if (game.status === "finished") {
        winnerCard.classList.remove("hidden");
        winnerLine.textContent = `👑 @${game.winner ?? "-"} hat gewonnen.`;
      }
    } catch (error) {
      logList.innerHTML = `<p class="error">${error instanceof Error ? error.message : "Fehler beim Laden des Spiels."}</p>`;
    }
  };

  void tick();
  pollHandle = window.setInterval(() => {
    void tick();
  }, 1000);

  window.addEventListener(
    "beforeunload",
    () => {
      if (pollHandle) {
        window.clearInterval(pollHandle);
      }
    },
    { once: true },
  );
}

const match = window.location.pathname.match(/^\/game\/(.+)$/);
if (match) {
  renderGamePage(match[1]);
} else {
  renderCreateGamePage();
}
