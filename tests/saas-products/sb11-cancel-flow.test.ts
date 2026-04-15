/**
 * SB-11 — SaaS cancel-flow unit tests.
 *
 * Covers the pure arithmetic in `computeSaasExitMath` — the part of the
 * cancel flow that absolutely must be right because subscribers see the
 * exact cents they're about to be charged. The Server Action + route
 * behaviour is integration-heavy (auth, Stripe, DB fixtures) and is
 * logged in PATCHES_OWED for a follow-up session.
 */
import { describe, it, expect } from "vitest";

import { computeSaasExitMath } from "@/lib/saas-products/cancel-math";
import { AVG_MONTH_MS } from "@/lib/subscription/remainder";

const NOW = 1_700_000_000_000;

describe("computeSaasExitMath", () => {
  it("rounds up partial months (ceil) on the remainder", () => {
    const result = computeSaasExitMath({
      committed_until_date_ms: NOW + AVG_MONTH_MS * 5 + 1,
      monthly_cents: 10_000,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(6);
    expect(result.remainder_cents).toBe(60_000);
  });

  it("returns zero remainder when the commitment has already lapsed", () => {
    const result = computeSaasExitMath({
      committed_until_date_ms: NOW - AVG_MONTH_MS,
      monthly_cents: 10_000,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(0);
    expect(result.remainder_cents).toBe(0);
    expect(result.buyout_cents).toBe(0);
  });

  it("buyout is floor(remainder / 2) — client-favourable on odd cents", () => {
    const result = computeSaasExitMath({
      committed_until_date_ms: NOW + AVG_MONTH_MS * 1,
      monthly_cents: 9_999,
      now_ms: NOW,
    });
    expect(result.remainder_cents).toBe(9_999);
    expect(result.buyout_cents).toBe(4_999);
  });

  it("computes a standard 11.5-month remainder as 12 months", () => {
    const result = computeSaasExitMath({
      committed_until_date_ms: NOW + AVG_MONTH_MS * 11.5,
      monthly_cents: 19_900,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(12);
    expect(result.remainder_cents).toBe(12 * 19_900);
    expect(result.buyout_cents).toBe(Math.floor((12 * 19_900) / 2));
  });

  it("preserves committed_until_date_ms + monthly_cents on the result", () => {
    const result = computeSaasExitMath({
      committed_until_date_ms: NOW + AVG_MONTH_MS,
      monthly_cents: 4_500,
      now_ms: NOW,
    });
    expect(result.committed_until_date_ms).toBe(NOW + AVG_MONTH_MS);
    expect(result.monthly_cents).toBe(4_500);
  });
});
