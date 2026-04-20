import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue(
    JSON.stringify({
      subject: "Hey — saw your reel",
      body: "Your food stuff is solid. We need a colourist. Interested?",
      confidence: 0.9,
    }),
  ),
  invokeLlmTextWithMeta: vi.fn(),
  invokeLlmVision: vi.fn().mockResolvedValue({
    text: JSON.stringify(["food-photography"]),
    inputTokens: 100,
    outputTokens: 20,
  }),
}));

const mockSettingsStore: Record<string, unknown> = {
  "hiring.invite.auto_send_enabled": true,
  "hiring.invite.auto_send_confidence_threshold": 0.85,
  "hiring.invite.ft_auto_send_confidence_threshold": 0.95,
  "hiring.invite.daily_send_cap_per_role": 3,
  "hiring.invite.per_candidate_throttle_days": 90,
  "hiring.invite.cross_role_max_per_candidate_per_year": 3,
  "email.drift_check_threshold": 0.7,
};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key in mockSettingsStore) return mockSettingsStore[key];
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    llm_calls_enabled: true,
    drift_check_enabled: true,
    outreach_send_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

const mockDbAll = vi.fn().mockReturnValue([]);
const mockDbGet = vi.fn().mockReturnValue(undefined);
const mockDbRun = vi.fn();
const mockDbInsertReturning = vi.fn().mockReturnValue([]);
const mockDbUpdateSet = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: mockDbAll,
          get: mockDbGet,
        })),
        all: mockDbAll,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockDbInsertReturning,
        onConflictDoNothing: vi.fn(() => ({
          returning: mockDbInsertReturning,
        })),
        run: mockDbRun,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: mockDbRun,
          returning: vi.fn().mockReturnValue([{ id: "draft-1" }]),
        })),
      })),
    })),
    query: {
      invite_drafts: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
      candidates: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg-123" }),
}));

vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: vi.fn().mockResolvedValue({
    pass: true,
    score: 0.9,
    notes: "Matches brand voice",
  }),
}));

