/**
 * SP-2: validateDeal() unit tests. Pure function — no DB.
 */
import { describe, it, expect } from "vitest";
import type { DealRow } from "@/lib/db/schema/deals";
import { validateDeal } from "@/lib/crm/validate-deal";

function base(overrides: Partial<DealRow> = {}): Pick<
  DealRow,
  "stage" | "won_outcome" | "loss_reason" | "loss_notes"
> {
  return {
    stage: "lead",
    won_outcome: null,
    loss_reason: null,
    loss_notes: null,
    ...overrides,
  };
}

describe("validateDeal", () => {
  it("passes on non-terminal stages without outcome fields", () => {
    for (const stage of [
      "lead",
      "contacted",
      "conversation",
      "trial_shoot",
      "quoted",
      "negotiating",
    ] as const) {
      expect(validateDeal(base({ stage })).ok).toBe(true);
    }
  });

  it("rejects 'won' without won_outcome", () => {
    const result = validateDeal(base({ stage: "won" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/won_outcome/);
    }
  });

  it("passes 'won' with won_outcome set", () => {
    expect(
      validateDeal(base({ stage: "won", won_outcome: "retainer" })).ok,
    ).toBe(true);
  });

  it("rejects 'lost' without loss_reason", () => {
    const result = validateDeal(base({ stage: "lost" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/loss_reason/);
    }
  });

  it("passes 'lost' with loss_reason set (non-other)", () => {
    expect(
      validateDeal(base({ stage: "lost", loss_reason: "price" })).ok,
    ).toBe(true);
  });

  it("rejects 'lost' with loss_reason='other' but no loss_notes", () => {
    const result = validateDeal(
      base({ stage: "lost", loss_reason: "other" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /loss_notes/.test(e))).toBe(true);
    }
  });

  it("passes 'lost' with loss_reason='other' and loss_notes populated", () => {
    expect(
      validateDeal(
        base({
          stage: "lost",
          loss_reason: "other",
          loss_notes: "Went dark after the third follow-up.",
        }),
      ).ok,
    ).toBe(true);
  });
});
