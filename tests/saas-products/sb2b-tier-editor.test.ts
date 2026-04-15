/**
 * SB-2b — tier-editor pure helpers (validateTiers + reconcileTierLimits).
 */
import { describe, it, expect } from "vitest";
import {
  emptyTiersState,
  reconcileTierLimits,
  validateTiers,
  type TierRowState,
} from "@/app/lite/setup/admin/[key]/clients/tier-editor-step-client";

const dims = [
  { tempId: "d0", key: "api_calls", displayName: "API calls" },
  { tempId: "d1", key: "active_campaigns", displayName: "Active campaigns" },
];

describe("emptyTiersState", () => {
  it("returns 3 rows with ranks 1/2/3 and default names", () => {
    const s = emptyTiersState();
    expect(s.tiers.map((t) => t.tierRank)).toEqual([1, 2, 3]);
    expect(s.tiers.map((t) => t.name)).toEqual(["Small", "Medium", "Large"]);
  });
});

describe("reconcileTierLimits", () => {
  it("adds missing dimension rows with default {value:0, unlimited:false}", () => {
    const reconciled = reconcileTierLimits(emptyTiersState().tiers, dims);
    for (const t of reconciled) {
      expect(Object.keys(t.limits).sort()).toEqual(["d0", "d1"]);
      expect(t.limits.d0).toEqual({ value: 0, unlimited: false });
    }
  });

  it("preserves existing limits for kept dimensions and drops removed ones", () => {
    const seed: TierRowState[] = emptyTiersState().tiers.map((t) => ({
      ...t,
      limits: {
        d0: { value: 99, unlimited: false },
        gone: { value: 7, unlimited: true },
      },
    }));
    const reconciled = reconcileTierLimits(seed, [dims[0]]);
    expect(reconciled[0].limits).toEqual({
      d0: { value: 99, unlimited: false },
    });
  });
});

describe("validateTiers", () => {
  it("accepts a clean state", () => {
    const state = { tiers: reconcileTierLimits(emptyTiersState().tiers, dims) };
    expect(validateTiers(state)).toEqual({ ok: true });
  });

  it("rejects a blank tier name", () => {
    const state = { tiers: reconcileTierLimits(emptyTiersState().tiers, dims) };
    state.tiers[1].name = "   ";
    const r = validateTiers(state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/tier 2/i);
  });

  it("rejects a negative finite limit", () => {
    const state = { tiers: reconcileTierLimits(emptyTiersState().tiers, dims) };
    state.tiers[0].limits.d0 = { value: -1, unlimited: false };
    const r = validateTiers(state);
    expect(r.ok).toBe(false);
  });

  it("allows unlimited (ignores value when unlimited=true)", () => {
    const state = { tiers: reconcileTierLimits(emptyTiersState().tiers, dims) };
    state.tiers[2].limits.d0 = { value: -999, unlimited: true };
    expect(validateTiers(state)).toEqual({ ok: true });
  });
});
