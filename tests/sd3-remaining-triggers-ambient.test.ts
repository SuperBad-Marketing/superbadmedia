import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TriggerContext } from "@/lib/eggs/trigger-evaluator";

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    llm_calls_enabled: false,
    drift_check_enabled: false,
    scheduled_tasks_enabled: false,
  },
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue("placeholder line for testing."),
}));

vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: vi.fn().mockResolvedValue({ pass: true, score: 0.85, notes: "mock" }),
}));

vi.mock("@/lib/quote-builder/superbad-brand-profile", () => ({
  getSuperbadBrandProfile: vi.fn().mockResolvedValue({
    voiceDescription: "Dry, observational",
    toneMarkers: ["dry"],
    avoidWords: ["synergy"],
    targetAudience: "Australian SMBs",
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(30),
  },
}));

import { evaluateAllTriggers } from "@/lib/eggs/trigger-evaluator";

import "@/lib/eggs/triggers";

function baseTriggerContext(overrides: Partial<TriggerContext> = {}): TriggerContext {
  return {
    nowMs: Date.now(),
    localHour: 10,
    dayOfWeek: 3,
    referrer: "",
    dwellMs: 5000,
    scrollDepth: 0.3,
    scrollDurationMs: 30_000,
    tabBackgroundedMs: 0,
    timezone: "Australia/Melbourne",
    visitCount: 1,
    sessionId: "test-session",
    isMobile: false,
    ...overrides,
  };
}

// --- Melbourne Public Holiday ---

describe("melbourne_public_holiday trigger", () => {
  it("fires when holidayName is present", () => {
    const ctx = baseTriggerContext({
      melbourneDateISO: "2026-04-25",
      holidayName: "ANZAC Day",
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_public_holiday");
    expect(match).toBeDefined();
    expect(match!.evidence.holidayName).toBe("ANZAC Day");
  });

  it("does not fire when holidayName is null", () => {
    const ctx = baseTriggerContext({
      melbourneDateISO: "2026-04-22",
      holidayName: null,
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_public_holiday");
    expect(match).toBeUndefined();
  });

  it("does not fire when holidayName is not provided", () => {
    const ctx = baseTriggerContext({});
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_public_holiday");
    expect(match).toBeUndefined();
  });
});

// --- Melbourne Rain ---

describe("melbourne_rain trigger", () => {
  it("fires for Melbourne timezone with precipitation > 0", () => {
    const ctx = baseTriggerContext({
      timezone: "Australia/Melbourne",
      weatherPrecipitationMm: 2.5,
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_rain");
    expect(match).toBeDefined();
    expect(match!.evidence.weatherPrecipitationMm).toBe(2.5);
  });

  it("does not fire for non-Melbourne timezone", () => {
    const ctx = baseTriggerContext({
      timezone: "America/New_York",
      weatherPrecipitationMm: 5.0,
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_rain");
    expect(match).toBeUndefined();
  });

  it("does not fire when precipitation is 0", () => {
    const ctx = baseTriggerContext({
      timezone: "Australia/Melbourne",
      weatherPrecipitationMm: 0,
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_rain");
    expect(match).toBeUndefined();
  });

  it("does not fire when precipitation is null", () => {
    const ctx = baseTriggerContext({
      timezone: "Australia/Melbourne",
      weatherPrecipitationMm: null,
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_rain");
    expect(match).toBeUndefined();
  });

  it("fires for Sydney timezone (same AEST region)", () => {
    const ctx = baseTriggerContext({
      timezone: "Australia/Sydney",
      weatherPrecipitationMm: 1.0,
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "melbourne_rain");
    expect(match).toBeDefined();
  });
});

// --- Public CRT Turn-Off ---

describe("public_crt_turn_off trigger", () => {
  it("fires during Melbourne 01:00-04:59 with 3+ min dwell and no late-night egg", () => {
    const ctx = baseTriggerContext({
      melbourneHour: 2,
      dwellMs: 200_000,
      firedEggIdsInSession: [],
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(match).toBeDefined();
    expect(match!.evidence.melbourneHour).toBe(2);
  });

  it("does not fire before 01:00 Melbourne", () => {
    const ctx = baseTriggerContext({
      melbourneHour: 0,
      dwellMs: 200_000,
      firedEggIdsInSession: [],
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(match).toBeUndefined();
  });

  it("does not fire at 05:00 Melbourne", () => {
    const ctx = baseTriggerContext({
      melbourneHour: 5,
      dwellMs: 200_000,
      firedEggIdsInSession: [],
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(match).toBeUndefined();
  });

  it("does not fire with dwell under 3 minutes", () => {
    const ctx = baseTriggerContext({
      melbourneHour: 3,
      dwellMs: 170_000,
      firedEggIdsInSession: [],
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(match).toBeUndefined();
  });

  it("does not fire if late_night_visitor already fired in session", () => {
    const ctx = baseTriggerContext({
      melbourneHour: 3,
      dwellMs: 200_000,
      firedEggIdsInSession: ["late_night_visitor"],
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(match).toBeUndefined();
  });

  it("does not fire when melbourneHour is not provided", () => {
    const ctx = baseTriggerContext({
      dwellMs: 200_000,
      firedEggIdsInSession: [],
    });
    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(match).toBeUndefined();
  });
});

// --- Melbourne Holidays Helper ---

describe("melbourne-holidays helper", () => {
  it("returns holiday name for a known date", async () => {
    const { getHolidayName } = await import("@/lib/eggs/melbourne-holidays");
    const name = getHolidayName("2026-04-25");
    expect(name).toBe("ANZAC Day");
  });

  it("returns null for a non-holiday date", async () => {
    const { getHolidayName } = await import("@/lib/eggs/melbourne-holidays");
    const name = getHolidayName("2026-04-22");
    expect(name).toBeNull();
  });

  it("getMelbourneDateISO returns a valid date string", async () => {
    const { getMelbourneDateISO } = await import("@/lib/eggs/melbourne-holidays");
    const dateISO = getMelbourneDateISO(Date.now());
    expect(dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getMelbourneHour returns a number 0-23", async () => {
    const { getMelbourneHour } = await import("@/lib/eggs/melbourne-holidays");
    const hour = getMelbourneHour(Date.now());
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });
});

// --- Trigger registration count ---

describe("trigger registration", () => {
  it("has 12 public triggers registered (9 from SD-2 + 3 from SD-3)", async () => {
    const { getRegisteredTriggers } = await import("@/lib/eggs/trigger-evaluator");
    const triggers = getRegisteredTriggers();
    expect(triggers.length).toBe(12);
  });
});
