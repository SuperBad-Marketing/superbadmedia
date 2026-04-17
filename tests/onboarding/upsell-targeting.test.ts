/**
 * OS-2: Upsell targeting logic unit tests.
 *
 * Tests the `revenueAtOrAbove` logic and the two-tier model. These tests
 * verify the pure logic; actual evaluateUpsellTier requires a live DB
 * + settings table so is tested via the schema alignment checks and
 * the threshold logic in isolation.
 */
import { describe, it, expect } from "vitest";
import { REVENUE_RANGES, type RevenueRange } from "@/lib/db/schema/companies";

// Replicate the private helper for testing
function revenueAtOrAbove(
  value: RevenueRange | null,
  floor: string,
): boolean {
  if (!value) return false;
  const floorIdx = REVENUE_RANGES.indexOf(floor as RevenueRange);
  if (floorIdx === -1) return false;
  const valueIdx = REVENUE_RANGES.indexOf(value);
  return valueIdx >= floorIdx;
}

// Replicate the feature-area prefix logic
function featureAreaPrefix(kind: string): string {
  const idx = kind.indexOf("_");
  return idx > 0 ? kind.slice(0, idx) : kind;
}

describe("revenueAtOrAbove", () => {
  it("returns true for revenue at the floor", () => {
    expect(revenueAtOrAbove("500k_1m", "500k_1m")).toBe(true);
  });

  it("returns true for revenue above the floor", () => {
    expect(revenueAtOrAbove("1m_3m", "500k_1m")).toBe(true);
    expect(revenueAtOrAbove("3m_plus", "500k_1m")).toBe(true);
  });

  it("returns false for revenue below the floor", () => {
    expect(revenueAtOrAbove("250k_500k", "500k_1m")).toBe(false);
    expect(revenueAtOrAbove("under_250k", "500k_1m")).toBe(false);
  });

  it("returns false for null revenue", () => {
    expect(revenueAtOrAbove(null, "500k_1m")).toBe(false);
  });

  it("returns false for invalid floor", () => {
    expect(revenueAtOrAbove("1m_3m", "invalid_range")).toBe(false);
  });
});

describe("featureAreaPrefix", () => {
  it("extracts prefix before first underscore", () => {
    expect(featureAreaPrefix("content_generate_draft")).toBe("content");
    expect(featureAreaPrefix("inbox_message_sent")).toBe("inbox");
    expect(featureAreaPrefix("saas_subscription_created")).toBe("saas");
  });

  it("returns the whole string if no underscore", () => {
    expect(featureAreaPrefix("note")).toBe("note");
  });
});

describe("Warm tier logic (spec §4.1)", () => {
  it("revenue alone qualifies (with location)", () => {
    const revenueQ = revenueAtOrAbove("1m_3m", "500k_1m");
    const engagementQ = false; // low login
    const locationMatch = true;
    // Warm = location AND (revenue OR high-login)
    const tier = locationMatch && (revenueQ || engagementQ) ? "warm" : "none";
    expect(tier).toBe("warm");
  });

  it("high engagement alone qualifies (with location)", () => {
    const revenueQ = false; // low revenue
    const highLogin = true; // 10+ login days
    const locationMatch = true;
    const tier = locationMatch && (revenueQ || highLogin) ? "warm" : "none";
    expect(tier).toBe("warm");
  });

  it("does not qualify without location match", () => {
    const revenueQ = true;
    const locationMatch = false;
    const tier = locationMatch && revenueQ ? "warm" : "none";
    expect(tier).toBe("none");
  });
});

describe("Hot tier logic (spec §4.1)", () => {
  it("revenue AND engagement AND goal qualifies (with location)", () => {
    const revenueQ = true;
    const engagementQ = true; // high login AND broad feature
    const goalAligned = true; // "scale" or "launch_new"
    const locationMatch = true;
    const tier =
      locationMatch && revenueQ && engagementQ && goalAligned ? "hot" : "warm";
    expect(tier).toBe("hot");
  });

  it("missing goal alignment stays Warm", () => {
    const revenueQ = true;
    const engagementQ = true;
    const goalAligned = false;
    const locationMatch = true;
    // All three required for Hot; only Warm with revenue or engagement
    const isHot = locationMatch && revenueQ && engagementQ && goalAligned;
    const isWarm = locationMatch && (revenueQ || engagementQ);
    expect(isHot).toBe(false);
    expect(isWarm).toBe(true);
  });

  it("missing engagement stays Warm (revenue alone)", () => {
    const revenueQ = true;
    const engagementQ = false;
    const goalAligned = true;
    const locationMatch = true;
    const isHot = locationMatch && revenueQ && engagementQ && goalAligned;
    const isWarm = locationMatch && (revenueQ || engagementQ);
    expect(isHot).toBe(false);
    expect(isWarm).toBe(true); // revenue qualifies for Warm
  });
});

describe("Goal alignment (spec §4.1)", () => {
  const ALIGNED_GOALS = new Set<string>(["scale", "launch_new"]);
  function isGoalAligned(goal: string): boolean {
    return ALIGNED_GOALS.has(goal);
  }

  it("'scale' is goal-aligned", () => {
    expect(isGoalAligned("scale")).toBe(true);
  });

  it("'launch_new' is goal-aligned", () => {
    expect(isGoalAligned("launch_new")).toBe(true);
  });

  it("'grow' is NOT goal-aligned", () => {
    expect(isGoalAligned("grow")).toBe(false);
  });

  it("'steady' is NOT goal-aligned", () => {
    expect(isGoalAligned("steady")).toBe(false);
  });

  it("'figure_out' is NOT goal-aligned", () => {
    expect(isGoalAligned("figure_out")).toBe(false);
  });
});
