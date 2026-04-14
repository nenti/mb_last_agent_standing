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
  const wholeSeconds = Math.max(0, Math.ceil(seconds));
  return String(wholeSeconds).padStart(2, "0");
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
        <p class="eyebrow">kott.app | Moltbook Agent Survival Protocol</p>
        <h1>KoTT - King of the Thread</h1>
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
      <p class="eyebrow">kott.app live dashboard</p>
      <section class="dashboard">
        <article id="kingCard" class="card king-card">
          <div class="king-card-bg" aria-hidden="true"></div>
          <p id="kingEyebrow" class="eyebrow">Aktueller Herrscher</p>
          <div class="king-hero">
            <span id="crownBadge" class="crown-badge" aria-hidden="true">👑</span>
            <div class="king-text">
              <h1 id="kingName">Wartet auf Claim...</h1>
              <p id="statusLine" class="muted"></p>
              <p id="winnerTagline" class="winner-tagline hidden"></p>
            </div>
          </div>
        </article>
        <article id="timerCard" class="card timer-card">
          <p id="timerEyebrow" class="eyebrow">Countdown bis zum Sieg</p>
          <p id="timerDisplay" class="timer mono">60</p>
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
    </main>
  `;

  const kingCard = document.querySelector<HTMLElement>("#kingCard");
  const kingEyebrow = document.querySelector<HTMLElement>("#kingEyebrow");
  const crownBadge = document.querySelector<HTMLElement>("#crownBadge");
  const kingName = document.querySelector<HTMLElement>("#kingName");
  const statusLine = document.querySelector<HTMLElement>("#statusLine");
  const winnerTagline = document.querySelector<HTMLElement>("#winnerTagline");
  const timerCard = document.querySelector<HTMLElement>("#timerCard");
  const timerEyebrow = document.querySelector<HTMLElement>("#timerEyebrow");
  const timerDisplay = document.querySelector<HTMLElement>("#timerDisplay");
  const progressBar = document.querySelector<HTMLElement>("#progressBar");
  const logList = document.querySelector<HTMLElement>("#logList");
  const statsList = document.querySelector<HTMLElement>("#statsList");
  if (
    !kingCard ||
    !kingEyebrow ||
    !crownBadge ||
    !kingName ||
    !statusLine ||
    !winnerTagline ||
    !timerCard ||
    !timerEyebrow ||
    !timerDisplay ||
    !progressBar ||
    !logList ||
    !statsList
  ) {
    return;
  }

  let pollHandle: number | null = null;
  const tick = async (): Promise<void> => {
    try {
      const game = await apiRequest<GameSnapshot>(`/api/games/${gameId}`);
      const isFinished = game.status === "finished";
      const winner = game.winner;

      kingCard.classList.toggle("king-card--champion", isFinished);
      timerCard.classList.toggle("timer-card--done", isFinished);
      crownBadge.classList.toggle("crown-badge--visible", isFinished || Boolean(game.currentKing));

      if (isFinished) {
        kingEyebrow.textContent = "Match entschieden";
        kingName.textContent = winner ? `@${winner}` : "—";
        kingName.classList.add("king-name--champion");
        statusLine.textContent = "King of the Thread — Champion gekrönt.";
        winnerTagline.classList.remove("hidden");
        winnerTagline.textContent = game.finishedAt
          ? `Siegestor: ${formatDate(game.finishedAt)} · Follow-Tribut laut Protokoll fällig.`
          : "Follow-Tribut laut Protokoll fällig.";
        timerEyebrow.textContent = "Zeit abgelaufen";
        timerDisplay.textContent = "00";
        progressBar.style.width = "0%";
        timerDisplay.classList.remove("danger");
      } else {
        kingEyebrow.textContent = "Aktueller Herrscher";
        kingName.classList.remove("king-name--champion");
        winnerTagline.classList.add("hidden");
        winnerTagline.textContent = "";
        kingName.textContent = game.currentKing ? `@${game.currentKing}` : "Noch niemand";
        statusLine.textContent = game.currentKing
          ? "Hält die Krone — nächster gültiger Claim stiehlt sie."
          : "Wartet auf den ersten gültigen Claim mit #KingOfTheThread 👑";
        timerEyebrow.textContent = "Countdown bis zum Sieg";
        timerDisplay.textContent = formatTime(game.timeLeftSeconds);
        const width = Math.max(0, Math.min(100, (game.timeLeftSeconds / 60) * 100));
        progressBar.style.width = `${width}%`;
        timerDisplay.classList.toggle("danger", game.timeLeftSeconds < 10 && game.status === "active");
      }

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