vi.mock("@/lib/hiring/transition-candidate-stage", () => ({
  transitionCandidateStage: vi.fn().mockReturnValue({
    id: "cand-1",
    stage: "invited",
  }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

vi.mock("@/lib/db/schema/invite-drafts", () => ({
  invite_drafts: {
    id: "id",
    candidate_id: "candidate_id",
    role_brief_id: "role_brief_id",
    status: "status",
    sent_at_ms: "sent_at_ms",
    created_at_ms: "created_at_ms",
    updated_at_ms: "updated_at_ms",
  },
  INVITE_DRAFT_STATUSES: ["pending_review", "sent", "expired"],
  INVITE_HOLD_REASONS: [
    "low_confidence",
    "daily_cap",
    "candidate_throttle",
    "cross_role_cap",
    "drift_check_failed",
  ],
}));

vi.mock("@/lib/db/schema/candidates", () => ({
  candidates: {
    id: "id",
    stage: "stage",
    email: "email",
    role_brief_id: "role_brief_id",
  },
  CANDIDATE_STAGES: [
    "sourced",
    "invited",
    "applied",
    "screened",
    "trial",
    "bench",
    "archived",
  ],
}));

// ---------------------------------------------------------------------------
// Tests — Invite Gate
// ---------------------------------------------------------------------------

describe("evaluateInviteSendGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockReturnValue([]);
  });

  it("returns autoSend=true when all checks pass", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.9,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(true);
    expect(result.holdReason).toBeNull();
  });

  it("holds for low confidence below threshold", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.5,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("low_confidence");
  });

  it("uses higher FT threshold for employee engagement type", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.9,
      engagementType: "employee",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("low_confidence");
  });

  it("holds when daily cap per role is breached", async () => {
    mockDbAll
      .mockReturnValueOnce([{ id: "d1" }, { id: "d2" }, { id: "d3" }])
      .mockReturnValue([]);

    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.9,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("daily_cap");
  });

  it("holds when per-candidate throttle is active", async () => {
    mockDbAll
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: "recent-send" }])
      .mockReturnValue([]);

    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.9,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("candidate_throttle");
  });

  it("holds when cross-role annual cap is breached", async () => {
    mockDbAll
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);

    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.9,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("cross_role_cap");
  });

  it("holds when auto_send_enabled is false", async () => {
    mockSettingsStore["hiring.invite.auto_send_enabled"] = false;

    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.99,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("low_confidence");

    mockSettingsStore["hiring.invite.auto_send_enabled"] = true;
  });

  it("skips daily cap check when roleBriefId is null", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: null,
      confidence: 0.9,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(true);
    expect(result.holdReason).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Process Invite Draft
// ---------------------------------------------------------------------------

describe("processInviteDraft", () => {
  const mockCandidate = {
    id: "cand-1",
    name: "Jane Doe",
    email: "jane@example.com",
    stage: "sourced" as const,
    source: "sourced" as const,
    engagement_type: "contractor" as const,
    role_brief_id: "brief-1",
    discovery_source: null,
    location_city: null,
    portfolio_urls_json: null,
    rate_expectation_aud: null,
    rate_expectation_unit: null,
    availability_hours_per_week: null,
    available_from_ms: null,
    application_followup_question: null,
    application_followup_reply: null,
    followup_status: null,
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
    stage_before_archive: null,
    first_seen_at_ms: Date.now(),
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
  };

  const mockDraft = {
    subject: "Hey — saw your reel",
    body: "Your food stuff is solid. Interested?",
    confidence: 0.9,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockReturnValue([]);
    mockDbInsertReturning.mockReturnValue([]);
  });

  it("auto-sends when gate passes and drift check passes", async () => {
    const { processInviteDraft } = await import(
      "@/lib/hiring/send-invite"
    );
    const { sendEmail } = await import("@/lib/channels/email/send");
    const { transitionCandidateStage } = await import(
      "@/lib/hiring/transition-candidate-stage"
    );

    const result = await processInviteDraft({
      candidate: mockCandidate,
      draft: mockDraft,
      roleBriefId: "brief-1",
      by: "user:admin",
    });

    expect(result.autoSent).toBe(true);
    expect(result.holdReason).toBeNull();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        classification: "hiring_invite",
      }),
    );
    expect(transitionCandidateStage).toHaveBeenCalledWith(
      "cand-1",
      "invited",
      expect.objectContaining({ by: "user:admin" }),
    );
  });

  it("queues draft when drift check fails", async () => {
    const { checkBrandVoiceDrift } = await import("@/lib/ai/drift-check");
    vi.mocked(checkBrandVoiceDrift).mockResolvedValueOnce({
      pass: false,
      score: 0.4,
      notes: "Too salesy",
    });

    const { processInviteDraft } = await import(
      "@/lib/hiring/send-invite"
    );

    const result = await processInviteDraft({
      candidate: mockCandidate,
      draft: mockDraft,
      roleBriefId: "brief-1",
      by: "user:admin",
    });

    expect(result.autoSent).toBe(false);
    expect(result.holdReason).toBe("drift_check_failed");
  });

  it("queues draft when confidence is below threshold", async () => {
    const { processInviteDraft } = await import(
      "@/lib/hiring/send-invite"
    );

    const result = await processInviteDraft({
      candidate: mockCandidate,
      draft: { ...mockDraft, confidence: 0.5 },
      roleBriefId: "brief-1",
      by: "user:admin",
    });

    expect(result.autoSent).toBe(false);
    expect(result.holdReason).toBe("low_confidence");
  });
});

// ---------------------------------------------------------------------------
// Tests — Send Invite Draft (manual send)
// ---------------------------------------------------------------------------

