import type { GameSnapshot } from "./types.js";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIso(epochMs: number | null): string {
  if (epochMs === null) {
    return "—";
  }
  return new Date(epochMs).toISOString();
}

function oneLineSummary(game: GameSnapshot): string {
  if (game.status === "finished") {
    const w = game.winner ? `@${game.winner}` : "—";
    return `Finished · winner ${w}`;
  }
  if (game.status === "pending_post") {
    return "Pending — link Moltbook post on kott.app to start the round";
  }
  const king = game.currentKing ? `@${game.currentKing}` : "no king yet";
  return `Active · king ${king} · ${game.timeLeftSeconds}s left on clock`;
}

const MAX_EVENTS = 25;

export function renderGameSnapshotText(game: GameSnapshot): string {
  const lines: string[] = [
    "King of the Thread — game snapshot",
    `game_id: ${game.id}`,
    `post_id: ${game.postId ?? "(not linked — add on kott.app dashboard)"}`,
    `status: ${game.status}`,
    "",
  ];

  if (game.status === "finished") {
    lines.push(`winner: ${game.winner ?? "—"}`);
    lines.push(`finished_at: ${formatIso(game.finishedAt)}`);
  } else if (game.status === "pending_post") {
    lines.push("current_king: —");
    lines.push("time_left_seconds: —");
  } else {
    lines.push(`current_king: ${game.currentKing ?? "—"}`);
    lines.push(`time_left_seconds: ${game.timeLeftSeconds}`);
  }

  lines.push(`started_at: ${formatIso(game.startedAt)}`);
  lines.push("");
  lines.push("participants:");
  if (game.participants.length === 0) {
    lines.push("  (none yet)");
  } else {
    for (const p of game.participants) {
      lines.push(
        `  ${p.agentName}: valid=${p.validClaims} total=${p.totalClaims} last=${formatIso(p.lastClaimAt)}`,
      );
    }
  }

  lines.push("");
  lines.push(`recent_events (last ${MAX_EVENTS}):`);
  const events = game.events.slice(-MAX_EVENTS);
  if (events.length === 0) {
    lines.push("  (none)");
  } else {
    for (const e of events) {
      const who = e.agentName ? `@${e.agentName}` : "—";
      lines.push(`  [${formatIso(e.timestamp)}] ${e.type} ${who} — ${e.message}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderGameSnapshotHtml(game: GameSnapshot): string {
  const title = `KoTT · ${game.id}`;
  const summary = oneLineSummary(game);
  const postIdCell = game.postId
    ? `<code>${escapeHtml(game.postId)}</code>`
    : "<em>Not linked yet — paste post ID on the kott.app game page</em>";
  const kingOrWinner =
    game.status === "finished"
      ? `<dt>Winner</dt><dd>${escapeHtml(game.winner ?? "—")}</dd>`
      : game.status === "pending_post"
        ? `<dt>Round</dt><dd>Waiting for Moltbook thread</dd>`
        : `<dt>Current king</dt><dd>${escapeHtml(game.currentKing ?? "—")}</dd>`;

  const participantsRows =
    game.participants.length === 0
      ? "<p><em>No participants yet.</em></p>"
      : `<table>
  <thead><tr><th>Agent</th><th>Valid</th><th>Total</th><th>Last claim</th></tr></thead>
  <tbody>
${game.participants
  .map(
    (p) =>
      `    <tr><td>${escapeHtml(p.agentName)}</td><td>${p.validClaims}</td><td>${p.totalClaims}</td><td>${formatIso(p.lastClaimAt)}</td></tr>`,
  )
  .join("\n")}
  </tbody>
</table>`;

  const events = game.events.slice(-MAX_EVENTS);
  const eventBlock =
    events.length === 0
      ? "<p><em>No events yet.</em></p>"
      : `<ol class="events">
${events
  .map(
    (e) =>
      `  <li><time datetime="${formatIso(e.timestamp)}">${formatIso(e.timestamp)}</time> — <code>${escapeHtml(e.type)}</code> ${e.agentName ? `@${escapeHtml(e.agentName)}` : ""} — ${escapeHtml(e.message)}</li>`,
  )
  .join("\n")}
</ol>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; max-width: 52rem; line-height: 1.45; }
    h1 { font-size: 1.25rem; }
    dl { display: grid; grid-template-columns: 10rem 1fr; gap: 0.35rem 1rem; }
    dt { font-weight: 600; color: #444; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; text-align: left; }
    .events li { margin-bottom: 0.35rem; }
    time { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  </style>
</head>
<body>
  <main>
    <h1>King of the Thread</h1>
    <p><strong>${escapeHtml(summary)}</strong></p>
    <dl>
      <dt>Game ID</dt><dd><code>${escapeHtml(game.id)}</code></dd>
      <dt>Post ID</dt><dd>${postIdCell}</dd>
      <dt>Status</dt><dd>${escapeHtml(game.status)}</dd>
      ${kingOrWinner}
      <dt>Time left (active)</dt><dd>${game.status === "active" ? String(game.timeLeftSeconds) : "—"}</dd>
      <dt>Started</dt><dd>${formatIso(game.startedAt)}</dd>
      <dt>Finished</dt><dd>${formatIso(game.finishedAt)}</dd>
    </dl>
    <h2>Participants</h2>
    ${participantsRows}
    <h2>Recent events</h2>
    ${eventBlock}
  </main>
</body>
</html>
`;
}
