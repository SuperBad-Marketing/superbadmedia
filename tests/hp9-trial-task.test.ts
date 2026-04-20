import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ─────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
    all: vi.fn().mockReturnValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1 }),
    query: {
      candidates: { findFirst: vi.fn() },
      role_briefs: { findFirst: vi.fn() },
      trial_tasks: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => {
      const defaults: Record<string, unknown> = {
        "hiring.trial.delivery_deadline_days": 7,
        "hiring.trial.delivery_grace_days": 3,
        "hiring.trial.default_budget_cap_hours": 4,
      };
      return Promise.resolve(defaults[key] ?? null);
    }),
  },
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/content-engine/claimable-items", () => ({
  listClaimableContentItems: vi.fn(),
  claimInternalContentItem: vi.fn(),
}));

vi.mock("@/lib/hiring/queries", () => ({
  getCandidateById: vi.fn(),
  getRoleBriefById: vi.fn(),
  createTrialTask: vi.fn(),
  getTrialTaskById: vi.fn(),
  updateTrialTask: vi.fn(),
  createCandidateArchive: vi.fn(),
}));

vi.mock("@/lib/hiring/transition-candidate-stage", () => ({
  transitionCandidateStage: vi.fn(),
}));

vi.mock("@/lib/channels/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg-1" }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { scheduled_tasks_enabled: true },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────

import { proposeTrialTask, confirmAndSendTrialTask } from "@/lib/hiring/trial-task";
import { handleHiringTrialTaskOverdue } from "@/lib/scheduled-tasks/handlers/hiring-trial";
import { getCandidateById, getRoleBriefById, createTrialTask, getTrialTaskById, updateTrialTask, createCandidateArchive } from "@/lib/hiring/queries";
import { listClaimableContentItems, claimInternalContentItem } from "@/lib/content-engine/claimable-items";
import { invokeLlmText } from "@/lib/ai/invoke";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { sendEmail } from "@/lib/channels/email";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

// ── Fixtures ──────────────────────────────────────────────────────────

const CANDIDATE_SCREENED = {
  id: "cand-1",
  name: "Jane Doe",
  email: "jane@example.com",
  stage: "screened",
  role_brief_id: "rb-1",
  rate_expectation_aud: 100,
  rate_expectation_unit: "hourly",
  portfolio_signal_json: {
    extracted_tags: ["documentary", "food-beverage"],
    bio: "Food + bev filmmaker based in Melbourne.",
  },
};

const ROLE_BRIEF = {
  id: "rb-1",
  role_name: "Video Editor — food/beverage",
  style_summary: "Handheld, warm, narrative pacing.",
  extracted_tags_json: ["handheld", "warm", "food"],
};

const BACKLOG_ITEMS = [
  {
    id: "ct-1",
    keyword: "Melbourne coffee culture short",
    rankabilityScore: 72,
    outline: "A 60-second social edit about Melbourne coffee culture.",
    status: "queued",
    createdAtMs: Date.now() - 86400000,
  },
  {
    id: "ct-2",
    keyword: "SuperBad behind the scenes",
    rankabilityScore: 55,
    outline: "BTS reel from a recent shoot.",
    status: "queued",
    createdAtMs: Date.now() - 172800000,
  },
];

const LLM_RESPONSE = JSON.stringify({
  content_item_id: "ct-1",
  rationale: "Jane's food-beverage documentary style maps directly to this coffee culture edit. It stretches her toward tighter pacing for social format.",
  task_description: "Edit a 60-second social video about Melbourne coffee culture. Use provided B-roll footage. Deliverable: MP4, 1080p, 60-90 seconds, with captions.",
  budget_cap_hours: 4,
  deliverable_format: "MP4, 1080p, 60-90 seconds",
});

// ── proposeTrialTask ──────────────────────────────────────────────────

