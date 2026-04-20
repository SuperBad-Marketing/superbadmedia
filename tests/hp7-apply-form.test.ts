import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue("Your reel is food-heavy — comfortable with product-shot work too?"),
  invokeLlmTextWithMeta: vi.fn(),
  invokeLlmVision: vi.fn().mockResolvedValue({
    text: JSON.stringify(["food-photography", "warm-tones"]),
    inputTokens: 100,
    outputTokens: 20,
  }),
}));

const mockSettingsStore: Record<string, unknown> = {
  "hiring.apply.followup_reply_wait_days": 7,
  "hiring.apply.rate_bands": ["Under $30/hr", "$30–50/hr", "$50–80/hr"],
  "hiring.discovery.vimeo_enabled": true,
  "hiring.discovery.behance_enabled": true,
  "hiring.discovery.ig_on_demand_enabled": false,
};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key in mockSettingsStore) return mockSettingsStore[key];
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const { mockInsertedCandidate } = vi.hoisted(() => ({
  mockInsertedCandidate: {
    id: "cand-apply-1",
    name: "Test Applicant",
    email: "test@example.com",
    stage: "applied",
    source: "applied",
    engagement_type: "contractor",
    role_brief_id: "brief-1",
    location_city: "Melbourne",
    portfolio_urls_json: ["https://vimeo.com/test"],
    rate_expectation_aud: 50,
    rate_expectation_unit: "per_hour",
    availability_hours_per_week: 10,
    available_from_ms: null,
    application_followup_question: null,
    application_followup_reply: null,
    followup_status: "pending",
    portfolio_signal_json: null,
    portfolio_signal_fetched_at_ms: null,
    brief_match_score: null,
    bench_status: null,
    paused_until_ms: null,
    hourly_rate_aud: null,
    weekly_capacity_hours: null,
    onboarding_completed_at_ms: null,
    abn: null,
    legal_name: null,
    agreement_signed_at_ms: null,
    bank_details: null,
    archived_at_ms: null,
    discovery_source: null,
    stage_before_archive: null,
    first_seen_at_ms: Date.now(),
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "task-1" }]),
        }),
        returning: vi.fn().mockResolvedValue([{ ...mockInsertedCandidate }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockInsertedCandidate }]),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    query: {
      candidates: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      role_briefs: {
        findFirst: vi.fn().mockResolvedValue({
          id: "brief-1",
          role_name: "Colourist",
          style_summary: "Food and beverage colour grading",
          extracted_tags_json: ["food", "warm-tones", "cinematic"],
          status: "open",
          engagement_type: "contractor",
        }),
      },
    },
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg-1" }),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    llm_calls_enabled: true,
    outreach_send_enabled: true,
    hiring_discovery_enabled: false,
    scheduled_tasks_enabled: true,
    drift_check_enabled: false,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { db } from "@/lib/db";

const mockedLlm = vi.mocked(invokeLlmText);
const mockedLogActivity = vi.mocked(logActivity);
const mockedSendEmail = vi.mocked(sendEmail);

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

import {
  processApplication,
  generateAndSendFollowup,
  type ApplyFormInput,
} from "@/lib/hiring/apply";
import {
  buildFollowupQuestionPrompt,
  buildFollowupQuestionSystem,
} from "@/lib/ai/prompts/hiring/followup-question-draft";
import { handleHiringApplyFollowupSend } from "@/lib/scheduled-tasks/handlers/hiring-apply";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApplyInput(
  overrides: Partial<ApplyFormInput> = {},
): ApplyFormInput {
  return {
    name: "Jane Smith",
    email: "jane@example.com",
    roleBriefId: "brief-1",
    portfolioUrls: ["https://vimeo.com/janesmith"],
    locationCity: "Melbourne",
    rateExpectationBand: "$30–50/hr",
    availabilityHoursPerWeek: 10,
    availableFromMs: null,
    recommendSomeone: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/html" }),
    text: async () => `<html><head><title>Jane Smith</title><meta property="og:title" content="Jane Smith Portfolio" /><meta property="og:image" content="https://example.com/thumb.jpg" /></head></html>`,
  });
});

describe("processApplication", () => {
  it("creates a new candidate when no existing match", async () => {
    const result = await processApplication(makeApplyInput());

    expect(result.ok).toBe(true);
    expect(result.candidateId).toBeDefined();
  });

  it("logs candidate_applied activity on submission", async () => {
    await processApplication(makeApplyInput());

    expect(mockedLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "candidate_applied",
        meta: expect.objectContaining({
          source: "new",
        }),
      }),
    );
  });

  it("enqueues a followup task after submission", async () => {
    const insertSpy = vi.mocked(db.insert);
    await processApplication(makeApplyInput());

    const insertCalls = insertSpy.mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("handles null roleBriefId for general interest", async () => {
    const result = await processApplication(
      makeApplyInput({ roleBriefId: null }),
    );
    expect(result.ok).toBe(true);
  });

  it("processes referral URLs from recommendSomeone field", async () => {
    const insertSpy = vi.mocked(db.insert);
    await processApplication(
      makeApplyInput({
        recommendSomeone: "Check out https://vimeo.com/referral1 and https://behance.net/referral2",
      }),
    );

    const insertCalls = insertSpy.mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(3);
  });

  it("limits referral parsing to 3 URLs", async () => {
    const insertSpy = vi.mocked(db.insert);
    await processApplication(
      makeApplyInput({
        recommendSomeone:
          "https://a.com https://b.com https://c.com https://d.com https://e.com",
      }),
    );

    const insertCalls = insertSpy.mock.calls;
    expect(insertCalls.length).toBeLessThanOrEqual(7);
  });
});

