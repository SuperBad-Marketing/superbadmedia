import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockSelectGet = vi.fn().mockResolvedValue(undefined);
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

const makeSelectChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: mockSelectGet,
      }),
    }),
  }),
});

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      tasks: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
    select: vi.fn().mockImplementation(() => makeSelectChain()),
  },
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg_1" }),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockImplementation((key: string) => {
      const defaults: Record<string, unknown> = {
        "tasks.morning_digest_enabled": true,
        "tasks.morning_digest_time": "08:00",
      };
      return Promise.resolve(defaults[key]);
    }),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log_1" }),
}));

// --- Helpers ---

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task_1",
    title: "Test task",
    body: null,
    kind: "admin",
    status: "todo",
    priority: "normal",
    due_at_ms: null,
    entity_type: null,
    entity_id: null,
    checklist: null,
    checklist_auto_complete: true,
    recurrence: null,
    recurrence_day: null,
    parent_recurrence_id: null,
    source_braindump_id: null,
    approval_requested_at_ms: null,
    approval_viewed_at_ms: null,
    approved_at_ms: null,
    approved_by_contact_id: null,
    rejected_at_ms: null,
    rejection_feedback: null,
    approval_token: null,
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
    created_by: "user_1",
    completed_at_ms: null,
    ...overrides,
  };
}

// --- Tests ---

