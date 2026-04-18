import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: vi.fn(),
}));

vi.mock("@/lib/quote-builder/superbad-brand-profile", () => ({
  getSuperbadBrandProfile: vi.fn().mockResolvedValue({
    voiceDescription: "Dry, observational. Melbourne wit.",
    toneMarkers: ["dry", "observational"],
    avoidWords: ["synergy"],
    targetAudience: "Small business owners",
  }),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    llm_calls_enabled: true,
    lead_gen_enabled: true,
    drift_check_enabled: true,
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([]),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    db: {
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

import { generateDraft } from "@/lib/lead-gen/draft-generator";
import type { GenerateDraftInput } from "@/lib/lead-gen/draft-generator";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { killSwitches } from "@/lib/kill-switches";

const mockInvoke = vi.mocked(invokeLlmText);
const mockDriftCheck = vi.mocked(checkBrandVoiceDrift);

const BASE_INPUT: GenerateDraftInput = {
  track: "retainer",
  touchKind: "first_touch",
  touchIndex: 1,
  viabilityProfile: {
    meta_ads: {
      active_ad_count: 5,
      estimated_spend_bracket: "medium",
      has_active_creatives: true,
    },
  },
  standingBrief: "Looking for businesses that could benefit from creative marketing",
  priorTouches: [],
  recentBlogPosts: [],
  contactInfo: {
    name: "Jane Smith",
    email: "jane@example.com",
    role: "CEO",
    company: "Example Cafe",
  },
  candidateId: "cand-001",
};

describe("generateDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("generates a draft and passes drift check", async () => {
    mockInvoke.mockResolvedValue(
      JSON.stringify({
        subject: "Thought you'd find this useful",
        body_markdown:
          "Hey Jane,\n\nSaw your cafe's been running ads...\n\n---\nAndy Robinson · SuperBad Media",
      }),
    );
    mockDriftCheck.mockResolvedValue({ pass: true, score: 0.85 });

    const result = await generateDraft(BASE_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.subject).toBe("Thought you'd find this useful");
    expect(result.draft.driftCheckFlagged).toBe(false);
    expect(result.draft.driftCheckRegenerated).toBe(false);
    expect(result.draft.driftCheckScore).toBe(85);
    expect(result.draft.promptVersion).toBe("lg5-v1");
  });

  it("returns kill_switch when LLM calls disabled", async () => {
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;
    const result = await generateDraft(BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("kill_switch");
  });

  it("handles generation failure gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("API timeout"));
    const result = await generateDraft(BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("generation_failed");
  });

  it("handles unparseable LLM response", async () => {
    mockInvoke.mockResolvedValue("This is not JSON at all");
    const result = await generateDraft(BASE_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("generation_failed");
  });

  it("regenerates once on drift failure, flags on second failure", async () => {
    mockInvoke
      .mockResolvedValueOnce(
        JSON.stringify({
          subject: "Unlock your potential",
          body_markdown: "Leverage synergy to deliver value...",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          subject: "Quick question about your cafe",
          body_markdown: "Hey Jane, noticed your lamington ad...",
        }),
      );

    mockDriftCheck
      .mockResolvedValueOnce({ pass: false, score: 0.3, notes: "Too corporate" })
      .mockResolvedValueOnce({ pass: false, score: 0.45, notes: "Still off" });

    const result = await generateDraft(BASE_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.driftCheckRegenerated).toBe(true);
    expect(result.draft.driftCheckFlagged).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("passes after successful regen on drift failure", async () => {
    mockInvoke
      .mockResolvedValueOnce(
        JSON.stringify({
          subject: "Synergistic solutions",
          body_markdown: "Dear valued prospect...",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          subject: "Quick question",
          body_markdown: "Hey Jane, your lamington ad caught my eye...",
        }),
      );

    mockDriftCheck
      .mockResolvedValueOnce({ pass: false, score: 0.3, notes: "Corporate" })
      .mockResolvedValueOnce({ pass: true, score: 0.82 });

    const result = await generateDraft(BASE_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.driftCheckRegenerated).toBe(true);
    expect(result.draft.driftCheckFlagged).toBe(false);
    expect(result.draft.subject).toBe("Quick question");
  });

  it("includes nudge feedback in prompt when provided", async () => {
    mockInvoke.mockResolvedValue(
      JSON.stringify({
        subject: "Shorter version",
        body_markdown: "Hey Jane, just a quick one...",
      }),
    );
    mockDriftCheck.mockResolvedValue({ pass: true, score: 0.9 });

    const result = await generateDraft({
      ...BASE_INPUT,
      nudgeFeedback: "Make it shorter and less formal",
    });

    expect(result.ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Make it shorter and less formal"),
      }),
    );
  });

  it("includes prior touches for follow-up drafts", async () => {
    mockInvoke.mockResolvedValue(
      JSON.stringify({
        subject: "Following up",
        body_markdown: "Hey Jane, circling back...",
      }),
    );
    mockDriftCheck.mockResolvedValue({ pass: true, score: 0.88 });

    const result = await generateDraft({
      ...BASE_INPUT,
      touchKind: "follow_up",
      touchIndex: 2,
      priorTouches: [
        { subject: "First email", body: "Hey Jane, first contact..." },
      ],
    });

    expect(result.ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("PRIOR TOUCHES"),
      }),
    );
  });

  it("uses system message with Brand DNA (discipline #44)", async () => {
    mockInvoke.mockResolvedValue(
      JSON.stringify({
        subject: "Test",
        body_markdown: "Body text",
      }),
    );
    mockDriftCheck.mockResolvedValue({ pass: true, score: 0.9 });

    await generateDraft(BASE_INPUT);

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "lead-gen-outreach-draft",
        system: expect.stringContaining("BRAND VOICE"),
      }),
    );
  });

  it("rejects empty subject or body", async () => {
    mockInvoke.mockResolvedValue(
      JSON.stringify({ subject: "", body_markdown: "some body" }),
    );

    const result = await generateDraft(BASE_INPUT);
    expect(result.ok).toBe(false);
  });

  it("handles markdown-fenced JSON response", async () => {
    mockInvoke.mockResolvedValue(
      '```json\n{"subject": "Test subject", "body_markdown": "Test body"}\n```',
    );
    mockDriftCheck.mockResolvedValue({ pass: true, score: 0.9 });

    const result = await generateDraft(BASE_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.subject).toBe("Test subject");
  });
});