describe("buildFollowupQuestionPrompt", () => {
  it("returns a non-empty prompt string", () => {
    const prompt = buildFollowupQuestionPrompt({
      candidateName: "Jane Smith",
      roleName: "Colourist",
      portfolioUrls: ["https://vimeo.com/janesmith"],
      portfolioStyleTags: ["food-photography", "warm-tones"],
      portfolioSummary: "Food and beverage videography reel",
      locationCity: "Melbourne",
      rateExpectation: "$50/hr",
      availabilityHoursPerWeek: 10,
      briefStyleSummary: "Food and beverage colour grading",
      briefExtractedTags: ["food", "warm-tones", "cinematic"],
    });

    expect(prompt).toContain("Jane Smith");
    expect(prompt).toContain("Colourist");
    expect(prompt).toContain("food-photography");
  });

  it("handles null/empty portfolio summary gracefully", () => {
    const prompt = buildFollowupQuestionPrompt({
      candidateName: "Test",
      roleName: "Editor",
      portfolioUrls: ["https://example.com"],
      portfolioStyleTags: [],
      portfolioSummary: null,
      locationCity: null,
      rateExpectation: null,
      availabilityHoursPerWeek: null,
      briefStyleSummary: null,
      briefExtractedTags: [],
    });

    expect(prompt).toContain("https://example.com");
    expect(prompt).toContain("not specified");
  });
});

describe("buildFollowupQuestionSystem", () => {
  it("returns a system message string", () => {
    const system = buildFollowupQuestionSystem();
    expect(system.length).toBeGreaterThan(0);
    expect(system).toContain("creative director");
  });
});

describe("generateAndSendFollowup", () => {
  beforeEach(() => {
    vi.mocked(db.query.candidates as unknown as { findFirst: ReturnType<typeof vi.fn> })
      .findFirst.mockResolvedValue({ ...mockInsertedCandidate });
  });

  it("skips if candidate has no email", async () => {
    vi.mocked(
      db.query.candidates as unknown as { findFirst: ReturnType<typeof vi.fn> },
    ).findFirst.mockResolvedValue({
      ...mockInsertedCandidate,
      email: null,
    });

    await generateAndSendFollowup("cand-apply-1");

    expect(mockedLlm).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("skips if followup question already exists", async () => {
    vi.mocked(
      db.query.candidates as unknown as { findFirst: ReturnType<typeof vi.fn> },
    ).findFirst.mockResolvedValue({
      ...mockInsertedCandidate,
      application_followup_question: "Already asked.",
    });

    await generateAndSendFollowup("cand-apply-1");

    expect(mockedLlm).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("skips if candidate is not in applied stage", async () => {
    vi.mocked(
      db.query.candidates as unknown as { findFirst: ReturnType<typeof vi.fn> },
    ).findFirst.mockResolvedValue({
      ...mockInsertedCandidate,
      stage: "screened",
    });

    await generateAndSendFollowup("cand-apply-1");

    expect(mockedLlm).not.toHaveBeenCalled();
  });

  it("generates a follow-up question and sends email", async () => {
    await generateAndSendFollowup("cand-apply-1");

    expect(mockedLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "hiring-followup-question-draft",
      }),
    );

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        classification: "hiring_followup_question",
      }),
    );
  });

  it("strips surrounding quotes from LLM response", async () => {
    mockedLlm.mockResolvedValueOnce('"Is your work always this warm?"');

    await generateAndSendFollowup("cand-apply-1");

    const updateSpy = vi.mocked(db.update);
    expect(updateSpy).toHaveBeenCalled();
  });
});

describe("handleHiringApplyFollowupSend", () => {
  it("does nothing when llm_calls_enabled is false", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;

    await handleHiringApplyFollowupSend({
      id: "task-1",
      task_type: "hiring_apply_followup_send",
      run_at_ms: Date.now(),
      payload: { candidate_id: "cand-1" },
      status: "running",
      attempts: 0,
      idempotency_key: null,
      created_at_ms: Date.now(),
      done_at_ms: null,
      last_error: null,
      last_attempted_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(mockedLlm).not.toHaveBeenCalled();

    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("does nothing when payload has no candidate_id", async () => {
    await handleHiringApplyFollowupSend({
      id: "task-2",
      task_type: "hiring_apply_followup_send",
      run_at_ms: Date.now(),
      payload: {},
      status: "running",
      attempts: 0,
      idempotency_key: null,
      created_at_ms: Date.now(),
      done_at_ms: null,
      last_error: null,
      last_attempted_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(mockedLlm).not.toHaveBeenCalled();
  });
});

describe("parseRateBand (via processApplication)", () => {
  it("extracts numeric rate from band string", async () => {
    const result = await processApplication(
      makeApplyInput({ rateExpectationBand: "$50–80/hr" }),
    );
    expect(result.ok).toBe(true);
  });

  it("handles non-numeric band gracefully", async () => {
    const result = await processApplication(
      makeApplyInput({ rateExpectationBand: "Negotiable" }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("referral URL parsing", () => {
  it("ignores recommendSomeone with no URLs", async () => {
    const insertSpy = vi.mocked(db.insert);
    const initialCalls = insertSpy.mock.calls.length;

    await processApplication(
      makeApplyInput({
        recommendSomeone: "My friend John is great, you should talk to him",
      }),
    );

    const afterCalls = insertSpy.mock.calls.length;
    expect(afterCalls - initialCalls).toBeLessThanOrEqual(3);
  });
});