describe("TM-7: Task Morning Digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = "andy@test.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://superbadmedia.com.au";
  });

  describe("buildTaskDigestContent", () => {
    it("returns null when nothing to report", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      mockFindMany.mockResolvedValue([]);
      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result).toBeNull();
    });

    it("returns content when overdue tasks exist", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const overdueTask = makeTask({
        id: "overdue_1",
        title: "Overdue task",
        due_at_ms: Date.now() - 2 * DAY_MS,
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [overdueTask]; // overdue
        return []; // due today
      });

      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result).not.toBeNull();
      expect(result!.overdue).toHaveLength(1);
      expect(result!.overdue[0].title).toBe("Overdue task");
    });

    it("returns content when due-today tasks exist", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const todayTask = makeTask({
        id: "today_1",
        title: "Today task",
        due_at_ms: Date.now(),
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return [todayTask]; // due today
        return []; // overdue
      });

      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result).not.toBeNull();
      expect(result!.dueToday).toHaveLength(1);
      expect(result!.dueToday[0].title).toBe("Today task");
    });

    it("returns content when approval outcomes exist", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );

      mockFindMany.mockResolvedValue([]);

      const { db } = await import("@/lib/db");
      let selectCallCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(
              selectCallCount === 1
                ? [
                    {
                      id: "approved_1",
                      title: "Approved deliverable",
                      approved_at_ms: Date.now() - HOUR_MS,
                      approved_by_contact_id: "contact_1",
                    },
                  ]
                : selectCallCount === 2
                  ? []
                  : [{ id: "contact_1", name: "Jake Miller" }],
            ),
          }),
        };
      });

      const result = await buildTaskDigestContent(Date.now());
      expect(result).not.toBeNull();
      expect(result!.approvalOutcomes).toHaveLength(1);
      expect(result!.approvalOutcomes[0].outcome).toBe("approved");
    });
  });

  describe("buildDigestSubject (via buildTaskDigestContent)", () => {
    it("includes overdue count in subject", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const overdueTask = makeTask({
        id: "overdue_1",
        title: "Overdue",
        due_at_ms: Date.now() - 2 * DAY_MS,
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [overdueTask];
        return [];
      });

      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result!.subject).toContain("1 overdue");
    });

    it("includes due today and approval counts", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const todayTask = makeTask({
        id: "today_1",
        title: "Today",
        due_at_ms: Date.now(),
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return [todayTask];
        return [];
      });

      const { db } = await import("@/lib/db");
      let selectCallCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(
              selectCallCount === 1
                ? [
                    {
                      id: "approved_1",
                      title: "Deliverable",
                      approved_at_ms: Date.now() - HOUR_MS,
                      approved_by_contact_id: null,
                    },
                  ]
                : [],
            ),
          }),
        };
      });

      const result = await buildTaskDigestContent(Date.now());
      expect(result!.subject).toContain("1 due today");
      expect(result!.subject).toContain("1 approved");
    });
  });

  describe("sendTaskDigestEmail", () => {
    it("sends to ADMIN_EMAIL with task_morning_digest classification", async () => {
      const { sendTaskDigestEmail } = await import(
        "@/lib/tasks/digest"
      );
      const { sendEmail } = await import("@/lib/channels/email/send");

      const content = {
        subject: "Task digest — 2 overdue.",
        bodyHtml: "<p>test</p>",
        overdue: [
          { id: "1", title: "T1", kind: "admin", priority: "normal", due_at_ms: null },
          { id: "2", title: "T2", kind: "admin", priority: "high", due_at_ms: null },
        ],
        dueToday: [],
        approvalOutcomes: [],
      };

      const result = await sendTaskDigestEmail(content);
      expect(result.sent).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "andy@test.com",
          classification: "task_morning_digest",
          purpose: "task_morning_digest",
        }),
      );
    });

    it("skips when ADMIN_EMAIL is not set", async () => {
      delete process.env.ADMIN_EMAIL;
      const { sendTaskDigestEmail } = await import(
        "@/lib/tasks/digest"
      );

      const content = {
        subject: "test",
        bodyHtml: "<p>test</p>",
        overdue: [],
        dueToday: [],
        approvalOutcomes: [],
      };

      const result = await sendTaskDigestEmail(content);
      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  describe("hasAdminSignedInToday", () => {
    it("returns false when no admin_session_started entries exist today", async () => {
      const { hasAdminSignedInToday } = await import(
        "@/lib/tasks/digest"
      );
      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      }));

      const result = await hasAdminSignedInToday(Date.now());
      expect(result).toBe(false);
    });

    it("returns true when an admin_session_started entry exists today", async () => {
      const { hasAdminSignedInToday } = await import(
        "@/lib/tasks/digest"
      );
      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ id: "log_1" }),
            }),
          }),
        }),
      }));

      const result = await hasAdminSignedInToday(Date.now());
      expect(result).toBe(true);
    });
  });

  describe("digest HTML body", () => {
    it("includes clickable task links", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const overdueTask = makeTask({
        id: "task_abc",
        title: "Fix the thing",
        due_at_ms: Date.now() - DAY_MS,
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [overdueTask];
        return [];
      });

      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result!.bodyHtml).toContain("/lite/tasks?open=task_abc");
      expect(result!.bodyHtml).toContain("Fix the thing");
    });

    it("marks high-priority tasks with !", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const highPriorityTask = makeTask({
        id: "task_hi",
        title: "Urgent task",
        priority: "high",
        due_at_ms: Date.now() - DAY_MS,
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [highPriorityTask];
        return [];
      });

      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result!.bodyHtml).toContain("!");
    });

    it("shows overdue days count", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );
      const overdueTask = makeTask({
        id: "task_late",
        title: "Late task",
        due_at_ms: Date.now() - 3 * DAY_MS,
      });

      let callCount = 0;
      mockFindMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [overdueTask];
        return [];
      });

      const { db } = await import("@/lib/db");
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await buildTaskDigestContent(Date.now());
      expect(result!.bodyHtml).toContain("3d overdue");
    });

    it("includes approval outcome icons", async () => {
      const { buildTaskDigestContent } = await import(
        "@/lib/tasks/digest"
      );

      mockFindMany.mockResolvedValue([]);

      const { db } = await import("@/lib/db");
      let selectCallCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(
              selectCallCount === 1
                ? [
                    {
                      id: "task_ok",
                      title: "Newsletter draft",
                      approved_at_ms: Date.now() - HOUR_MS,
                      approved_by_contact_id: "c1",
                    },
                  ]
                : selectCallCount === 2
                  ? [
                      {
                        id: "task_rej",
                        title: "Logo revision",
                        rejected_at_ms: Date.now() - 2 * HOUR_MS,
                        approved_by_contact_id: "c2",
                      },
                    ]
                  : [
                      { id: "c1", name: "Jake Miller" },
                      { id: "c2", name: "Sara Chen" },
                    ],
            ),
          }),
        };
      });

      const result = await buildTaskDigestContent(Date.now());
      expect(result!.bodyHtml).toContain("\u2713"); // ✓
      expect(result!.bodyHtml).toContain("\u2717"); // ✗
      expect(result!.bodyHtml).toContain("Jake Miller");
      expect(result!.bodyHtml).toContain("Sara Chen");
    });
  });

  describe("email classification", () => {
    it("task_morning_digest is a valid classification", async () => {
      const { EMAIL_CLASSIFICATIONS } = await import(
        "@/lib/channels/email/classifications"
      );
      expect(EMAIL_CLASSIFICATIONS).toContain("task_morning_digest");
    });

    it("task_morning_digest is transactional", async () => {
      const { isTransactional } = await import(
        "@/lib/channels/email/classifications"
      );
      expect(isTransactional("task_morning_digest")).toBe(true);
    });
  });

  describe("kill switch", () => {
    it("tasks_digest_enabled exists and defaults to false", async () => {
      const { killSwitches, resetKillSwitchesToDefaults } = await import(
        "@/lib/kill-switches"
      );
      resetKillSwitchesToDefaults();
      expect(killSwitches.tasks_digest_enabled).toBe(false);
    });
  });

  describe("activity log kind", () => {
    it("admin_session_started is a valid kind", async () => {
      const { ACTIVITY_LOG_KINDS } = await import(
        "@/lib/db/schema/activity-log"
      );
      expect(ACTIVITY_LOG_KINDS).toContain("admin_session_started");
    });

    it("task_digest_sent is a valid kind", async () => {
      const { ACTIVITY_LOG_KINDS } = await import(
        "@/lib/db/schema/activity-log"
      );
      expect(ACTIVITY_LOG_KINDS).toContain("task_digest_sent");
    });
  });

  describe("Melbourne timezone helpers", () => {
    it("melbourneStartAndEndOfDay returns valid bounds", async () => {
      const { melbourneStartAndEndOfDay } = await import(
        "@/lib/time/melbourne"
      );
      const now = Date.now();
      const { startMs, endMs } = melbourneStartAndEndOfDay(now);
      expect(startMs).toBeLessThan(endMs);
      expect(endMs - startMs).toBeLessThanOrEqual(24 * HOUR_MS);
      expect(endMs - startMs).toBeGreaterThan(23 * HOUR_MS);
    });
  });
});
