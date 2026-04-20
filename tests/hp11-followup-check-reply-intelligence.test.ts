import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      candidates: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ run: vi.fn() })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            all: vi.fn(() => []),
          })),
          get: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(() => ({ sent: true, messageId: "msg-123" })),
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/hiring/transition-candidate-stage", () => ({
  transitionCandidateStage: vi.fn(),
}));

vi.mock("@/lib/hiring/queries", () => ({
  createCandidateArchive: vi.fn(),
  updateCandidate: vi.fn(),
  getCandidateById: vi.fn(),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    llm_calls_enabled: true,
    outreach_send_enabled: true,
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => {
      if (key === "hiring.apply.followup_reply_wait_days") return 7;
      return null;
    }),
  },
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { invokeLlmText } from "@/lib/ai/invoke";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { createCandidateArchive, updateCandidate } from "@/lib/hiring/queries";
import { killSwitches } from "@/lib/kill-switches";

import {
  classifyHiringReply,
  routeHiringReply,
  type HiringReplyIntent,
} from "@/lib/hiring/reply-intelligence";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand-1",
    name: "Alex Test",
    email: "alex@example.com",
    stage: "invited" as const,
    source: "discovered",
    followup_status: "pending",
    application_followup_question: null,
    application_followup_reply: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// classifyHiringReply
// ---------------------------------------------------------------------------

describe("classifyHiringReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("returns classified intent from LLM response", async () => {
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "positive", "reason": "Candidate expressed interest"}',
    );

    const result = await classifyHiringReply("Sounds great, I'd love to apply!", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("positive");
    expect(result.reason).toBe("Candidate expressed interest");
    expect(invokeLlmText).toHaveBeenCalledOnce();
  });

  it("handles JSON wrapped in markdown fences", async () => {
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '```json\n{"intent": "negative", "reason": "Not interested"}\n```',
    );

    const result = await classifyHiringReply("No thanks", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("negative");
  });

  it("falls back to 'question' on LLM failure", async () => {
    vi.mocked(invokeLlmText).mockRejectedValueOnce(new Error("LLM error"));

    const result = await classifyHiringReply("Something", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("question");
    expect(result.reason).toContain("failed");
  });

  it("falls back to 'question' on invalid intent", async () => {
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "invalid_value", "reason": "test"}',
    );

    const result = await classifyHiringReply("Something", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("question");
  });

  it("returns 'question' fallback when LLM is disabled", async () => {
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;

    const result = await classifyHiringReply("Hello", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("question");
    expect(invokeLlmText).not.toHaveBeenCalled();
  });

  it("classifies auto-responder replies", async () => {
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "auto_responder", "reason": "Out of office auto-reply"}',
    );

    const result = await classifyHiringReply("I am out of the office until March 1st.", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("auto_responder");
  });

  it("classifies objection replies", async () => {
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "objection", "reason": "Rate concerns"}',
    );

    const result = await classifyHiringReply("The rate is too low for my experience.", {
      candidateName: "Alex",
      threadType: "hiring_invite",
    });

    expect(result.intent).toBe("objection");
  });
});

// ---------------------------------------------------------------------------
// routeHiringReply — positive
// ---------------------------------------------------------------------------

describe("routeHiringReply — positive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("sends apply link on positive invite reply", async () => {
    const candidate = makeCandidateRow();
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "positive", "reason": "Interested"}',
    );

    const result = await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "Sounds great!",
      threadClassification: "hiring_invite",
    });

    expect(result.intent).toBe("positive");
    expect(result.action).toBe("apply_link_sent");
    expect(sendEmail).toHaveBeenCalledOnce();

    const emailCall = vi.mocked(sendEmail).mock.calls[0][0];
    expect(emailCall.to).toBe("alex@example.com");
    expect(emailCall.classification).toBe("hiring_invite");
  });

  it("logs activity on positive reply", async () => {
    const candidate = makeCandidateRow();
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "positive", "reason": "Wants to proceed"}',
    );

    await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "Yes please",
      threadClassification: "hiring_invite",
    });

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "candidate_followup_received",
        meta: expect.objectContaining({ intent: "positive" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// routeHiringReply — negative
// ---------------------------------------------------------------------------

describe("routeHiringReply — negative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("auto-archives candidate on negative reply", async () => {
    const candidate = makeCandidateRow();
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "negative", "reason": "Not interested"}',
    );

    const result = await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "Not interested, thanks",
      threadClassification: "hiring_invite",
    });

    expect(result.intent).toBe("negative");
    expect(result.action).toBe("auto_archived");
    expect(createCandidateArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate_id: "cand-1",
        disposition_direction: "they_withdrew",
        reason_code: "they_declined",
      }),
    );
    expect(transitionCandidateStage).toHaveBeenCalledWith(
      "cand-1",
      "archived",
      expect.objectContaining({ by: "system:reply_intelligence" }),
    );
  });

  it("skips archive if already archived", async () => {
    const candidate = makeCandidateRow({ stage: "archived" });
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "negative", "reason": "Declined"}',
    );

    await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "No thanks",
      threadClassification: "hiring_invite",
    });

    expect(createCandidateArchive).not.toHaveBeenCalled();
    expect(transitionCandidateStage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// routeHiringReply — auto_responder
// ---------------------------------------------------------------------------

describe("routeHiringReply — auto_responder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("ignores auto-responder replies with no side effects", async () => {
    const candidate = makeCandidateRow();
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "auto_responder", "reason": "OOO"}',
    );

    const result = await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "I am out of office",
      threadClassification: "hiring_invite",
    });

    expect(result.intent).toBe("auto_responder");
    expect(result.action).toBe("ignored");
    expect(logActivity).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(transitionCandidateStage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// routeHiringReply — objection / question → Andy queue
// ---------------------------------------------------------------------------

describe("routeHiringReply — objection/question", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("routes objection to Andy queue", async () => {
    const candidate = makeCandidateRow();
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "objection", "reason": "Rate too low"}',
    );

    const result = await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "The rate doesn't work for me",
      threadClassification: "hiring_invite",
    });

    expect(result.intent).toBe("objection");
    expect(result.action).toBe("andy_queue");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "candidate_followup_received",
        meta: expect.objectContaining({ intent: "objection" }),
      }),
    );
  });

  it("routes question to Andy queue", async () => {
    const candidate = makeCandidateRow();
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);
    vi.mocked(invokeLlmText).mockResolvedValueOnce(
      '{"intent": "question", "reason": "Asking about the role"}',
    );

    const result = await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "What kind of projects would I work on?",
      threadClassification: "hiring_invite",
    });

    expect(result.intent).toBe("question");
    expect(result.action).toBe("andy_queue");
  });
});

