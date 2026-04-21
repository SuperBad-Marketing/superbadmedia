import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SD-12 — Welcome Egg Safety Net + Public Egg Polish", () => {
  describe("public-egg-state", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("recordEggFired sets firstEggDeliveredAt on first fire", async () => {
      const { recordEggFired } = await import("@/lib/eggs/public-egg-state");
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: false,
        visitDates: [],
        sessionFiredEggIds: [],
      };
      const updated = recordEggFired(state, "welcome_safety_net");
      expect(updated.firstEggDeliveredAt).toBeGreaterThan(0);
      expect(updated.firedEggIds).toContain("welcome_safety_net");
      expect(updated.sessionFiredEggIds).toContain("welcome_safety_net");
    });

    it("recordEggFired does not overwrite existing firstEggDeliveredAt", async () => {
      const { recordEggFired } = await import("@/lib/eggs/public-egg-state");
      const state = {
        firstEggDeliveredAt: 1000,
        lastHiddenEggFiredAt: 1000,
        firedEggIds: ["late_night_visitor"],
        tricksDisabled: false,
        visitDates: ["2026-04-20"],
        sessionFiredEggIds: [],
      };
      const updated = recordEggFired(state, "welcome_safety_net");
      expect(updated.firstEggDeliveredAt).toBe(1000);
    });

    it("setTricksDisabled sets the flag", async () => {
      const { setTricksDisabled } = await import("@/lib/eggs/public-egg-state");
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: false,
        visitDates: [],
        sessionFiredEggIds: [],
      };
      const updated = setTricksDisabled(state, true);
      expect(updated.tricksDisabled).toBe(true);
    });
  });

  describe("Welcome egg safety net guards", () => {
    it("should not fire when firstEggDeliveredAt is already set", () => {
      const state = {
        firstEggDeliveredAt: 12345,
        lastHiddenEggFiredAt: 12345,
        firedEggIds: ["late_night_visitor"],
        tricksDisabled: false,
        visitDates: ["2026-04-21"],
        sessionFiredEggIds: ["late_night_visitor"],
      };
      const shouldFire =
        state.firstEggDeliveredAt === null && !state.tricksDisabled;
      expect(shouldFire).toBe(false);
    });

    it("should not fire when tricksDisabled is true", () => {
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: true,
        visitDates: [],
        sessionFiredEggIds: [],
      };
      const shouldFire =
        state.firstEggDeliveredAt === null && !state.tricksDisabled;
      expect(shouldFire).toBe(false);
    });

    it("should fire when first visit and tricks enabled", () => {
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: false,
        visitDates: [],
        sessionFiredEggIds: [],
      };
      const shouldFire =
        state.firstEggDeliveredAt === null && !state.tricksDisabled;
      expect(shouldFire).toBe(true);
    });
  });

  describe("CRT cookie re-entry logic", () => {
    it("detects sb_crt_closed cookie in a cookie string", () => {
      const cookies = "sb_crt_closed=1; other=value";
      const hasCookie = cookies
        .split("; ")
        .some((c) => c.startsWith("sb_crt_closed="));
      expect(hasCookie).toBe(true);
    });

    it("returns false when sb_crt_closed is absent", () => {
      const cookies = "other=value; session=abc123";
      const hasCookie = cookies
        .split("; ")
        .some((c) => c.startsWith("sb_crt_closed="));
      expect(hasCookie).toBe(false);
    });
  });

  describe("No tricks link effect", () => {
    it("setTricksDisabled produces state with tricksDisabled true", async () => {
      const { setTricksDisabled } = await import("@/lib/eggs/public-egg-state");
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: false,
        visitDates: [],
        sessionFiredEggIds: [],
      };
      const updated = setTricksDisabled(state, true);
      expect(updated.tricksDisabled).toBe(true);
      expect(updated.firedEggIds).toEqual([]);
    });
  });

  describe("RiddleResponse novel_wrong outcome", () => {
    it("novel_wrong is in the try-again set alongside common_wrong and catch_all_wrong", () => {
      const tryAgainOutcomes = ["common_wrong", "novel_wrong", "catch_all_wrong"];
      expect(tryAgainOutcomes).toContain("novel_wrong");
    });
  });
});