describe("proposeTrialTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a proposal when candidate, brief, and backlog are available", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(ROLE_BRIEF as any);
    vi.mocked(listClaimableContentItems).mockResolvedValue(BACKLOG_ITEMS);
    vi.mocked(invokeLlmText).mockResolvedValue(LLM_RESPONSE);

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.contentItemId).toBe("ct-1");
    expect(result.proposal.rationale).toContain("coffee culture");
    expect(result.proposal.budgetCapHours).toBe(4);
    expect(result.budgetCapAud).toBe(400); // 100 * 4
    expect(result.candidateName).toBe("Jane Doe");
    expect(result.roleName).toBe("Video Editor — food/beverage");
  });

  it("fails if candidate not found", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(undefined);

    const result = await proposeTrialTask("cand-xxx");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("Candidate not found.");
  });

  it("fails if candidate is not in screened stage", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      ...CANDIDATE_SCREENED,
      stage: "applied",
    } as any);

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("must be 'screened'");
  });

  it("fails if no claimable content items", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(ROLE_BRIEF as any);
    vi.mocked(listClaimableContentItems).mockResolvedValue([]);

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("No claimable content items");
  });

  it("fails if LLM returns no_match", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(ROLE_BRIEF as any);
    vi.mocked(listClaimableContentItems).mockResolvedValue(BACKLOG_ITEMS);
    vi.mocked(invokeLlmText).mockResolvedValue(
      JSON.stringify({ no_match: true, reason: "No suitable items for video editors." }),
    );

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("No suitable items");
  });

  it("fails if candidate has no role brief", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      ...CANDIDATE_SCREENED,
      role_brief_id: null,
    } as any);

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("no linked Role Brief");
  });

  it("uses default rate of $80/hr when candidate rate is null", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      ...CANDIDATE_SCREENED,
      rate_expectation_aud: null,
    } as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(ROLE_BRIEF as any);
    vi.mocked(listClaimableContentItems).mockResolvedValue(BACKLOG_ITEMS);
    vi.mocked(invokeLlmText).mockResolvedValue(LLM_RESPONSE);

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.budgetCapAud).toBe(320); // 4 * 80 fallback
  });

  it("handles LLM response with markdown fences", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(ROLE_BRIEF as any);
    vi.mocked(listClaimableContentItems).mockResolvedValue(BACKLOG_ITEMS);
    vi.mocked(invokeLlmText).mockResolvedValue("```json\n" + LLM_RESPONSE + "\n```");

    const result = await proposeTrialTask("cand-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.contentItemId).toBe("ct-1");
  });
});

// ── confirmAndSendTrialTask ──────────────────────────────────────────

describe("confirmAndSendTrialTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const confirmInput = {
    candidateId: "cand-1",
    contentItemId: "ct-1",
    taskDescription: "Edit a 60-second social video.",
    budgetCapAud: 400,
    ratePerUnitAud: 100,
    rateUnit: "hourly",
    deadlineDays: 7,
    by: "user:admin",
  };

  it("claims content, creates trial task, sends email, transitions to trial", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(claimInternalContentItem).mockResolvedValue({ ok: true });
    vi.mocked(createTrialTask).mockResolvedValue({
      id: "tt-1",
      ...confirmInput,
    } as any);

    const result = await confirmAndSendTrialTask(confirmInput);

    expect(result.ok).toBe(true);
    expect(claimInternalContentItem).toHaveBeenCalledWith("ct-1", "cand-1", 400);
    expect(createTrialTask).toHaveBeenCalled();
    expect(transitionCandidateStage).toHaveBeenCalledWith(
      "cand-1",
      "trial",
      expect.objectContaining({ by: "user:admin" }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        classification: "hiring_trial_send",
      }),
    );
    expect(logActivity).toHaveBeenCalled();
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "hiring_trial_task_overdue",
      }),
    );
  });

  it("fails if candidate not found", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(undefined);

    const result = await confirmAndSendTrialTask(confirmInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("Candidate not found.");
  });

  it("fails if candidate not in screened stage", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      ...CANDIDATE_SCREENED,
      stage: "bench",
    } as any);

    const result = await confirmAndSendTrialTask(confirmInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("must be 'screened'");
  });

  it("fails if candidate has no email", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      ...CANDIDATE_SCREENED,
      email: null,
    } as any);

    const result = await confirmAndSendTrialTask(confirmInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("no email");
  });

  it("fails if content claim fails", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(claimInternalContentItem).mockResolvedValue({
      ok: false,
      reason: "already_claimed",
    });

    const result = await confirmAndSendTrialTask(confirmInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("already_claimed");
  });

  it("enqueues overdue task at deadline + grace days", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(CANDIDATE_SCREENED as any);
    vi.mocked(claimInternalContentItem).mockResolvedValue({ ok: true });
    vi.mocked(createTrialTask).mockResolvedValue({
      id: "tt-1",
      ...confirmInput,
    } as any);

    await confirmAndSendTrialTask(confirmInput);

    const enqueueCall = vi.mocked(enqueueTask).mock.calls[0][0];
    expect(enqueueCall.task_type).toBe("hiring_trial_task_overdue");
    expect(enqueueCall.idempotencyKey).toBe("trial-overdue-tt-1");
  });
});

// ── handleHiringTrialTaskOverdue ──────────────────────────────────────

