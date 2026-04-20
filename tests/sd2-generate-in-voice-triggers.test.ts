import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TriggerContext } from "@/lib/eggs/trigger-evaluator";

// Mock kill-switches before importing
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

// Must import after mocks
import { generateInVoice } from "@/lib/eggs/generate-in-voice";
import { evaluateAllTriggers, getRegisteredTriggers } from "@/lib/eggs/trigger-evaluator";

// Import triggers to register them
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

describe("generateInVoice", () => {
  it("returns placeholder when llm_calls_enabled is false", async () => {
    const result = await generateInVoice({
      slot: "empty_state",
      context: {},
    });
    expect(result.text).toBe("[voice placeholder: empty_state]");
    expect(result.driftCheckScore).toBeNull();
    expect(result.passedDriftCheck).toBe(true);
  });

  it("calls LLM when kill switch is enabled", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;

    const result = await generateInVoice({
      slot: "success_toast",
      context: { action: "quote_sent" },
    });
    expect(result.text).toBe("placeholder line for testing.");
    expect(result.driftCheckScore).toBe(0.85);
    expect(result.passedDriftCheck).toBe(true);

    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;
  });
});

describe("trigger registrations", () => {
  it("registers 9 public triggers", () => {
    const triggers = getRegisteredTriggers();
    expect(triggers.length).toBeGreaterThanOrEqual(9);
  });

  describe("late_night_visitor", () => {
    it("fires at 3am", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ localHour: 3 }));
      const match = results.find((r) => r.eggId === "late_night_visitor");
      expect(match).toBeDefined();
      expect(match!.evidence.localHour).toBe(3);
    });

    it("does not fire at 10am", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ localHour: 10 }));
      const match = results.find((r) => r.eggId === "late_night_visitor");
      expect(match).toBeUndefined();
    });
  });

  describe("sunday_researcher", () => {
    it("fires on Sunday with search referrer and 45s+ dwell", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({
          dayOfWeek: 0,
          referrer: "https://www.google.com/search?q=marketing+agency",
          dwellMs: 60_000,
        }),
      );
      const match = results.find((r) => r.eggId === "sunday_researcher");
      expect(match).toBeDefined();
    });

    it("does not fire on Monday", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({
          dayOfWeek: 1,
          referrer: "https://www.google.com/search?q=marketing",
          dwellMs: 60_000,
        }),
      );
      const match = results.find((r) => r.eggId === "sunday_researcher");
      expect(match).toBeUndefined();
    });

    it("does not fire with dwell under 45s", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({
          dayOfWeek: 0,
          referrer: "https://www.google.com/search?q=marketing",
          dwellMs: 30_000,
        }),
      );
      const match = results.find((r) => r.eggId === "sunday_researcher");
      expect(match).toBeUndefined();
    });
  });

  describe("linkedin_referrer", () => {
    it("fires with LinkedIn referrer", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ referrer: "https://www.linkedin.com/feed" }),
      );
      const match = results.find((r) => r.eggId === "linkedin_referrer");
      expect(match).toBeDefined();
    });

    it("fires with lnkd.in referrer", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ referrer: "https://lnkd.in/abc123" }),
      );
      const match = results.find((r) => r.eggId === "linkedin_referrer");
      expect(match).toBeDefined();
    });

    it("does not fire with Google referrer", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ referrer: "https://www.google.com/search" }),
      );
      const match = results.find((r) => r.eggId === "linkedin_referrer");
      expect(match).toBeUndefined();
    });
  });

  describe("google_intent_cheap", () => {
    it("fires when search query contains 'cheap'", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({
          referrer: "https://www.google.com/search?q=cheap+marketing+agency+melbourne",
        }),
      );
      const match = results.find((r) => r.eggId === "google_intent_cheap");
      expect(match).toBeDefined();
      expect(match!.evidence.matchedTerm).toBe("cheap");
    });

    it("fires when search query contains 'budget'", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({
          referrer: "https://www.google.com/search?q=budget+marketing",
        }),
      );
      const match = results.find((r) => r.eggId === "google_intent_cheap");
      expect(match).toBeDefined();
    });

    it("does not fire without cheap terms", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({
          referrer: "https://www.google.com/search?q=best+marketing+agency",
        }),
      );
      const match = results.find((r) => r.eggId === "google_intent_cheap");
      expect(match).toBeUndefined();
    });
  });

  describe("rapid_scroller", () => {
    it("fires when scrolled full page in under 6s", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ scrollDepth: 0.95, scrollDurationMs: 4_000 }),
      );
      const match = results.find((r) => r.eggId === "rapid_scroller");
      expect(match).toBeDefined();
    });

    it("does not fire at 7 seconds", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ scrollDepth: 0.95, scrollDurationMs: 7_000 }),
      );
      const match = results.find((r) => r.eggId === "rapid_scroller");
      expect(match).toBeUndefined();
    });

    it("does not fire with low scroll depth", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ scrollDepth: 0.5, scrollDurationMs: 3_000 }),
      );
      const match = results.find((r) => r.eggId === "rapid_scroller");
      expect(match).toBeUndefined();
    });
  });

  describe("deep_reader", () => {
    it("fires with 4+ min dwell and 70%+ scroll", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ dwellMs: 300_000, scrollDepth: 0.8 }),
      );
      const match = results.find((r) => r.eggId === "deep_reader");
      expect(match).toBeDefined();
    });

    it("does not fire with 3 min dwell", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ dwellMs: 180_000, scrollDepth: 0.8 }),
      );
      const match = results.find((r) => r.eggId === "deep_reader");
      expect(match).toBeUndefined();
    });
  });

  describe("abandoned_tab", () => {
    it("fires after 10+ min background", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ tabBackgroundedMs: 700_000 }),
      );
      const match = results.find((r) => r.eggId === "abandoned_tab");
      expect(match).toBeDefined();
    });

    it("does not fire under 10 min", () => {
      const results = evaluateAllTriggers(
        baseTriggerContext({ tabBackgroundedMs: 300_000 }),
      );
      const match = results.find((r) => r.eggId === "abandoned_tab");
      expect(match).toBeUndefined();
    });
  });

  describe("fifth_time_visitor", () => {
    it("fires on visit count 5", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ visitCount: 5 }));
      const match = results.find((r) => r.eggId === "fifth_time_visitor");
      expect(match).toBeDefined();
    });

    it("does not fire on visit 4", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ visitCount: 4 }));
      const match = results.find((r) => r.eggId === "fifth_time_visitor");
      expect(match).toBeUndefined();
    });
  });

  describe("returning_visitor", () => {
    it("fires on visit count 2", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ visitCount: 2 }));
      const match = results.find((r) => r.eggId === "returning_visitor");
      expect(match).toBeDefined();
    });

    it("does not fire on first visit", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ visitCount: 1 }));
      const match = results.find((r) => r.eggId === "returning_visitor");
      expect(match).toBeUndefined();
    });

    it("does not fire on 5th visit (fifth_time_visitor takes precedence)", () => {
      const results = evaluateAllTriggers(baseTriggerContext({ visitCount: 5 }));
      const match = results.find((r) => r.eggId === "returning_visitor");
      expect(match).toBeUndefined();
    });
  });
});