// ---------------------------------------------------------------------------
// routeHiringReply — followup question replies
// ---------------------------------------------------------------------------

describe("routeHiringReply — followup question reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores reply and updates followup_status on followup question thread", async () => {
    const candidate = makeCandidateRow({ stage: "applied", followup_status: "pending" });
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);

    const result = await routeHiringReply({
      candidateId: "cand-1",
      replyBody: "Yeah, I've done product shots before — here's an example.",
      threadClassification: "hiring_followup_question",
    });

    expect(result.action).toBe("followup_reply_stored");
    expect(updateCandidate).toHaveBeenCalledWith("cand-1", {
      application_followup_reply: expect.stringContaining("product shots"),
      followup_status: "replied",
    });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "candidate_followup_received",
        body: expect.stringContaining("replied to follow-up"),
      }),
    );
  });

  it("truncates long replies to 5000 chars", async () => {
    const candidate = makeCandidateRow({ stage: "applied" });
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);

    const longReply = "x".repeat(10000);
    await routeHiringReply({
      candidateId: "cand-1",
      replyBody: longReply,
      threadClassification: "hiring_followup_question",
    });

    const updateCall = vi.mocked(updateCandidate).mock.calls[0];
    expect(updateCall[1].application_followup_reply).toHaveLength(5000);
  });
});

// ---------------------------------------------------------------------------
// routeHiringReply — candidate not found
// ---------------------------------------------------------------------------

describe("routeHiringReply — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns gracefully when candidate not found", async () => {
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(undefined as never);

    const result = await routeHiringReply({
      candidateId: "nonexistent",
      replyBody: "Hello",
      threadClassification: "hiring_invite",
    });

    expect(result.action).toBe("candidate_not_found");
  });
});

// ---------------------------------------------------------------------------
// Followup check handler
// ---------------------------------------------------------------------------

describe("hiring_invite_followup_check handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets followup_status to no_reply when pending + applied", async () => {
    const candidate = makeCandidateRow({
      stage: "applied",
      followup_status: "pending",
    });
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);

    const { HIRING_FOLLOWUP_CHECK_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-followup-check"
    );
    const handler = HIRING_FOLLOWUP_CHECK_HANDLERS.hiring_invite_followup_check!;

    await handler({
      id: "task-1",
      task_type: "hiring_invite_followup_check",
      payload: { candidate_id: "cand-1" },
      status: "pending",
      run_at_ms: Date.now(),
      attempts: 0,
      created_at_ms: Date.now(),
      idempotency_key: null,
    } as never);

    expect(db.update).toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "candidate_followup_received",
        meta: expect.objectContaining({ followup_status: "no_reply", timeout: true }),
      }),
    );
  });

  it("skips if candidate already replied", async () => {
    const candidate = makeCandidateRow({
      stage: "applied",
      followup_status: "replied",
    });
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);

    const { HIRING_FOLLOWUP_CHECK_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-followup-check"
    );
    const handler = HIRING_FOLLOWUP_CHECK_HANDLERS.hiring_invite_followup_check!;

    await handler({
      id: "task-1",
      task_type: "hiring_invite_followup_check",
      payload: { candidate_id: "cand-1" },
      status: "pending",
      run_at_ms: Date.now(),
      attempts: 0,
      created_at_ms: Date.now(),
      idempotency_key: null,
    } as never);

    expect(db.update).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("skips if candidate not in applied stage", async () => {
    const candidate = makeCandidateRow({
      stage: "screened",
      followup_status: "pending",
    });
    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce(candidate as never);

    const { HIRING_FOLLOWUP_CHECK_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-followup-check"
    );
    const handler = HIRING_FOLLOWUP_CHECK_HANDLERS.hiring_invite_followup_check!;

    await handler({
      id: "task-1",
      task_type: "hiring_invite_followup_check",
      payload: { candidate_id: "cand-1" },
      status: "pending",
      run_at_ms: Date.now(),
      attempts: 0,
      created_at_ms: Date.now(),
      idempotency_key: null,
    } as never);

    expect(db.update).not.toHaveBeenCalled();
  });

  it("skips if no candidate_id in payload", async () => {
    const { HIRING_FOLLOWUP_CHECK_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-followup-check"
    );
    const handler = HIRING_FOLLOWUP_CHECK_HANDLERS.hiring_invite_followup_check!;

    await handler({
      id: "task-1",
      task_type: "hiring_invite_followup_check",
      payload: {},
      status: "pending",
      run_at_ms: Date.now(),
      attempts: 0,
      created_at_ms: Date.now(),
      idempotency_key: null,
    } as never);

    expect(db.query.candidates.findFirst).not.toHaveBeenCalled();
  });
});
