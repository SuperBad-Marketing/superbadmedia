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
      };
      return Promise.resolve(defaults[key] ?? null);
    }),
  },
}));

vi.mock("@/lib/hiring/queries", () => ({
  getTrialTaskById: vi.fn(),
  getCandidateById: vi.fn(),
  updateTrialTask: vi.fn(),
  createCandidateArchive: vi.fn(),
}));

vi.mock("@/lib/hiring/transition-candidate-stage", () => ({
  transitionCandidateStage: vi.fn(),
}));

vi.mock("@/lib/content-engine/claimable-items", () => ({
  releaseContentItem: vi.fn(),
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

import {
  markTrialTaskDelivered,
  reviewTrialTask,
} from "@/lib/hiring/trial-review";
import {
  getTrialTaskById,
  getCandidateById,
  updateTrialTask,
  createCandidateArchive,
} from "@/lib/hiring/queries";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { releaseContentItem } from "@/lib/content-engine/claimable-items";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

// ── Fixtures ──────────────────────────────────────────────────────────

const BASE_TASK = {
  id: "tt-1",
  candidate_id: "c-1",
  role_brief_id: "rb-1",
  internal_content_ref: "ct-1",
  task_description: "Edit the food reel",
  budget_cap_aud: 320,
  rate_per_unit_aud: 80,
  rate_unit: "per_hour",
  sent_at_ms: Date.now() - 7 * 86400000,
  due_at_ms: Date.now() + 86400000,
  delivered_at_ms: null,
  delivery_url_or_asset: null,
  andy_review_notes: null,
  rating: null,
  disposition: "pending" as const,
  created_at_ms: Date.now() - 7 * 86400000,
  updated_at_ms: Date.now() - 7 * 86400000,
};

const BASE_CANDIDATE = {
  id: "c-1",
  name: "Jane Doe",
  email: "jane@example.com",
  stage: "trial" as const,
  role_brief_id: "rb-1",
  source: "sourced" as const,
  engagement_type: "contractor" as const,
  created_at_ms: Date.now(),
  updated_at_ms: Date.now(),
  first_seen_at_ms: Date.now(),
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("markTrialTaskDelivered", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks a pending task as delivered", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue(BASE_TASK as any);
    vi.mocked(getCandidateById).mockResolvedValue(BASE_CANDIDATE as any);
    vi.mocked(updateTrialTask).mockResolvedValue({ ...BASE_TASK, delivered_at_ms: Date.now() } as any);

    const result = await markTrialTaskDelivered({
      trialTaskId: "tt-1",
      deliveryUrl: "https://drive.google.com/file/123",
      by: "user:admin",
    });

    expect(result.ok).toBe(true);
    expect(updateTrialTask).toHaveBeenCalledWith("tt-1", expect.objectContaining({
      delivery_url_or_asset: "https://drive.google.com/file/123",
    }));
    expect(logActivity).toHaveBeenCalled();
  });

  it("rejects if task not found", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue(undefined);

    const result = await markTrialTaskDelivered({
      trialTaskId: "tt-missing",
      deliveryUrl: "https://example.com",
      by: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not found");
  });

  it("rejects if disposition is not pending", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      ...BASE_TASK,
      disposition: "shipped",
    } as any);

    const result = await markTrialTaskDelivered({
      trialTaskId: "tt-1",
      deliveryUrl: "https://example.com",
      by: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("shipped");
  });

  it("rejects if candidate is not in trial stage", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue(BASE_TASK as any);
    vi.mocked(getCandidateById).mockResolvedValue({
      ...BASE_CANDIDATE,
      stage: "screened",
    } as any);

    const result = await markTrialTaskDelivered({
      trialTaskId: "tt-1",
      deliveryUrl: "https://example.com",
      by: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("screened");
  });

  it("rejects if candidate not found", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue(BASE_TASK as any);
    vi.mocked(getCandidateById).mockResolvedValue(undefined);

    const result = await markTrialTaskDelivered({
      trialTaskId: "tt-1",
      deliveryUrl: "https://example.com",
      by: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Candidate not found");
  });
});

describe("reviewTrialTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects rating outside 1–5", async () => {
    const result = await reviewTrialTask({
      trialTaskId: "tt-1",
      notes: "",
      rating: 0,
      disposition: "shipped",
      by: "user:admin",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("1–5");
  });

  it("rejects rating above 5", async () => {
    const result = await reviewTrialTask({
      trialTaskId: "tt-1",
      notes: "",
      rating: 6,
      disposition: "shipped",
      by: "user:admin",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid disposition", async () => {
    const result = await reviewTrialTask({
      trialTaskId: "tt-1",
      notes: "",
      rating: 4,
      disposition: "pending",
      by: "user:admin",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Invalid disposition");
  });

  it("rejects if task not found", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue(undefined);

    const result = await reviewTrialTask({
      trialTaskId: "tt-missing",
      notes: "Good work",
      rating: 4,
      disposition: "shipped",
      by: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not found");
  });

  it("rejects if already reviewed", async () => {
    vi.mocked(getTrialTaskById).mockResolvedValue({
      ...BASE_TASK,
      disposition: "shipped",
    } as any);

    const result = await reviewTrialTask({
      trialTaskId: "tt-1",
      notes: "",
      rating: 4,
      disposition: "shipped",
      by: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("already reviewed");
  });

  describe("shipped disposition", () => {
    beforeEach(() => {
      vi.mocked(getTrialTaskById).mockResolvedValue(BASE_TASK as any);
      vi.mocked(getCandidateById).mockResolvedValue(BASE_CANDIDATE as any);
      vi.mocked(updateTrialTask).mockResolvedValue({ ...BASE_TASK, disposition: "shipped" } as any);
    });

    it("updates task and logs activity", async () => {
      const result = await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "Excellent work",
        rating: 5,
        disposition: "shipped",
        by: "user:admin",
      });

      expect(result.ok).toBe(true);
      expect(updateTrialTask).toHaveBeenCalledWith("tt-1", {
        andy_review_notes: "Excellent work",
        rating: 5,
        disposition: "shipped",
      });
      expect(logActivity).toHaveBeenCalled();
    });

    it("does not archive or transition candidate", async () => {
      await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "",
        rating: 4,
        disposition: "shipped",
        by: "user:admin",
      });

      expect(transitionCandidateStage).not.toHaveBeenCalled();
      expect(createCandidateArchive).not.toHaveBeenCalled();
    });
  });

  describe("archived disposition", () => {
    beforeEach(() => {
      vi.mocked(getTrialTaskById).mockResolvedValue(BASE_TASK as any);
      vi.mocked(getCandidateById).mockResolvedValue(BASE_CANDIDATE as any);
      vi.mocked(updateTrialTask).mockResolvedValue({ ...BASE_TASK, disposition: "archived" } as any);
    });

    it("archives candidate and releases content item", async () => {
      const result = await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "Not up to standard",
        rating: 2,
        disposition: "archived",
        by: "user:admin",
      });

      expect(result.ok).toBe(true);
      expect(createCandidateArchive).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate_id: "c-1",
          stage_when_archived: "trial",
          reason_code: "trial_not_shipped",
          disposition_direction: "we_archived",
        }),
      );
      expect(transitionCandidateStage).toHaveBeenCalledWith(
        "c-1",
        "archived",
        expect.objectContaining({ by: "user:admin" }),
      );
      expect(releaseContentItem).toHaveBeenCalledWith(
        "ct-1",
        expect.stringContaining("Jane Doe"),
      );
    });

    it("skips content release if no content ref", async () => {
      vi.mocked(getTrialTaskById).mockResolvedValue({
        ...BASE_TASK,
        internal_content_ref: null,
      } as any);

      await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "",
        rating: 2,
        disposition: "archived",
        by: "user:admin",
      });

      expect(releaseContentItem).not.toHaveBeenCalled();
    });
  });

  describe("redelivered disposition", () => {
    beforeEach(() => {
      vi.mocked(getTrialTaskById).mockResolvedValue(BASE_TASK as any);
      vi.mocked(getCandidateById).mockResolvedValue(BASE_CANDIDATE as any);
      vi.mocked(updateTrialTask).mockResolvedValue({ ...BASE_TASK } as any);
    });

    it("resets task to pending and extends deadline", async () => {
      const result = await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "Needs more contrast",
        rating: 3,
        disposition: "redelivered",
        by: "user:admin",
      });

      expect(result.ok).toBe(true);

      const updateCalls = vi.mocked(updateTrialTask).mock.calls;
      expect(updateCalls).toHaveLength(2);

      const redeliverUpdate = updateCalls[1][1];
      expect(redeliverUpdate.disposition).toBe("pending");
      expect(redeliverUpdate.delivered_at_ms).toBeNull();
      expect(redeliverUpdate.delivery_url_or_asset).toBeNull();
      expect(redeliverUpdate.due_at_ms).toBeGreaterThan(Date.now());
    });

    it("enqueues new overdue task", async () => {
      await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "",
        rating: 3,
        disposition: "redelivered",
        by: "user:admin",
      });

      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: "hiring_trial_task_overdue",
          payload: expect.objectContaining({ trial_task_id: "tt-1" }),
        }),
      );
    });

    it("does not archive or transition candidate", async () => {
      await reviewTrialTask({
        trialTaskId: "tt-1",
        notes: "",
        rating: 3,
        disposition: "redelivered",
        by: "user:admin",
      });

      expect(transitionCandidateStage).not.toHaveBeenCalled();
      expect(createCandidateArchive).not.toHaveBeenCalled();
    });
  });
});