describe("sendInviteDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when draft not found", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.query.invite_drafts.findFirst).mockResolvedValueOnce(
      undefined,
    );

    const { sendInviteDraft } = await import("@/lib/hiring/send-invite");
    const result = await sendInviteDraft("nonexistent", "user:admin");

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Draft not found.");
  });

  it("returns error when draft already sent", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.query.invite_drafts.findFirst).mockResolvedValueOnce({
      id: "draft-1",
      candidate_id: "cand-1",
      role_brief_id: "brief-1",
      subject: "Hey",
      body: "Interested?",
      confidence: 0.9,
      drift_check_score: 0.9,
      drift_check_pass: true,
      status: "sent",
      hold_reason: null,
      sent_at_ms: Date.now(),
      email_message_id: "msg-123",
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    } as never);

    const { sendInviteDraft } = await import("@/lib/hiring/send-invite");
    const result = await sendInviteDraft("draft-1", "user:admin");

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Already sent.");
  });

  it("returns error when candidate has no email", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.query.invite_drafts.findFirst).mockResolvedValueOnce({
      id: "draft-1",
      candidate_id: "cand-1",
      role_brief_id: "brief-1",
      subject: "Hey",
      body: "Interested?",
      confidence: 0.9,
      drift_check_score: null,
      drift_check_pass: null,
      status: "pending_review",
      hold_reason: "low_confidence",
      sent_at_ms: null,
      email_message_id: null,
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    } as never);

    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce({
      id: "cand-1",
      name: "No Email",
      email: null,
      stage: "sourced",
    } as never);

    const { sendInviteDraft } = await import("@/lib/hiring/send-invite");
    const result = await sendInviteDraft("draft-1", "user:admin");

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Candidate has no email.");
  });

  it("sends email and transitions candidate on success", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.query.invite_drafts.findFirst).mockResolvedValueOnce({
      id: "draft-1",
      candidate_id: "cand-1",
      role_brief_id: "brief-1",
      subject: "Hey",
      body: "Interested?",
      confidence: 0.9,
      drift_check_score: 0.9,
      drift_check_pass: true,
      status: "pending_review",
      hold_reason: "low_confidence",
      sent_at_ms: null,
      email_message_id: null,
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    } as never);

    vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce({
      id: "cand-1",
      name: "Jane Doe",
      email: "jane@example.com",
      stage: "sourced",
    } as never);

    const { sendInviteDraft } = await import("@/lib/hiring/send-invite");
    const { sendEmail } = await import("@/lib/channels/email/send");
    const { transitionCandidateStage } = await import(
      "@/lib/hiring/transition-candidate-stage"
    );

    const result = await sendInviteDraft("draft-1", "user:admin");

    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: "Hey",
        classification: "hiring_invite",
      }),
    );
    expect(transitionCandidateStage).toHaveBeenCalledWith(
      "cand-1",
      "invited",
      expect.objectContaining({ by: "user:admin" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — Scheduled Task Handler
// ---------------------------------------------------------------------------

describe("handleHiringInviteSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when outreach_send_enabled is false", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    (killSwitches as Record<string, boolean>).outreach_send_enabled = false;

    const { HIRING_INVITE_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-invite"
    );
    const handler = HIRING_INVITE_HANDLERS.hiring_invite_send;

    await handler({
      id: "task-1",
      task_type: "hiring_invite_send",
      run_at_ms: Date.now(),
      payload: { draft_id: "draft-1" },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: null,
      last_error: null,
      idempotency_key: null,
      created_at_ms: Date.now(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    const { sendEmail } = await import("@/lib/channels/email/send");
    expect(sendEmail).not.toHaveBeenCalled();

    (killSwitches as Record<string, boolean>).outreach_send_enabled = true;
  });

  it("throws when payload has no draft_id", async () => {
    const { HIRING_INVITE_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-invite"
    );
    const handler = HIRING_INVITE_HANDLERS.hiring_invite_send;

    await expect(
      handler({
        id: "task-1",
        task_type: "hiring_invite_send",
        run_at_ms: Date.now(),
        payload: null,
        status: "running",
        attempts: 1,
        last_attempted_at_ms: null,
        last_error: null,
        idempotency_key: null,
        created_at_ms: Date.now(),
        done_at_ms: null,
        reclaimed_at_ms: null,
      }),
    ).rejects.toThrow("missing draft_id");
  });
});

// ---------------------------------------------------------------------------
// Tests — Invite Draft Schema types
// ---------------------------------------------------------------------------

describe("invite_drafts schema", () => {
  it("exports expected status values", async () => {
    const { INVITE_DRAFT_STATUSES } = await import(
      "@/lib/db/schema/invite-drafts"
    );
    expect(INVITE_DRAFT_STATUSES).toContain("pending_review");
    expect(INVITE_DRAFT_STATUSES).toContain("sent");
    expect(INVITE_DRAFT_STATUSES).toContain("expired");
  });

  it("exports expected hold reason values", async () => {
    const { INVITE_HOLD_REASONS } = await import(
      "@/lib/db/schema/invite-drafts"
    );
    expect(INVITE_HOLD_REASONS).toContain("low_confidence");
    expect(INVITE_HOLD_REASONS).toContain("daily_cap");
    expect(INVITE_HOLD_REASONS).toContain("candidate_throttle");
    expect(INVITE_HOLD_REASONS).toContain("cross_role_cap");
    expect(INVITE_HOLD_REASONS).toContain("drift_check_failed");
  });
});

// ---------------------------------------------------------------------------
// Tests — Gate edge cases
// ---------------------------------------------------------------------------

describe("invite gate edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockReturnValue([]);
    mockSettingsStore["hiring.invite.auto_send_enabled"] = true;
  });

  it("contractor at exactly threshold passes", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.85,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(true);
  });

  it("employee at exactly FT threshold passes", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.95,
      engagementType: "employee",
    });

    expect(result.autoSend).toBe(true);
  });

  it("confidence just below threshold holds", async () => {
    const { evaluateInviteSendGate } = await import(
      "@/lib/hiring/invite-gate"
    );

    const result = await evaluateInviteSendGate({
      candidateId: "cand-1",
      roleBriefId: "brief-1",
      confidence: 0.849,
      engagementType: "contractor",
    });

    expect(result.autoSend).toBe(false);
    expect(result.holdReason).toBe("low_confidence");
  });
});
