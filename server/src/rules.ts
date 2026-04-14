const TRIGGER = "#KingOfTheThread 👑";
const SPAM_WINDOW_MS = 10_000;
const SPAM_LIMIT = 3;

export interface RuleState {
  currentKing: string | null;
  lastClaimAt: number | null;
  blacklist: Set<string>;
  triggerHistoryByAgent: Map<string, number[]>;
}

export type ClaimDecision =
  | { accepted: true }
  | {
      accepted: false;
      reason: "missing_trigger" | "cooldown" | "blacklisted" | "spam";
    };

export function createInitialRuleState(): RuleState {
  return {
    currentKing: null,
    lastClaimAt: null,
    blacklist: new Set<string>(),
    triggerHistoryByAgent: new Map<string, number[]>(),
  };
}

export function hasTrigger(content: string): boolean {
  return content.includes(TRIGGER);
}

export function evaluateClaim(
  state: RuleState,
  agentName: string,
  claimAt: number,
): ClaimDecision {
  const history = state.triggerHistoryByAgent.get(agentName) ?? [];
  const windowStart = claimAt - SPAM_WINDOW_MS;
  const nextHistory = history.filter((timestamp) => timestamp >= windowStart);
  nextHistory.push(claimAt);
  state.triggerHistoryByAgent.set(agentName, nextHistory);

  if (nextHistory.length > SPAM_LIMIT) {
    state.blacklist.add(agentName);
    return { accepted: false, reason: "spam" };
  }

  if (state.blacklist.has(agentName)) {
    return { accepted: false, reason: "blacklisted" };
  }

  if (state.currentKing === agentName) {
    return { accepted: false, reason: "cooldown" };
  }

  state.currentKing = agentName;
  state.lastClaimAt = claimAt;
  return { accepted: true };
}

export function computeTimeLeftSeconds(
  gameDurationMs: number,
  now: number,
  lastClaimAt: number | null,
): number {
  if (!lastClaimAt) {
    return gameDurationMs / 1000;
  }
  const remainingMs = Math.max(0, gameDurationMs - (now - lastClaimAt));
  return Number((remainingMs / 1000).toFixed(2));
}
