/**
 * checkBrandVoiceDrift tests — A7.
 *
 * Verifies:
 *   - Kill switch gate skips LLM and returns pass=true
 *   - LLM response is parsed correctly into { pass, score, notes }
 *   - Threshold comparison gates pass/fail
 *   - Malformed LLM JSON is handled gracefully
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks before any module import ─────────────────────────────────────

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));

// Kill switches — default both enabled so real LLM path executes
const mockKillSwitches = vi.hoisted(() => ({
  llm_calls_enabled: true,
  drift_check_enabled: true,
  outreach_send_enabled: false,
  scheduled_tasks_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

// Settings — default threshold = 0.7
const mockSettingsGet = vi.hoisted(() => vi.fn().mockResolvedValue(0.7));

vi.mock("@/lib/settings", () => ({
  default: { get: mockSettingsGet },
}));

import {
  checkBrandVoiceDrift,
  type BrandDnaProfile,
} from "@/lib/ai/drift-check";

// ── Fixture ───────────────────────────────────────────────────────────────────

const SAMPLE_PROFILE: BrandDnaProfile = {
  voiceDescription: "dry, direct, Melbourne wit — never corporate",
  toneMarkers: ["deadpan", "confident", "no-fluff"],
  avoidWords: ["synergy", "leverage", "solutions"],
  targetAudience: "Melbourne SME founders, 30–55",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockLLMResponse(score: number, notes: string) {
  mockMessagesCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify({ score, notes }) }],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkBrandVoiceDrift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKillSwitches.llm_calls_enabled = true;
    mockKillSwitches.drift_check_enabled = true;
    mockSettingsGet.mockResolvedValue(0.7);
  });

  // Kill switch paths

  it("skips LLM and returns pass=true when llm_calls_enabled=false", async () => {
    mockKillSwitches.llm_calls_enabled = false;
    const result = await checkBrandVoiceDrift("Some draft text", SAMPLE_PROFILE);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.notes).toContain("kill switch");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("skips LLM and returns pass=true when drift_check_enabled=false", async () => {
    mockKillSwitches.drift_check_enabled = false;
    const result = await checkBrandVoiceDrift("Some draft text", SAMPLE_PROFILE);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1.0);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("skips LLM when both kill switches are off", async () => {
    mockKillSwitches.llm_calls_enabled = false;
    mockKillSwitches.drift_check_enabled = false;
    const result = await checkBrandVoiceDrift("draft", SAMPLE_PROFILE);
    expect(result.pass).toBe(true);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  // Happy path — LLM returns valid JSON

  it("returns pass=true when score meets threshold (0.8 >= 0.7)", async () => {
    mockLLMResponse(0.8, "Solid brand alignment, dry tone present.");
    const result = await checkBrandVoiceDrift(
      "We build good stuff. No nonsense.",
      SAMPLE_PROFILE,
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.8);
    expect(result.notes).toBe("Solid brand alignment, dry tone present.");
  });

  it("returns pass=false when score is below threshold (0.5 < 0.7)", async () => {
    mockLLMResponse(0.5, "Too corporate — multiple banned words detected.");
    const result = await checkBrandVoiceDrift(
      "Let's leverage synergy for optimal solutions!",
      SAMPLE_PROFILE,
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.5);
  });

  it("returns pass=true at exact threshold (0.7 === 0.7)", async () => {
    mockLLMResponse(0.7, "Borderline — meets threshold exactly.");
    const result = await checkBrandVoiceDrift("Good enough copy.", SAMPLE_PROFILE);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.7);
  });

  // Threshold from settings

  it("respects a custom threshold from settings (0.9)", async () => {
    mockSettingsGet.mockResolvedValue(0.9);
    mockLLMResponse(0.85, "Close but not above the higher bar.");
    const result = await checkBrandVoiceDrift("Almost there.", SAMPLE_PROFILE);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.85);
  });

  // Score clamping

  it("clamps score above 1.0 down to 1.0", async () => {
    mockLLMResponse(1.5, "Over-enthusiastic LLM.");
    const result = await checkBrandVoiceDrift("Perfect.", SAMPLE_PROFILE);
    expect(result.score).toBe(1.0);
    expect(result.pass).toBe(true);
  });

  it("clamps score below 0.0 up to 0.0", async () => {
    mockLLMResponse(-0.3, "Way off brand.");
    const result = await checkBrandVoiceDrift("Terrible.", SAMPLE_PROFILE);
    expect(result.score).toBe(0.0);
    expect(result.pass).toBe(false);
  });

  // Malformed LLM response handling

  it("handles malformed JSON gracefully — returns score=0.0 with parse error note", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json at all" }],
    });
    const result = await checkBrandVoiceDrift("Draft.", SAMPLE_PROFILE);
    expect(result.score).toBe(0.0);
    expect(result.pass).toBe(false);
    expect(result.notes).toContain("parse error");
  });

  it("handles JSON wrapped in markdown code fences", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "```json\n{\"score\": 0.75, \"notes\": \"Good\"}\n```",
        },
      ],
    });
    const result = await checkBrandVoiceDrift("Draft.", SAMPLE_PROFILE);
    expect(result.score).toBe(0.75);
    expect(result.pass).toBe(true);
    expect(result.notes).toBe("Good");
  });

  // Profile with optional fields omitted

  it("works with minimal BrandDnaProfile (no avoidWords or targetAudience)", async () => {
    mockLLMResponse(0.9, "Clean voice.");
    const minimalProfile: BrandDnaProfile = {
      voiceDescription: "plain spoken",
      toneMarkers: ["direct"],
    };
    const result = await checkBrandVoiceDrift("Short and sweet.", minimalProfile);
    expect(result.pass).toBe(true);
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
  });
});
