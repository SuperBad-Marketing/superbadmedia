import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockReturnValue(undefined),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    run: vi.fn(),
    query: {
      candidates: { findFirst: vi.fn() },
      role_briefs: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(2),
  },
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe("HP-17 — Bench pause ending cron + availability helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueBenchPauseEnding", () => {
    it("enqueues a task at the correct warn-days offset", async () => {
      const { enqueueBenchPauseEnding } = await import(
        "@/lib/hiring/bench-pause"
      );
      const { enqueueTask } = await import(
        "@/lib/scheduled-tasks/enqueue"
      );

      const pausedUntilMs = Date.now() + 7 * 86_400_000;
      await enqueueBenchPauseEnding("cand-1", pausedUntilMs);

      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: "hiring_bench_pause_ending",
          payload: { candidate_id: "cand-1" },
          idempotencyKey: `bench_pause_ending:cand-1:${pausedUntilMs}`,
        }),
      );

      const call = vi.mocked(enqueueTask).mock.calls[0][0];
      const expectedRunAt = pausedUntilMs - 2 * 86_400_000;
      expect(call.runAt).toBe(expectedRunAt);
    });

    it("skips enqueue if warn date is already past", async () => {
      const { enqueueBenchPauseEnding } = await import(
        "@/lib/hiring/bench-pause"
      );
      const { enqueueTask } = await import(
        "@/lib/scheduled-tasks/enqueue"
      );

      const pausedUntilMs = Date.now() + 1 * 86_400_000;
      await enqueueBenchPauseEnding("cand-1", pausedUntilMs);

      expect(enqueueTask).not.toHaveBeenCalled();
    });
  });

  describe("hiring_bench_pause_ending handler", () => {
    it("sends notification email when candidate is still paused", async () => {
      const { db } = await import("@/lib/db");
      const { sendEmail } = await import("@/lib/channels/email/send");
      const { logActivity } = await import("@/lib/activity-log");

      const futureMs = Date.now() + 3 * 86_400_000;
      vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce({
        id: "cand-1",
        stage: "bench",
        bench_status: "paused",
        paused_until_ms: futureMs,
        role_brief_id: "rb-1",
        name: "Jane Doe",
      } as any);

      vi.mocked(db.query.role_briefs.findFirst).mockResolvedValueOnce({
        id: "rb-1",
        role_name: "Videographer",
      } as any);

      const { HIRING_BENCH_PAUSE_ENDING_HANDLERS } = await import(
        "@/lib/scheduled-tasks/handlers/hiring-bench-pause-ending"
      );

      const handler =
        HIRING_BENCH_PAUSE_ENDING_HANDLERS.hiring_bench_pause_ending;
      await handler({
        id: "task-1",
        payload: { candidate_id: "cand-1" },
      } as any);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "andy@superbadmedia.com.au",
          classification: "transactional",
          purpose: "bench_pause_ending_reminder",
        }),
      );
      expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toContain(
        "Jane Doe",
      );

      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "bench_pause_ending_notified",
        }),
      );
    });

    it("skips if candidate is no longer paused", async () => {
      const { db } = await import("@/lib/db");
      const { sendEmail } = await import("@/lib/channels/email/send");

      vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce({
        id: "cand-1",
        stage: "bench",
        bench_status: "active",
        paused_until_ms: null,
        name: "Jane Doe",
      } as any);

      const { HIRING_BENCH_PAUSE_ENDING_HANDLERS } = await import(
        "@/lib/scheduled-tasks/handlers/hiring-bench-pause-ending"
      );
      await HIRING_BENCH_PAUSE_ENDING_HANDLERS.hiring_bench_pause_ending({
        id: "task-1",
        payload: { candidate_id: "cand-1" },
      } as any);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("skips if candidate is no longer on bench", async () => {
      const { db } = await import("@/lib/db");
      const { sendEmail } = await import("@/lib/channels/email/send");

      vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce({
        id: "cand-1",
        stage: "archived",
        bench_status: "paused",
        paused_until_ms: Date.now() + 86_400_000,
        name: "Jane Doe",
      } as any);

      const { HIRING_BENCH_PAUSE_ENDING_HANDLERS } = await import(
        "@/lib/scheduled-tasks/handlers/hiring-bench-pause-ending"
      );
      await HIRING_BENCH_PAUSE_ENDING_HANDLERS.hiring_bench_pause_ending({
        id: "task-1",
        payload: { candidate_id: "cand-1" },
      } as any);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("skips if pause has already ended", async () => {
      const { db } = await import("@/lib/db");
      const { sendEmail } = await import("@/lib/channels/email/send");

      vi.mocked(db.query.candidates.findFirst).mockResolvedValueOnce({
        id: "cand-1",
        stage: "bench",
        bench_status: "paused",
        paused_until_ms: Date.now() - 86_400_000,
        name: "Jane Doe",
      } as any);

      const { HIRING_BENCH_PAUSE_ENDING_HANDLERS } = await import(
        "@/lib/scheduled-tasks/handlers/hiring-bench-pause-ending"
      );
      await HIRING_BENCH_PAUSE_ENDING_HANDLERS.hiring_bench_pause_ending({
        id: "task-1",
        payload: { candidate_id: "cand-1" },
      } as any);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("skips if no candidate_id in payload", async () => {
      const { sendEmail } = await import("@/lib/channels/email/send");

      const { HIRING_BENCH_PAUSE_ENDING_HANDLERS } = await import(
        "@/lib/scheduled-tasks/handlers/hiring-bench-pause-ending"
      );
      await HIRING_BENCH_PAUSE_ENDING_HANDLERS.hiring_bench_pause_ending({
        id: "task-1",
        payload: {},
      } as any);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("getAvailableBenchMembers", () => {
    it("filters by role_brief_id, active status, and capacity", async () => {
      const { db } = await import("@/lib/db");
      const nowMs = Date.now();

      vi.mocked(db.select().from(undefined as any).where(undefined as any).orderBy(undefined as any).all)
        .mockResolvedValueOnce([
          {
            id: "c1",
            role_brief_id: "rb-1",
            bench_status: "active",
            paused_until_ms: null,
            weekly_capacity_hours: 20,
            updated_at_ms: nowMs - 100_000,
          },
          {
            id: "c2",
            role_brief_id: "rb-1",
            bench_status: "active",
            paused_until_ms: nowMs + 86_400_000,
            weekly_capacity_hours: 10,
            updated_at_ms: nowMs - 50_000,
          },
          {
            id: "c3",
            role_brief_id: "rb-1",
            bench_status: "active",
            paused_until_ms: null,
            weekly_capacity_hours: 5,
            updated_at_ms: nowMs,
          },
        ] as any);

      const { getAvailableBenchMembers } = await import(
        "@/lib/hiring/queries"
      );
      const result = await getAvailableBenchMembers("rb-1", 10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("excludes specified IDs", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.select().from(undefined as any).where(undefined as any).orderBy(undefined as any).all)
        .mockResolvedValueOnce([
          {
            id: "c1",
            role_brief_id: "rb-1",
            bench_status: "active",
            paused_until_ms: null,
            weekly_capacity_hours: 20,
          },
        ] as any);

      const { getAvailableBenchMembers } = await import(
        "@/lib/hiring/queries"
      );
      const result = await getAvailableBenchMembers("rb-1", 10, {
        excludeIds: ["c1"],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("openBenchCount", () => {
    it("returns correct active/paused/total counts", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.select().from(undefined as any).where(undefined as any).all)
        .mockResolvedValueOnce([
          { id: "c1", bench_status: "active" },
          { id: "c2", bench_status: "paused" },
          { id: "c3", bench_status: "active" },
        ] as any);

      const { openBenchCount } = await import("@/lib/hiring/queries");
      const result = await openBenchCount("rb-1");

      expect(result).toEqual({ active: 2, paused: 1, total: 3 });
    });
  });

  describe("scheduled task type registration", () => {
    it("includes hiring_bench_pause_ending in task types", async () => {
      const { SCHEDULED_TASK_TYPES } = await import(
        "@/lib/db/schema/scheduled-tasks"
      );
      expect(SCHEDULED_TASK_TYPES).toContain("hiring_bench_pause_ending");
    });
  });

  describe("activity log kind registration", () => {
    it("includes bench_pause_ending_notified in activity log kinds", async () => {
      const { ACTIVITY_LOG_KINDS } = await import(
        "@/lib/db/schema/activity-log"
      );
      expect(ACTIVITY_LOG_KINDS).toContain("bench_pause_ending_notified");
    });
  });

  describe("handler registry", () => {
    it("registers hiring_bench_pause_ending handler", async () => {
      const { HANDLER_REGISTRY } = await import(
        "@/lib/scheduled-tasks/handlers/index"
      );
      expect(HANDLER_REGISTRY).toHaveProperty("hiring_bench_pause_ending");
      expect(typeof HANDLER_REGISTRY.hiring_bench_pause_ending).toBe(
        "function",
      );
    });
  });
});
