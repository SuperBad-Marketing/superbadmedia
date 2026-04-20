import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

const mockBuildTaskDigestContent = vi.fn().mockResolvedValue(null);
const mockSendTaskDigestEmail = vi.fn().mockResolvedValue({ sent: true });
const mockHasAdminSignedInToday = vi.fn().mockResolvedValue(false);

vi.mock("@/lib/tasks/digest", () => ({
  buildTaskDigestContent: (...args: unknown[]) =>
    mockBuildTaskDigestContent(...args),
  sendTaskDigestEmail: (...args: unknown[]) =>
    mockSendTaskDigestEmail(...args),
  hasAdminSignedInToday: (...args: unknown[]) =>
    mockHasAdminSignedInToday(...args),
  melbourneStartAndEndOfDay: vi.fn(),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    tasks_digest_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

const mockSettingsValues: Record<string, unknown> = {
  "tasks.morning_digest_enabled": true,
  "tasks.morning_digest_time": "08:00",
};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => Promise.resolve(mockSettingsValues[key])),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(() => Promise.resolve({ id: "test" })),
}));

const mockEnqueueTask = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: (...args: unknown[]) => mockEnqueueTask(...args),
}));

import {
  handleTaskMorningDigest,
  ensureTaskDigestEnqueued,
  TASK_DIGEST_TASK_KEY_PREFIX,
} from "@/lib/scheduled-tasks/handlers/task-morning-digest";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";

// ── Tests ───────────────────────────────────────────────────────────

