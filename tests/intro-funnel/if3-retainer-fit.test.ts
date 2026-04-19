import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: true, drift_check_enabled: true },
}));
vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue(
    JSON.stringify({
      recommendation_type: "retainer",
      confidence: "high",
      reasoning_text: "Strong retainer candidate based on engagement signals.",
      flags: [{ type: "high_engagement", detail: "Prospect showed high interest" }],
    }),
  ),
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
vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(""),
  },
}));

import { generateRetainerFitRecommendation } from "@/lib/intro-funnel/generate-retainer-fit";
import { killSwitches } from "@/lib/kill-switches";

describe("generateRetainerFitRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns kill_switch when llm_calls_enabled is false", async () => {
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;
    const result = await generateRetainerFitRecommendation("r1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("kill_switch");
    }
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("returns no_reflection when reflection not found", async () => {
    const result = await generateRetainerFitRecommendation("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_reflection");
    }
  });
});
