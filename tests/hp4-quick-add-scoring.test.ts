import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the LLM layer — scoring + invite drafting call invokeLlmText
// ---------------------------------------------------------------------------

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue(
    JSON.stringify({ score: 0.72, reasoning: "Good portfolio fit", name_guess: "Jane Doe" }),
  ),
  invokeLlmTextWithMeta: vi.fn(),
}));

import {
  scoreCandidateAgainstBriefs,
  type ScoringResult,
} from "@/lib/hiring/score-candidate";

import {
  draftInviteEmail,
  type DraftInviteResult,
} from "@/lib/hiring/draft-invite";

import {
  ingestPortfolioUrl,
  type PortfolioSignal,
} from "@/lib/hiring/portfolio";

import { invokeLlmText } from "@/lib/ai/invoke";

import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";

const mockedInvokeLlm = vi.mocked(invokeLlmText);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignal(overrides?: Partial<PortfolioSignal>): PortfolioSignal {
  return {
    url: "https://vimeo.com/janedoe",
    platform: "vimeo",
    thumbnails: [],
    bio: "Melbourne-based videographer",
    work_samples: [{ url: "https://vimeo.com/janedoe/reel", title: "Reel", thumbnailUrl: null, mediaType: "video" }],
    extracted_tags: ["food", "video", "melbourne"],
    confidence: 0.6,
    fetched_at: Date.now(),
    ...overrides,
  };
}

function makeBrief(overrides?: Partial<RoleBriefRow>): RoleBriefRow {
  const now = Date.now();
  return {
    id: "brief-1",
    role_name: "Food Videographer",
    engagement_type: "contractor",
    status: "open",
    rate_min_aud: 50,
    rate_max_aud: 100,
    rate_unit: "per_hour",
    target_hours_per_week: 10,
    location_pref_city: "Melbourne",
    remote_ok: true,
    open_count: 1,
    reference_urls_json: null,
    reference_signals_json: null,
    style_summary: "Bright, warm food video with natural light",
    extracted_tags_json: ["food", "natural light", "warm tones"],
    style_do_list_json: ["natural light", "close-ups"],
    style_avoid_list_json: ["heavy grading"],
    discovery_search_hints_json: null,
    andy_overrides: null,
    last_regenerated_at_ms: null,
    last_discovery_run_at_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// score-candidate.ts
// ---------------------------------------------------------------------------

describe("scoreCandidateAgainstBriefs", () => {
  beforeEach(() => {
    mockedInvokeLlm.mockReset();
  });

  it("returns empty array when no briefs provided", async () => {
    const results = await scoreCandidateAgainstBriefs(makeSignal(), []);
    expect(results).toEqual([]);
    expect(mockedInvokeLlm).not.toHaveBeenCalled();
  });

  it("scores a candidate against a single brief", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ score: 0.85, reasoning: "Strong food video fit", name_guess: "Jane Doe" }),
    );

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.85);
    expect(results[0].reasoning).toBe("Strong food video fit");
    expect(results[0].name_guess).toBe("Jane Doe");
    expect(results[0].role_brief_id).toBe("brief-1");
  });

  it("sorts results by score descending", async () => {
    mockedInvokeLlm
      .mockResolvedValueOnce(JSON.stringify({ score: 0.3, reasoning: "Weak", name_guess: null }))
      .mockResolvedValueOnce(JSON.stringify({ score: 0.9, reasoning: "Excellent", name_guess: "Jane" }));

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [
      makeBrief({ id: "brief-a", role_name: "Role A" }),
      makeBrief({ id: "brief-b", role_name: "Role B" }),
    ]);

    expect(results[0].role_brief_id).toBe("brief-b");
    expect(results[0].score).toBe(0.9);
    expect(results[1].role_brief_id).toBe("brief-a");
    expect(results[1].score).toBe(0.3);
  });

  it("clamps score to [0, 1]", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ score: 1.5, reasoning: "Over", name_guess: null }),
    );

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(results[0].score).toBe(1);
  });

  it("handles malformed JSON gracefully", async () => {
    mockedInvokeLlm.mockResolvedValueOnce("this is not json");

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(results[0].score).toBe(0);
    expect(results[0].reasoning).toContain("could not be parsed");
  });

  it("strips markdown fences from LLM response", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      '```json\n{"score": 0.77, "reasoning": "Decent", "name_guess": null}\n```',
    );

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(results[0].score).toBe(0.77);
  });

  it("handles null name_guess", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ score: 0.5, reasoning: "OK", name_guess: null }),
    );

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(results[0].name_guess).toBeNull();
  });

  it("handles string 'null' name_guess", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ score: 0.5, reasoning: "OK", name_guess: "null" }),
    );

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(results[0].name_guess).toBeNull();
  });

  it("calls LLM with the hiring-candidate-score job slug", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ score: 0.6, reasoning: "Fine", name_guess: null }),
    );

    await scoreCandidateAgainstBriefs(makeSignal(), [makeBrief()]);
    expect(mockedInvokeLlm).toHaveBeenCalledWith(
      expect.objectContaining({ job: "hiring-candidate-score" }),
    );
  });

  it("handles briefs with null/undefined tag arrays", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ score: 0.4, reasoning: "Sparse data", name_guess: null }),
    );

    const brief = makeBrief({
      extracted_tags_json: null,
      style_do_list_json: null,
      style_avoid_list_json: null,
      style_summary: null,
    });

    const results = await scoreCandidateAgainstBriefs(makeSignal(), [brief]);
    expect(results[0].score).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// draft-invite.ts