describe("handleHiringTrialTaskOverdue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips if trial task already delivered", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      id: "tt-1",
      delivered_at_ms: Date.now(),
      disposition: "pending",
    } as any);

    await handleHiringTrialTaskOverdue({
      id: "st-1",
      task_type: "hiring_trial_task_overdue",
      payload: { trial_task_id: "tt-1", candidate_id: "cand-1" },
    } as any);

    expect(transitionCandidateStage).not.toHaveBeenCalled();
    expect(enqueueTask).not.toHaveBeenCalled();
  });

  it("skips if trial task disposition is not pending", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      id: "tt-1",
      delivered_at_ms: null,
      disposition: "shipped",
    } as any);

    await handleHiringTrialTaskOverdue({
      id: "st-1",
      task_type: "hiring_trial_task_overdue",
      payload: { trial_task_id: "tt-1", candidate_id: "cand-1" },
    } as any);

    expect(transitionCandidateStage).not.toHaveBeenCalled();
  });

  it("logs overdue and enqueues final task on first fire", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      id: "tt-1",
      delivered_at_ms: null,
      disposition: "pending",
    } as any);
    vi.mocked(getCandidateById).mockResolvedValue({
      id: "cand-1",
      name: "Jane Doe",
      stage: "trial",
    } as any);

    await handleHiringTrialTaskOverdue({
      id: "st-1",
      task_type: "hiring_trial_task_overdue",
      payload: { trial_task_id: "tt-1", candidate_id: "cand-1" },
    } as any);

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "candidate_trial_sent",
        meta: expect.objectContaining({ overdue: true }),
      }),
    );
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "hiring_trial_task_overdue",
        payload: expect.objectContaining({ is_final: true }),
      }),
    );
    expect(transitionCandidateStage).not.toHaveBeenCalled();
  });

  it("auto-archives candidate on final fire", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      id: "tt-1",
      delivered_at_ms: null,
      disposition: "pending",
    } as any);
    vi.mocked(getCandidateById).mockResolvedValue({
      id: "cand-1",
      name: "Jane Doe",
      stage: "trial",
    } as any);

    await handleHiringTrialTaskOverdue({
      id: "st-1",
      task_type: "hiring_trial_task_overdue",
      payload: { trial_task_id: "tt-1", candidate_id: "cand-1", is_final: true },
    } as any);

    expect(createCandidateArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate_id: "cand-1",
        reason_code: "didnt_deliver",
        disposition_direction: "we_archived",
      }),
    );
    expect(transitionCandidateStage).toHaveBeenCalledWith(
      "cand-1",
      "archived",
      expect.objectContaining({ by: "system:trial-overdue" }),
    );
    expect(updateTrialTask).toHaveBeenCalledWith("tt-1", { disposition: "archived" });
  });

  it("skips if candidate no longer in trial stage", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      id: "tt-1",
      delivered_at_ms: null,
      disposition: "pending",
    } as any);
    vi.mocked(getCandidateById).mockResolvedValue({
      id: "cand-1",
      name: "Jane Doe",
      stage: "bench",
    } as any);

    await handleHiringTrialTaskOverdue({
      id: "st-1",
      task_type: "hiring_trial_task_overdue",
      payload: { trial_task_id: "tt-1", candidate_id: "cand-1" },
    } as any);

    expect(logActivity).not.toHaveBeenCalled();
    expect(enqueueTask).not.toHaveBeenCalled();
  });

  it("skips if payload is missing", async () => {
    await handleHiringTrialTaskOverdue({
      id: "st-1",
      task_type: "hiring_trial_task_overdue",
      payload: null,
    } as any);

    expect(getTrialTaskById).not.toHaveBeenCalled();
  });
});

// ── Prompt builder ────────────────────────────────────────────────────

describe("trial-task-author prompt", () => {
  it("builds a prompt with candidate and backlog context", async () => {
    const {
      buildTrialTaskAuthorPrompt,
      buildTrialTaskAuthorSystem,
    } = await import("@/lib/ai/prompts/hiring/trial-task-author");

    const prompt = buildTrialTaskAuthorPrompt({
      candidateName: "Jane Doe",
      candidateStyleTags: ["documentary", "food"],
      candidatePortfolioSummary: "Food filmmaker.",
      candidateRateAud: 100,
      candidateRateUnit: "hourly",
      roleName: "Video Editor",
      roleStyleSummary: "Warm, narrative.",
      roleExtractedTags: ["handheld"],
      backlogItems: BACKLOG_ITEMS,
      defaultBudgetCapHours: 4,
    });

    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Melbourne coffee culture short");
    expect(prompt).toContain("Video Editor");
    expect(prompt).toContain("content_item_id");
    expect(prompt).toContain("$100/hourly");

    const system = buildTrialTaskAuthorSystem();
    expect(system).toContain("creative director");
  });
});
