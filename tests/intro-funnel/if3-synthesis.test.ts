import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
          limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(null) }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: true, drift_check_enabled: true },
}));
vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue("Test synthesis paragraph 1.\n\nTest synthesis paragraph 2."),
}));
vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: vi.fn().mockResolvedValue({ pass: true, score: 0.9 }),
}));
vi.mock("@/lib/quote-builder/superbad-brand-profile", () => ({
  getSuperbadBrandProfile: vi.fn().mockResolvedValue({
    voiceDescription: "Dry, observational",
    toneMarkers: ["dry"],
  }),
}));
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { generateReflectionSynthesis, FALLBACK_SYNTHESIS } from "@/lib/intro-funnel/generate-synthesis";
import { killSwitches } from "@/lib/kill-switches";
import { db } from "@/lib/db";

describe("generateReflectionSynthesis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns kill_switch when llm_calls_enabled is false", async () => {
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;
    const result = await generateReflectionSynthesis("r1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("kill_switch");
      expect(result.fallbackText).toBe(FALLBACK_SYNTHESIS);
    }
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("returns safety_valve when reflection has safety_valve_triggered", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: "r1",
            submission_id: "s1",
            deal_id: "d1",
            safety_valve_triggered: true,
            answers_json: {},
          }),
        }),
      }),
    });
    (db.select as unknown as ReturnType<typeof vi.fn>) = mockSelect;

    const result = await generateReflectionSynthesis("r1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("safety_valve");
    }
  });

  it("returns generation_failed when no reflection found", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
        }),
      }),
    });
    (db.select as unknown as ReturnType<typeof vi.fn>) = mockSelect;

    const result = await generateReflectionSynthesis("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generation_failed");
    }
  });

  it("exports FALLBACK_SYNTHESIS with expected content", () => {
    expect(FALLBACK_SYNTHESIS).toContain("You showed up");
    expect(FALLBACK_SYNTHESIS).toContain("If something clicks");
  });
});