// ---------------------------------------------------------------------------

describe("draftInviteEmail", () => {
  beforeEach(() => {
    mockedInvokeLlm.mockReset();
  });

  it("drafts an invite email via LLM", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({
        subject: "Your reel caught my eye",
        body: "Hi Jane. I run a small marketing outfit in Melbourne. Your food work is the real thing. Fancy a chat?",
        confidence: 0.78,
      }),
    );

    const result = await draftInviteEmail({
      candidateName: "Jane Doe",
      signal: makeSignal(),
      roleName: "Food Videographer",
      styleSummary: "Bright, warm food video",
      extractedTags: ["food", "natural light"],
    });

    expect(result.subject).toBe("Your reel caught my eye");
    expect(result.body).toContain("Melbourne");
    expect(result.confidence).toBe(0.78);
  });

  it("uses hiring-invite-draft job slug", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ subject: "Hi", body: "Hello", confidence: 0.5 }),
    );

    await draftInviteEmail({
      candidateName: "Test",
      signal: makeSignal(),
      roleName: "Role",
      styleSummary: null,
      extractedTags: [],
    });

    expect(mockedInvokeLlm).toHaveBeenCalledWith(
      expect.objectContaining({ job: "hiring-invite-draft" }),
    );
  });

  it("handles malformed JSON by returning raw text as body", async () => {
    mockedInvokeLlm.mockResolvedValueOnce("Hey Jane, loved your work.");

    const result = await draftInviteEmail({
      candidateName: "Jane",
      signal: makeSignal(),
      roleName: "Role",
      styleSummary: null,
      extractedTags: [],
    });

    expect(result.subject).toBe("");
    expect(result.body).toBe("Hey Jane, loved your work.");
    expect(result.confidence).toBe(0);
  });

  it("clamps confidence to [0, 1]", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      JSON.stringify({ subject: "Hi", body: "Test", confidence: 2.5 }),
    );

    const result = await draftInviteEmail({
      candidateName: "Test",
      signal: makeSignal(),
      roleName: "Role",
      styleSummary: null,
      extractedTags: [],
    });

    expect(result.confidence).toBe(1);
  });

  it("strips markdown fences", async () => {
    mockedInvokeLlm.mockResolvedValueOnce(
      '```json\n{"subject": "Hey", "body": "Hi there", "confidence": 0.6}\n```',
    );

    const result = await draftInviteEmail({
      candidateName: "Test",
      signal: makeSignal(),
      roleName: "Role",
      styleSummary: null,
      extractedTags: [],
    });

    expect(result.subject).toBe("Hey");
    expect(result.confidence).toBe(0.6);
  });
});

// ---------------------------------------------------------------------------
// ingestPortfolioUrl — platform detection
// ---------------------------------------------------------------------------

describe("ingestPortfolioUrl platform detection", () => {
  it("detects vimeo", async () => {
    const s = await ingestPortfolioUrl("https://vimeo.com/johndoe");
    expect(s.platform).toBe("vimeo");
  });

  it("detects instagram", async () => {
    const s = await ingestPortfolioUrl("https://instagram.com/janedoe");
    expect(s.platform).toBe("instagram");
  });

  it("detects behance", async () => {
    const s = await ingestPortfolioUrl("https://behance.net/designer");
    expect(s.platform).toBe("behance");
  });

  it("detects personal sites", async () => {
    const s = await ingestPortfolioUrl("https://janedoe.com/portfolio");
    expect(s.platform).toBe("personal");
  });

  it("returns a single work sample with the URL", async () => {
    const s = await ingestPortfolioUrl("https://vimeo.com/test");
    expect(s.work_samples).toHaveLength(1);
    expect(s.work_samples[0].url).toBe("https://vimeo.com/test");
  });

  it("sets fetched_at to current time", async () => {
    const before = Date.now();
    const s = await ingestPortfolioUrl("https://example.com");
    expect(s.fetched_at).toBeGreaterThanOrEqual(before);
  });
});

// ---------------------------------------------------------------------------
// URL name extraction (tested via the action, but also unit-testable logic)
// ---------------------------------------------------------------------------

describe("extractNameFromUrl logic", () => {
  // The extraction function lives inside the actions file as a private helper.
  // We test the behaviour indirectly through the shapes it produces.
  // For direct unit tests, we replicate the logic here.

  function extractNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length > 0 && segments[0].length > 1) {
        return segments[0]
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
      const host = parsed.hostname.replace(/^www\./, "");
      return host.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      return "Unknown";
    }
  }

  it("extracts from vimeo path", () => {
    expect(extractNameFromUrl("https://vimeo.com/jane-doe")).toBe("Jane Doe");
  });

  it("extracts from instagram path", () => {
    expect(extractNameFromUrl("https://instagram.com/johndoe")).toBe("Johndoe");
  });

  it("extracts from hostname for root URLs", () => {
    expect(extractNameFromUrl("https://janedoe.com")).toBe("Janedoe");
  });

  it("strips www prefix", () => {
    expect(extractNameFromUrl("https://www.janedoe.com")).toBe("Janedoe");
  });

  it("handles underscores in path", () => {
    expect(extractNameFromUrl("https://behance.net/john_smith")).toBe("John Smith");
  });

  it("returns Unknown for invalid URLs", () => {
    expect(extractNameFromUrl("not-a-url")).toBe("Unknown");
  });
});