describe("task-morning-digest-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildTaskDigestContent.mockResolvedValue(null);
    mockSendTaskDigestEmail.mockResolvedValue({ sent: true });
    mockHasAdminSignedInToday.mockResolvedValue(false);
    mockSettingsValues["tasks.morning_digest_enabled"] = true;
    mockSettingsValues["tasks.morning_digest_time"] = "08:00";
    (killSwitches as Record<string, boolean>).tasks_digest_enabled = true;
  });

  describe("handleTaskMorningDigest", () => {
    it("returns early when kill switch is disabled", async () => {
      (killSwitches as Record<string, boolean>).tasks_digest_enabled = false;
      await handleTaskMorningDigest();
      expect(mockBuildTaskDigestContent).not.toHaveBeenCalled();
      expect(mockEnqueueTask).not.toHaveBeenCalled();
    });

    it("returns early when settings morning_digest_enabled is false", async () => {
      mockSettingsValues["tasks.morning_digest_enabled"] = false;
      await handleTaskMorningDigest();
      expect(mockHasAdminSignedInToday).not.toHaveBeenCalled();
      expect(mockBuildTaskDigestContent).not.toHaveBeenCalled();
    });

    it("skips send but self-perpetuates when admin has signed in", async () => {
      mockHasAdminSignedInToday.mockResolvedValue(true);
      await handleTaskMorningDigest();
      expect(mockBuildTaskDigestContent).not.toHaveBeenCalled();
      expect(mockSendTaskDigestEmail).not.toHaveBeenCalled();
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    });

    it("skips send but self-perpetuates when nothing to report", async () => {
      mockBuildTaskDigestContent.mockResolvedValue(null);
      await handleTaskMorningDigest();
      expect(mockSendTaskDigestEmail).not.toHaveBeenCalled();
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    });

    it("sends email and logs activity on happy path", async () => {
      const content = {
        subject: "Task digest — 2 overdue.",
        bodyHtml: "<div>test</div>",
        overdue: [
          { id: "1", title: "Task A", kind: "admin", priority: "high", due_at_ms: 1 },
          { id: "2", title: "Task B", kind: "admin", priority: "normal", due_at_ms: 2 },
        ],
        dueToday: [],
        approvalOutcomes: [],
      };
      mockBuildTaskDigestContent.mockResolvedValue(content);
      await handleTaskMorningDigest();
      expect(mockSendTaskDigestEmail).toHaveBeenCalledWith(content);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "task_digest_sent",
          meta: expect.objectContaining({
            overdue_count: 2,
            due_today_count: 0,
            approval_outcomes_count: 0,
          }),
        }),
      );
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    });

    it("does not log activity when send fails", async () => {
      const content = {
        subject: "Task digest — 1 due today.",
        bodyHtml: "<div>test</div>",
        overdue: [],
        dueToday: [{ id: "1", title: "X", kind: "admin", priority: "normal", due_at_ms: 1 }],
        approvalOutcomes: [],
      };
      mockBuildTaskDigestContent.mockResolvedValue(content);
      mockSendTaskDigestEmail.mockResolvedValue({ sent: false, skipped: true, reason: "ADMIN_EMAIL not set" });
      await handleTaskMorningDigest();
      expect(logActivity).not.toHaveBeenCalled();
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    });

    it("includes approval outcomes in activity log body", async () => {
      const content = {
        subject: "Task digest — 1 approved.",
        bodyHtml: "<div>test</div>",
        overdue: [],
        dueToday: [],
        approvalOutcomes: [
          { id: "1", title: "Deliverable", outcome: "approved" as const, contactName: "Kim", at_ms: 1 },
        ],
      };
      mockBuildTaskDigestContent.mockResolvedValue(content);
      await handleTaskMorningDigest();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("1 approval outcome."),
        }),
      );
    });
  });

  describe("ensureTaskDigestEnqueued", () => {
    it("enqueues with task_morning_digest type", async () => {
      await ensureTaskDigestEnqueued(Date.now());
      expect(mockEnqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: "task_morning_digest",
        }),
      );
    });

    it("uses idempotency key with prefix", async () => {
      await ensureTaskDigestEnqueued(Date.now());
      const call = mockEnqueueTask.mock.calls[0][0];
      expect(call.idempotencyKey).toMatch(
        new RegExp(`^${TASK_DIGEST_TASK_KEY_PREFIX}`),
      );
    });

    it("schedules for future (runAt > now)", async () => {
      const now = Date.now();
      await ensureTaskDigestEnqueued(now);
      const call = mockEnqueueTask.mock.calls[0][0];
      expect(call.runAt).toBeGreaterThan(now);
    });

    it("reads morning_digest_time setting for scheduling", async () => {
      mockSettingsValues["tasks.morning_digest_time"] = "09:30";
      const now = Date.now();
      await ensureTaskDigestEnqueued(now);
      expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
      const call = mockEnqueueTask.mock.calls[0][0];
      expect(call.runAt).toBeGreaterThan(now);
    });
  });

  describe("TASK_DIGEST_TASK_KEY_PREFIX", () => {
    it("is a non-empty string", () => {
      expect(TASK_DIGEST_TASK_KEY_PREFIX).toBeTruthy();
      expect(typeof TASK_DIGEST_TASK_KEY_PREFIX).toBe("string");
    });
  });

  describe("handler registry export", () => {
    it("exports TASK_DIGEST_HANDLERS with task_morning_digest key", async () => {
      const { TASK_DIGEST_HANDLERS } = await import(
        "@/lib/scheduled-tasks/handlers/task-morning-digest"
      );
      expect(TASK_DIGEST_HANDLERS).toHaveProperty("task_morning_digest");
      expect(typeof TASK_DIGEST_HANDLERS.task_morning_digest).toBe("function");
    });
  });

  describe("handler index registration", () => {
    it("task-morning-digest module is imported in handler index source", async () => {
      const { readFileSync } = await import("node:fs");
      const indexSrc = readFileSync(
        new URL("../lib/scheduled-tasks/handlers/index.ts", import.meta.url),
        "utf-8",
      );
      expect(indexSrc).toContain("TASK_DIGEST_HANDLERS");
      expect(indexSrc).toContain("task-morning-digest");
    });
  });
});
