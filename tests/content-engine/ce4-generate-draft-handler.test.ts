import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => ({ total: 0 })),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_automations_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(),
}));

vi.mock("@/lib/content-engine/generate-blog-post", () => ({
  generateBlogPost: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  default: { get: vi.fn() },
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { generateBlogPost } from "@/lib/content-engine/generate-blog-post";
import settingsRegistry from "@/lib/settings";
import { db } from "@/lib/db";
import {
  handleContentGenerateDraft,
  ensureContentGenerationEnqueued,
  ContentGenerateDraftPayloadSchema,
} from "@/lib/scheduled-tasks/handlers/content-generate-draft";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTask(payload: Record<string, unknown>): ScheduledTaskRow {
  return {
    id: "task-1",
    task_type: "content_generate_draft",
    run_at_ms: Date.now(),
    payload,
    status: "running",
    attempts: 0,
    idempotency_key: null,
    created_at_ms: Date.now(),
    done_at_ms: null,
    last_attempted_at_ms: null,
    last_error: null,
    reclaimed_at_ms: null,
  };
}

function mockPublishedCount(count: number) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ total: count }),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("content_generate_draft handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_automations_enabled = true;
    vi.mocked(settingsRegistry.get).mockResolvedValue(4 as never);
    mockPublishedCount(0);
    vi.mocked(generateBlogPost).mockResolvedValue({
      ok: true,
      postId: "post-abc",
    });
  });

  it("exits silently when kill switch is off", async () => {
    (killSwitches as Record<string, boolean>).content_automations_enabled =
      false;
    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));
    expect(generateBlogPost).not.toHaveBeenCalled();
    expect(enqueueTask).not.toHaveBeenCalled();
  });

  it("throws on invalid payload", async () => {
    await expect(handleContentGenerateDraft(makeTask({}))).rejects.toThrow(
      "invalid payload",
    );
  });

  it("calls generateBlogPost and logs on success", async () => {
    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    expect(generateBlogPost).toHaveBeenCalledWith("co-1");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "co-1",
        kind: "content_draft_generated",
      }),
    );
  });

  it("self-re-enqueues after successful generation", async () => {
    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_generate_draft",
        payload: { company_id: "co-1" },
      }),
    );
  });

  it("self-re-enqueues even on soft failures (no_topic, already_generating)", async () => {
    vi.mocked(generateBlogPost).mockResolvedValue({
      ok: false,
      reason: "no_topic",
    });

    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    expect(enqueueTask).toHaveBeenCalledTimes(1);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("skips generation and delays when monthly cap is reached", async () => {
    mockPublishedCount(4); // at cap
    vi.mocked(settingsRegistry.get).mockResolvedValue(4 as never);

    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    expect(generateBlogPost).not.toHaveBeenCalled();
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_generate_draft",
      }),
    );

    // Should schedule ~30 days out (cap-reached delay)
    const call = vi.mocked(enqueueTask).mock.calls[0]![0];
    const delayMs =
      (typeof call.runAt === "number" ? call.runAt : call.runAt.getTime()) -
      Date.now();
    const delayDays = delayMs / (24 * 60 * 60 * 1000);
    expect(delayDays).toBeCloseTo(30, 0);
  });

  it("paces interval based on tier cap (4 posts/month ≈ 7.5 day interval)", async () => {
    vi.mocked(settingsRegistry.get).mockResolvedValue(4 as never);

    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    const call = vi.mocked(enqueueTask).mock.calls[0]![0];
    const delayMs =
      (typeof call.runAt === "number" ? call.runAt : call.runAt.getTime()) -
      Date.now();
    const delayDays = delayMs / (24 * 60 * 60 * 1000);
    expect(delayDays).toBeCloseTo(7.5, 0);
  });

  it("paces interval for large tier (20 posts/month ≈ 1.5 day interval)", async () => {
    vi.mocked(settingsRegistry.get).mockResolvedValue(20 as never);

    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    const call = vi.mocked(enqueueTask).mock.calls[0]![0];
    const delayMs =
      (typeof call.runAt === "number" ? call.runAt : call.runAt.getTime()) -
      Date.now();
    const delayDays = delayMs / (24 * 60 * 60 * 1000);
    expect(delayDays).toBeCloseTo(1.5, 0);
  });

  it("floors interval at 12 hours for very high caps", async () => {
    vi.mocked(settingsRegistry.get).mockResolvedValue(100 as never);

    await handleContentGenerateDraft(makeTask({ company_id: "co-1" }));

    const call = vi.mocked(enqueueTask).mock.calls[0]![0];
    const delayMs =
      (typeof call.runAt === "number" ? call.runAt : call.runAt.getTime()) -
      Date.now();
    const delayHours = delayMs / (60 * 60 * 1000);
    expect(delayHours).toBeCloseTo(12, 0);
  });
});

describe("ContentGenerateDraftPayloadSchema", () => {
  it("accepts valid payload", () => {
    const result = ContentGenerateDraftPayloadSchema.safeParse({
      company_id: "co-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing company_id", () => {
    const result = ContentGenerateDraftPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty company_id", () => {
    const result = ContentGenerateDraftPayloadSchema.safeParse({
      company_id: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("ensureContentGenerationEnqueued", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a bootstrap task 1 hour from now", async () => {
    const nowMs = Date.now();
    await ensureContentGenerationEnqueued("co-1", nowMs);

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_generate_draft",
        payload: { company_id: "co-1" },
        idempotencyKey: "content_generate_draft:co-1:bootstrap",
      }),
    );

    const call = vi.mocked(enqueueTask).mock.calls[0]![0];
    const runAtMs =
      typeof call.runAt === "number" ? call.runAt : call.runAt.getTime();
    expect(runAtMs - nowMs).toBe(60 * 60 * 1000);
  });
});
