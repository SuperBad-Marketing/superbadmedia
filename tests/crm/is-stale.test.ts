/**
 * SP-3: isDealStale() unit tests. Pure function — no DB.
 */
import { describe, it, expect } from "vitest";
import { isDealStale, type PipelineStaleThresholds } from "@/lib/crm/is-stale";
import type { DealStage } from "@/lib/db/schema/deals";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const thresholds: PipelineStaleThresholds = {
  lead_days: 14,
  contacted_days: 5,
  conversation_days: 7,
  trial_shoot_days: 14,
  quoted_days: 5,
  negotiating_days: 3,
};

const deal = (
  stage: DealStage,
  daysInStage: number,
  snoozedUntilMs: number | null = null,
) => ({
  stage,
  last_stage_change_at_ms: NOW - daysInStage * DAY,
  snoozed_until_ms: snoozedUntilMs,
});

describe("isDealStale — per-stage thresholds", () => {
  const cases: Array<[DealStage, number]> = [
    ["lead", 14],
    ["contacted", 5],
    ["conversation", 7],
    ["trial_shoot", 14],
    ["quoted", 5],
    ["negotiating", 3],
  ];

  for (const [stage, days] of cases) {
    it(`${stage}: below threshold (${days - 1}d) → not stale`, () => {
      expect(isDealStale(deal(stage, days - 1), thresholds, NOW)).toBe(false);
    });

    it(`${stage}: at threshold (${days}d) → not stale (strictly greater)`, () => {
      expect(isDealStale(deal(stage, days), thresholds, NOW)).toBe(false);
    });

    it(`${stage}: past threshold (${days + 1}d) → stale`, () => {
      expect(isDealStale(deal(stage, days + 1), thresholds, NOW)).toBe(true);
    });
  }
});

describe("isDealStale — terminal stages", () => {
  it("won is never stale, even after 99 days", () => {
    expect(isDealStale(deal("won", 99), thresholds, NOW)).toBe(false);
  });
  it("lost is never stale, even after 99 days", () => {
    expect(isDealStale(deal("lost", 99), thresholds, NOW)).toBe(false);
  });
});

describe("isDealStale — snooze suppression", () => {
  it("future snooze suppresses halo on an otherwise-stale deal", () => {
    expect(
      isDealStale(deal("lead", 30, NOW + 3 * DAY), thresholds, NOW),
    ).toBe(false);
  });

  it("expired snooze does not suppress — stale deal is stale again", () => {
    expect(
      isDealStale(deal("lead", 30, NOW - 1 * DAY), thresholds, NOW),
    ).toBe(true);
  });

  it("future snooze on a non-stale deal is still not stale", () => {
    expect(
      isDealStale(deal("lead", 3, NOW + 3 * DAY), thresholds, NOW),
    ).toBe(false);
  });
});

describe("isDealStale — defensive inputs", () => {
  it("nullish last_stage_change_at_ms returns false", () => {
    expect(
      isDealStale(
        { stage: "lead", last_stage_change_at_ms: null, snoozed_until_ms: null },
        thresholds,
        NOW,
      ),
    ).toBe(false);
  });
});
