import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  ALL_EGGS,
  ADMIN_EGGS,
  PUBLIC_EGGS,
  getEggById,
} from "@/lib/eggs/registry";
import {
  evaluateAllTriggers,
  getRegisteredTriggers,
  type TriggerContext,
} from "@/lib/eggs/trigger-evaluator";
import { isSuppressed, type SuppressionContext } from "@/lib/eggs/suppression";
import {
  canFireAuthenticatedEgg,
  canFirePublicEgg,
  type CadenceState,
  type PublicCadenceState,
} from "@/lib/eggs/cadence";

import "@/lib/eggs/triggers";

const NOW = Date.now();
const MS_PER_DAY = 86_400_000;

function baseTriggerCtx(overrides: Partial<TriggerContext> = {}): TriggerContext {
  return {
    nowMs: NOW,
    localHour: 12,
    dayOfWeek: 3,
    referrer: "",
    dwellMs: 5_000,
    scrollDepth: 0.5,
    scrollDurationMs: 30_000,
    tabBackgroundedMs: 0,
    timezone: "America/New_York",
    visitCount: 1,
    sessionId: "sess_test",
    isMobile: false,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────
// 1. JSDoc data-access audit — spec discipline #20
// ────────────────────────────────────────────────────────

describe("JSDoc data-access audit blocks", () => {
  const REQUIRED_FIELDS = [
    "@egg",
    "@register",
    "@reads",
    "@does_not_read",
    "@cross_client_inference",
    "@evidence_fields",
  ];

  const publicTriggerDir = path.join(process.cwd(), "lib/eggs/triggers");
  const adminTriggerDir = path.join(process.cwd(), "lib/eggs/admin-triggers");

  const publicFiles = fs
    .readdirSync(publicTriggerDir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts");

  const adminFiles = fs
    .readdirSync(adminTriggerDir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts");

  for (const file of publicFiles) {
    it(`public trigger ${file} has all required JSDoc fields`, () => {
      const content = fs.readFileSync(path.join(publicTriggerDir, file), "utf8");
      for (const field of REQUIRED_FIELDS) {
        expect(content, `${file} missing ${field}`).toContain(field);
      }
    });
  }

  for (const file of adminFiles) {
    it(`admin trigger ${file} has all required JSDoc fields`, () => {
      const content = fs.readFileSync(path.join(adminTriggerDir, file), "utf8");
      for (const field of REQUIRED_FIELDS) {
        expect(content, `${file} missing ${field}`).toContain(field);
      }
    });
  }

  it("all public triggers declare @cross_client_inference false", () => {
    for (const file of publicFiles) {
      const content = fs.readFileSync(path.join(publicTriggerDir, file), "utf8");
      expect(content, `${file} should declare cross_client_inference false`).toContain(
        "@cross_client_inference false",
      );
    }
  });

  it("all public triggers declare they do not read authenticated-user data", () => {
    for (const file of publicFiles) {
      const content = fs.readFileSync(path.join(publicTriggerDir, file), "utf8");
      expect(
        content.includes("any authenticated-user data"),
        `${file} @does_not_read should include authenticated-user data exclusion`,
      ).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────
// 2. Registry ↔ trigger implementation alignment
// ────────────────────────────────────────────────────────

describe("Registry ↔ trigger alignment", () => {
  const registeredTriggerIds = getRegisteredTriggers().map((t) => t.eggId);

  it("every public registry egg has a registered trigger", () => {
    for (const egg of PUBLIC_EGGS) {
      expect(registeredTriggerIds, `missing trigger for ${egg.id}`).toContain(egg.id);
    }
  });

  it("no orphan triggers (every trigger has a registry entry)", () => {
    const registryIds = ALL_EGGS.map((e) => e.id);
    for (const triggerId of registeredTriggerIds) {
      if (triggerId === "test_egg") continue;
      expect(registryIds, `orphan trigger ${triggerId}`).toContain(triggerId);
    }
  });

  it("all egg IDs are unique", () => {
    const ids = ALL_EGGS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every egg with exemptFromBudget=true is structural", () => {
    const exempt = ALL_EGGS.filter((e) => e.exemptFromBudget);
    expect(exempt.length).toBeGreaterThan(0);
    for (const egg of exempt) {
      expect(
        ["public_crt_turn_off"].includes(egg.id),
        `unexpected exempt egg: ${egg.id}`,
      ).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────
// 3. Cross-cutting trigger evaluation — all 12 public
// ────────────────────────────────────────────────────────

describe("Public trigger evaluation — matching contexts", () => {
  it("late_night_visitor fires at 3am", () => {
    const ctx = baseTriggerCtx({ localHour: 3 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "late_night_visitor")).toBeDefined();
  });

  it("late_night_visitor does not fire at noon", () => {
    const ctx = baseTriggerCtx({ localHour: 12 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "late_night_visitor")).toBeUndefined();
  });

  it("sunday_researcher fires on Sunday with search referrer and 45s+ dwell", () => {
    const ctx = baseTriggerCtx({
      dayOfWeek: 0,
      referrer: "https://www.google.com/search?q=marketing+agency",
      dwellMs: 50_000,
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "sunday_researcher")).toBeDefined();
  });

  it("sunday_researcher does not fire on Monday", () => {
    const ctx = baseTriggerCtx({
      dayOfWeek: 1,
      referrer: "https://www.google.com/search?q=marketing",
      dwellMs: 50_000,
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "sunday_researcher")).toBeUndefined();
  });

  it("sunday_researcher does not fire without search engine referrer", () => {
    const ctx = baseTriggerCtx({
      dayOfWeek: 0,
      referrer: "https://twitter.com",
      dwellMs: 50_000,
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "sunday_researcher")).toBeUndefined();
  });

  it("fifth_time_visitor fires on exactly visit 5", () => {
    const ctx = baseTriggerCtx({ visitCount: 5 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "fifth_time_visitor")).toBeDefined();
  });

  it("fifth_time_visitor does not fire on visit 4 or 6", () => {
    expect(
      evaluateAllTriggers(baseTriggerCtx({ visitCount: 4 })).find(
        (r) => r.eggId === "fifth_time_visitor",
      ),
    ).toBeUndefined();
    expect(
      evaluateAllTriggers(baseTriggerCtx({ visitCount: 6 })).find(
        (r) => r.eggId === "fifth_time_visitor",
      ),
    ).toBeUndefined();
  });

  it("returning_visitor fires on visit 2-4 and 6+", () => {
    for (const count of [2, 3, 4, 6, 10]) {
      const results = evaluateAllTriggers(baseTriggerCtx({ visitCount: count }));
      expect(
        results.find((r) => r.eggId === "returning_visitor"),
        `should fire on visit ${count}`,
      ).toBeDefined();
    }
  });

  it("returning_visitor does not fire on visit 1 or 5", () => {
    expect(
      evaluateAllTriggers(baseTriggerCtx({ visitCount: 1 })).find(
        (r) => r.eggId === "returning_visitor",
      ),
    ).toBeUndefined();
    expect(
      evaluateAllTriggers(baseTriggerCtx({ visitCount: 5 })).find(
        (r) => r.eggId === "returning_visitor",
      ),
    ).toBeUndefined();
  });

  it("linkedin_referrer fires on LinkedIn referrer", () => {
    const ctx = baseTriggerCtx({ referrer: "https://www.linkedin.com/feed" });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "linkedin_referrer")).toBeDefined();
  });

  it("linkedin_referrer fires on lnkd.in shortlink", () => {
    const ctx = baseTriggerCtx({ referrer: "https://lnkd.in/abc123" });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "linkedin_referrer")).toBeDefined();
  });

  it("google_intent_cheap fires on 'cheap' in referrer query", () => {
    const ctx = baseTriggerCtx({
      referrer: "https://www.google.com/search?q=cheap+marketing+agency",
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "google_intent_cheap")).toBeDefined();
  });

  it("google_intent_cheap does not fire without cheap terms", () => {
    const ctx = baseTriggerCtx({
      referrer: "https://www.google.com/search?q=best+marketing+agency",
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "google_intent_cheap")).toBeUndefined();
  });

  it("rapid_scroller fires on fast full-page scroll", () => {
    const ctx = baseTriggerCtx({ scrollDepth: 0.95, scrollDurationMs: 4_000 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "rapid_scroller")).toBeDefined();
  });

  it("rapid_scroller does not fire on slow scroll", () => {
    const ctx = baseTriggerCtx({ scrollDepth: 0.95, scrollDurationMs: 30_000 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "rapid_scroller")).toBeUndefined();
  });

  it("deep_reader fires on 4min+ dwell with 70%+ scroll", () => {
    const ctx = baseTriggerCtx({ dwellMs: 300_000, scrollDepth: 0.8 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "deep_reader")).toBeDefined();
  });

  it("deep_reader does not fire under 4min dwell", () => {
    const ctx = baseTriggerCtx({ dwellMs: 200_000, scrollDepth: 0.8 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "deep_reader")).toBeUndefined();
  });

  it("abandoned_tab fires on 10min+ background", () => {
    const ctx = baseTriggerCtx({ tabBackgroundedMs: 700_000 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "abandoned_tab")).toBeDefined();
  });

  it("abandoned_tab does not fire under 10min", () => {
    const ctx = baseTriggerCtx({ tabBackgroundedMs: 300_000 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "abandoned_tab")).toBeUndefined();
  });

  it("melbourne_rain fires with Melbourne timezone and precipitation", () => {
    const ctx = baseTriggerCtx({
      timezone: "Australia/Melbourne",
      weatherPrecipitationMm: 2.5,
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "melbourne_rain")).toBeDefined();
  });

  it("melbourne_rain does not fire for non-Melbourne timezone", () => {
    const ctx = baseTriggerCtx({
      timezone: "America/New_York",
      weatherPrecipitationMm: 5.0,
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "melbourne_rain")).toBeUndefined();
  });

  it("public_crt_turn_off fires in Melbourne late night with 3min+ dwell", () => {
    const ctx = baseTriggerCtx({
      melbourneHour: 2,
      dwellMs: 200_000,
      firedEggIdsInSession: [],
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "public_crt_turn_off")).toBeDefined();
  });

  it("public_crt_turn_off suppressed if late_night_visitor already fired", () => {
    const ctx = baseTriggerCtx({
      melbourneHour: 2,
      dwellMs: 200_000,
      firedEggIdsInSession: ["late_night_visitor"],
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "public_crt_turn_off")).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────
// 4. Cadence budget edge cases
// ────────────────────────────────────────────────────────

describe("Cadence budget edge cases", () => {
  it("public first-egg guarantee bypasses all budgets", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: false,
    };
    const egg = getEggById("late_night_visitor")!;
    expect(canFirePublicEgg(egg, state, NOW, 14)).toBe(true);
  });

  it("public 2-per-14-day budget blocks third non-exempt egg", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: NOW - 5 * MS_PER_DAY,
      lastHiddenEggFiredAt: NOW - 1 * MS_PER_DAY,
      firedEggIds: ["late_night_visitor", "linkedin_referrer"],
      tricksDisabled: false,
    };
    const egg = getEggById("abandoned_tab")!;
    expect(canFirePublicEgg(egg, state, NOW, 14)).toBe(false);
  });

  it("budget-exempt egg fires even when budget is exhausted", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: NOW - 5 * MS_PER_DAY,
      lastHiddenEggFiredAt: NOW - 1 * MS_PER_DAY,
      firedEggIds: ["late_night_visitor", "linkedin_referrer"],
      tricksDisabled: false,
    };
    const crtPublic = getEggById("public_crt_turn_off")!;
    expect(canFirePublicEgg(crtPublic, state, NOW, 14)).toBe(true);
  });

  it("one-shot egg (Infinity cooldown) blocks after first fire", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: NOW - 30 * MS_PER_DAY,
      lastHiddenEggFiredAt: NOW - 20 * MS_PER_DAY,
      firedEggIds: ["sunday_researcher"],
      tricksDisabled: false,
    };
    const egg = getEggById("sunday_researcher")!;
    expect(canFirePublicEgg(egg, state, NOW, 14)).toBe(false);
  });

  it("authenticated 7-day cadence blocks within window", () => {
    const egg = getEggById("crt_turn_off")!;
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: NOW - 3 * MS_PER_DAY,
      firedEggIdsRecent: [],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(false);
  });

  it("authenticated cadence allows after window expires", () => {
    const egg = getEggById("weekend_warrior")!;
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: NOW - 8 * MS_PER_DAY,
      firedEggIdsRecent: [],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(true);
  });

  it("first_client_won one-shot blocks if already in recent list", () => {
    const egg = getEggById("first_client_won")!;
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: NOW - 90 * MS_PER_DAY,
      firedEggIdsRecent: ["first_client_won"],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// 5. Kill switch end-to-end
// ────────────────────────────────────────────────────────

describe("Kill switch blocks all eggs", () => {
  it("authenticated: tricks disabled blocks every admin egg", () => {
    for (const egg of ADMIN_EGGS) {
      const state: CadenceState = {
        actorType: "admin",
        lastHiddenEggFiredAtMs: null,
        firedEggIdsRecent: [],
        tricksEnabled: false,
      };
      expect(
        canFireAuthenticatedEgg(egg, state, NOW, 7),
        `${egg.id} should be blocked when tricks disabled`,
      ).toBe(false);
    }
  });

  it("public: tricks disabled blocks every public egg", () => {
    for (const egg of PUBLIC_EGGS) {
      const state: PublicCadenceState = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: true,
      };
      expect(
        canFirePublicEgg(egg, state, NOW, 14),
        `${egg.id} should be blocked when tricks disabled`,
      ).toBe(false);
    }
  });
});

// ────────────────────────────────────────────────────────
// 6. Suppression gate completeness
// ────────────────────────────────────────────────────────

describe("Suppression gates — all 7 conditions", () => {
  const clear: SuppressionContext = {
    isPaymentElementMounted: false,
    isEmailComposeFocused: false,
    isQuoteAcceptanceFlow: false,
    isErrorPage: false,
    isOnboardingWizard: false,
    isFirstEverLogin: false,
    sessionAgeMs: 60_000,
  };

  it("no suppression when all clear", () => {
    expect(isSuppressed(clear)).toBe(false);
  });

  const gates: Array<{ key: keyof SuppressionContext; label: string }> = [
    { key: "isPaymentElementMounted", label: "mid-payment" },
    { key: "isEmailComposeFocused", label: "mid-email-compose" },
    { key: "isQuoteAcceptanceFlow", label: "quote acceptance" },
    { key: "isErrorPage", label: "error page" },
    { key: "isOnboardingWizard", label: "onboarding wizard" },
    { key: "isFirstEverLogin", label: "first-ever login" },
  ];

  for (const gate of gates) {
    it(`suppresses during ${gate.label}`, () => {
      expect(isSuppressed({ ...clear, [gate.key]: true })).toBe(true);
    });
  }

  it("suppresses in first 30 seconds of session", () => {
    expect(isSuppressed({ ...clear, sessionAgeMs: 15_000 })).toBe(true);
  });

  it("allows at exactly 30 seconds", () => {
    expect(isSuppressed({ ...clear, sessionAgeMs: 30_000 })).toBe(false);
  });

  it("multiple gates active still suppresses", () => {
    expect(
      isSuppressed({
        ...clear,
        isPaymentElementMounted: true,
        isErrorPage: true,
      }),
    ).toBe(true);
  });
});

// ────────────────────────────────────────────────────────
// 7. Evidence fields non-null (spec discipline #21)
// ────────────────────────────────────────────────────────

describe("Evidence fields are always non-null on match", () => {
  it("every matching trigger returns an object, never null evidence fields", () => {
    const triggerScenarios: Array<{ eggId: string; ctx: Partial<TriggerContext> }> = [
      { eggId: "late_night_visitor", ctx: { localHour: 3 } },
      {
        eggId: "sunday_researcher",
        ctx: {
          dayOfWeek: 0,
          referrer: "https://google.com/search?q=test",
          dwellMs: 50_000,
        },
      },
      { eggId: "fifth_time_visitor", ctx: { visitCount: 5 } },
      { eggId: "returning_visitor", ctx: { visitCount: 3 } },
      { eggId: "linkedin_referrer", ctx: { referrer: "https://linkedin.com/feed" } },
      {
        eggId: "google_intent_cheap",
        ctx: { referrer: "https://google.com/search?q=cheap+agency" },
      },
      { eggId: "rapid_scroller", ctx: { scrollDepth: 0.95, scrollDurationMs: 3_000 } },
      { eggId: "deep_reader", ctx: { dwellMs: 300_000, scrollDepth: 0.8 } },
      { eggId: "abandoned_tab", ctx: { tabBackgroundedMs: 700_000 } },
      {
        eggId: "melbourne_rain",
        ctx: { timezone: "Australia/Melbourne", weatherPrecipitationMm: 2.5 },
      },
      {
        eggId: "public_crt_turn_off",
        ctx: { melbourneHour: 2, dwellMs: 200_000, firedEggIdsInSession: [] },
      },
    ];

    for (const scenario of triggerScenarios) {
      const ctx = baseTriggerCtx(scenario.ctx);
      const results = evaluateAllTriggers(ctx);
      const match = results.find((r) => r.eggId === scenario.eggId);
      expect(match, `${scenario.eggId} should fire`).toBeDefined();
      expect(match!.evidence, `${scenario.eggId} evidence should be an object`).toBeTruthy();
      expect(
        typeof match!.evidence,
        `${scenario.eggId} evidence should be an object`,
      ).toBe("object");

      const evidenceValues = Object.values(match!.evidence);
      for (const val of evidenceValues) {
        expect(
          val !== null && val !== undefined,
          `${scenario.eggId} has null/undefined evidence field`,
        ).toBe(true);
      }
    }
  });
});

// ────────────────────────────────────────────────────────
// 8. Fail-closed: triggers return null on edge-case inputs
// ────────────────────────────────────────────────────────

describe("Fail-closed on edge-case inputs", () => {
  it("no triggers fire on a completely neutral context", () => {
    const ctx = baseTriggerCtx();
    const results = evaluateAllTriggers(ctx);
    const publicEggIds = PUBLIC_EGGS.map((e) => e.id);
    const publicFired = results.filter((r) => publicEggIds.includes(r.eggId));
    expect(publicFired).toHaveLength(0);
  });

  it("google_intent_cheap handles malformed referrer URL gracefully", () => {
    const ctx = baseTriggerCtx({ referrer: "not-a-url" });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "google_intent_cheap")).toBeUndefined();
  });

  it("rapid_scroller rejects zero scroll duration", () => {
    const ctx = baseTriggerCtx({ scrollDepth: 1.0, scrollDurationMs: 0 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "rapid_scroller")).toBeUndefined();
  });

  it("melbourne_rain fails closed with null precipitation", () => {
    const ctx = baseTriggerCtx({
      timezone: "Australia/Melbourne",
      weatherPrecipitationMm: null,
    });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "melbourne_rain")).toBeUndefined();
  });

  it("public_crt_turn_off fails closed without melbourneHour", () => {
    const ctx = baseTriggerCtx({ dwellMs: 200_000 });
    const results = evaluateAllTriggers(ctx);
    expect(results.find((r) => r.eggId === "public_crt_turn_off")).toBeUndefined();
  });
});
