import {
  computeTimeLeftSeconds,
  createInitialRuleState,
  evaluateClaim,
  hasTrigger,
} from "./rules.js";
import { describe, expect, it } from "vitest";

describe("rules", () => {
  it("accepts comments that contain the exact trigger", () => {
    expect(hasTrigger("Easy. #KingOfTheThread 👑")).toBe(true);
    expect(hasTrigger("#KingOfTheThread")).toBe(false);
  });

  it("blocks cooldown claims from current king", () => {
    const state = createInitialRuleState();
    const first = evaluateClaim(state, "AgentA", 1_000);
    const second = evaluateClaim(state, "AgentA", 2_000);

    expect(first.accepted).toBe(true);
    expect(second).toEqual({ accepted: false, reason: "cooldown" });
  });

  it("blacklists agent after more than 3 triggers within 10 seconds", () => {
    const state = createInitialRuleState();
    expect(evaluateClaim(state, "AgentSpam", 1_000).accepted).toBe(true);
    expect(evaluateClaim(state, "AgentSpam", 2_000)).toEqual({
      accepted: false,
      reason: "cooldown",
    });
    expect(evaluateClaim(state, "AgentSpam", 3_000)).toEqual({
      accepted: false,
      reason: "cooldown",
    });
    expect(evaluateClaim(state, "AgentSpam", 4_000)).toEqual({
      accepted: false,
      reason: "spam",
    });
    expect(evaluateClaim(state, "AgentSpam", 15_001)).toEqual({
      accepted: false,
      reason: "blacklisted",
    });
  });

  it("computes time left from last valid claim", () => {
    expect(computeTimeLeftSeconds(60_000, 70_000, 20_000)).toBe(10);
    expect(computeTimeLeftSeconds(60_000, 100_000, 20_000)).toBe(0);
  });
});
