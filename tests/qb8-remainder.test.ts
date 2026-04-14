import { describe, it, expect } from "vitest";
import {
  AVG_MONTH_MS,
  computeEarlyCancelRemainder,
} from "@/lib/subscription/remainder";

const NOW = 1_700_000_000_000;

describe("QB-8 — computeEarlyCancelRemainder", () => {
  it("monthly: full_cents = remaining_months × monthly_cents, buyout = 50%", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW + 3 * AVG_MONTH_MS,
      billing_cadence: "monthly",
      monthly_cents: 200_000,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(3);
    expect(result.full_cents).toBe(600_000);
    expect(result.buyout_cents).toBe(300_000);
  });

  it("annual_monthly: same arithmetic as monthly (billed monthly under annual commitment)", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW + 6 * AVG_MONTH_MS,
      billing_cadence: "annual_monthly",
      monthly_cents: 150_000,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(6);
    expect(result.full_cents).toBe(900_000);
    expect(result.buyout_cents).toBe(450_000);
  });

  it("annual_upfront: full_cents + buyout_cents are zero (already prepaid)", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW + 9 * AVG_MONTH_MS,
      billing_cadence: "annual_upfront",
      monthly_cents: 250_000,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(9);
    expect(result.full_cents).toBe(0);
    expect(result.buyout_cents).toBe(0);
  });

  it("partial month rounds up (client owes through end of current cycle)", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW + 2 * AVG_MONTH_MS + 100_000,
      billing_cadence: "monthly",
      monthly_cents: 100_000,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(3);
    expect(result.full_cents).toBe(300_000);
  });

  it("commitment already lapsed: clamps to zero remaining_months + zero charges", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW - AVG_MONTH_MS,
      billing_cadence: "monthly",
      monthly_cents: 100_000,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    expect(result.remaining_months).toBe(0);
    expect(result.full_cents).toBe(0);
    expect(result.buyout_cents).toBe(0);
  });

  it("buyout_percentage is explicit (not defaulted inside the helper)", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW + 4 * AVG_MONTH_MS,
      billing_cadence: "monthly",
      monthly_cents: 100_000,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    expect(result.buyout_cents).toBe(200_000);
  });

  it("buyout rounds to the nearest cent", () => {
    const result = computeEarlyCancelRemainder({
      committed_until_date_ms: NOW + 1 * AVG_MONTH_MS,
      billing_cadence: "monthly",
      monthly_cents: 123_457,
      buyout_percentage: 50,
      now_ms: NOW,
    });
    // 123457 × 0.5 = 61728.5 → rounds to 61729
    expect(result.full_cents).toBe(123_457);
    expect(result.buyout_cents).toBe(61_729);
  });
});
