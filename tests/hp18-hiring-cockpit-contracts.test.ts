import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAll = vi.fn().mockResolvedValue([]);
const mockGet = vi.fn().mockReturnValue(undefined);

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: mockAll,
          get: mockGet,
          orderBy: vi.fn().mockReturnValue({ all: mockAll }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: mockAll,
          }),
        }),
      }),
    }),
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

vi.mock("@/lib/db/schema/external-call-log", () => ({
  external_call_log: {
    job: "job",
    created_at_ms: "created_at_ms",
  },
}));

describe("HP-18 — Hiring cockpit contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockResolvedValue([]);
    mockGet.mockReturnValue(undefined);
  });

  describe("getHiringWaitingItems", () => {
    it("returns empty array when no items match", async () => {
      const { getHiringWaitingItems } = await import(
        "@/lib/hiring/cockpit"
      );
      const items = await getHiringWaitingItems(Date.now());
      expect(items).toEqual([]);
    });

    it("returns items with correct source", async () => {
      const nowMs = Date.now();
      const candidate = {
        id: "c1",
        name: "Jane Doe",
        stage: "applied",
        updated_at_ms: nowMs - 2 * 86_400_000,
        followup_status: null,
      };
      mockAll.mockResolvedValueOnce([candidate]);

      const { getHiringWaitingItems } = await import(
        "@/lib/hiring/cockpit"
      );
      const items = await getHiringWaitingItems(nowMs);

      const appItem = items.find((i) =>
        i.id.startsWith("candidate_application_unreviewed"),
      );
      expect(appItem).toBeDefined();
      expect(appItem!.source).toBe("hiring-pipeline");
      expect(appItem!.label).toContain("Jane Doe");
    });

    it("includes bench_pause_ending_soon items", async () => {
      const nowMs = Date.now();
      const pausingCandidate = {
        id: "c2",
        name: "Bob Smith",
        stage: "bench",
        bench_status: "paused",
        paused_until_ms: nowMs + 1 * 86_400_000,
        updated_at_ms: nowMs - 86_400_000,
      };

      // First few calls return empty, then the pause query returns a match
      mockAll
        .mockResolvedValueOnce([]) // unreviewed applicants
        .mockResolvedValueOnce([]) // followup replied
        .mockResolvedValueOnce([]) // delivered unreviewed (join)
        .mockResolvedValueOnce([]) // overdue trials (join)
        .mockResolvedValueOnce([pausingCandidate]) // pause ending soon
        .mockResolvedValueOnce([]); // stale roles

      mockGet.mockReturnValueOnce({ count: 0 }); // draft invites count

      const { getHiringWaitingItems } = await import(
        "@/lib/hiring/cockpit"
      );
      const items = await getHiringWaitingItems(nowMs);

      const pauseItem = items.find((i) =>
        i.id.startsWith("bench_pause_ending"),
      );
      expect(pauseItem).toBeDefined();
      expect(pauseItem!.label).toContain("Bob Smith");
      expect(pauseItem!.urgency.kind).toBe("time_sensitive");
    });

    it("includes draft_invites_awaiting when count > 0", async () => {
      mockGet.mockReturnValueOnce({ count: 5 });

      const { getHiringWaitingItems } = await import(
        "@/lib/hiring/cockpit"
      );
      const items = await getHiringWaitingItems(Date.now());

      const draftItem = items.find((i) => i.id === "draft_invites_awaiting");
      expect(draftItem).toBeDefined();
      expect(draftItem!.label).toContain("5 invite drafts");
    });

    it("formats trial overdue labels with day count", async () => {
      const nowMs = Date.now();
      const overdueRow = {
        trial_tasks: {
          id: "tt1",
          due_at_ms: nowMs - 3 * 86_400_000,
          disposition: "pending",
          delivered_at_ms: null,
        },
        candidates: {
          id: "c3",
          name: "Alex Trial",
        },
      };

      // Empty for first queries, then overdue returns a match
      mockAll
        .mockResolvedValueOnce([]) // unreviewed
        .mockResolvedValueOnce([]) // followup
        .mockResolvedValueOnce([]) // delivered unreviewed
        .mockResolvedValueOnce([overdueRow]); // overdue trials

      const { getHiringWaitingItems } = await import(
        "@/lib/hiring/cockpit"
      );
      const items = await getHiringWaitingItems(nowMs);

      const overdueItem = items.find((i) =>
        i.id.startsWith("trial_task_overdue"),
      );
      expect(overdueItem).toBeDefined();
      expect(overdueItem!.label).toContain("3d");
      expect(overdueItem!.label).toContain("Alex Trial");
    });
  });

  describe("getHiringHealthBanners", () => {
    it("returns empty array when no banners triggered", async () => {
      mockGet.mockReturnValue({ count: 0 });
      mockAll.mockResolvedValue([]);

      const { getHiringHealthBanners } = await import(
        "@/lib/hiring/cockpit"
      );
      const banners = await getHiringHealthBanners(Date.now());
      expect(banners).toEqual([]);
    });

    it("returns overdue trial banner with correct severity", async () => {
      mockGet
        .mockResolvedValueOnce({ count: 4 }); // overdue trials count

      mockAll.mockResolvedValueOnce([]); // open roles

      const { getHiringHealthBanners } = await import(
        "@/lib/hiring/cockpit"
      );
      const banners = await getHiringHealthBanners(Date.now());

      const overdueBanner = banners.find(
        (b) => b.id === "hiring_trial_task_overdue",
      );
      expect(overdueBanner).toBeDefined();
      expect(overdueBanner!.severity).toBe("critical");
      expect(overdueBanner!.source).toBe("hiring-pipeline");
    });

    it("returns warning severity for 1-2 overdue trials", async () => {
      mockGet.mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([]); // open roles

      const { getHiringHealthBanners } = await import(
        "@/lib/hiring/cockpit"
      );
      const banners = await getHiringHealthBanners(Date.now());

      const overdueBanner = banners.find(
        (b) => b.id === "hiring_trial_task_overdue",
      );
      expect(overdueBanner).toBeDefined();
      expect(overdueBanner!.severity).toBe("warning");
    });

    it("returns bench_empty banner for old open role with no bench", async () => {
      const nowMs = Date.now();
      const oldRole = {
        id: "rb1",
        role_name: "Editor",
        status: "open",
        created_at_ms: nowMs - 30 * 86_400_000,
      };

      mockGet
        .mockResolvedValueOnce({ count: 0 }) // overdue trials
        .mockReturnValueOnce({ count: 0 }); // bench count for role

      mockAll.mockResolvedValueOnce([oldRole]); // open roles

      const { getHiringHealthBanners } = await import(
        "@/lib/hiring/cockpit"
      );
      const banners = await getHiringHealthBanners(nowMs);

      const emptyBanner = banners.find((b) =>
        b.id.startsWith("hiring_bench_empty"),
      );
      expect(emptyBanner).toBeDefined();
      expect(emptyBanner!.summary).toContain("Editor");
      expect(emptyBanner!.severity).toBe("warning");
    });

    it("returns discovery cost anomaly when threshold exceeded", async () => {
      const settings = (await import("@/lib/settings")).default;
      (settings.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(2) // grace days
        .mockResolvedValueOnce(10); // weekly cost threshold

      mockGet
        .mockResolvedValueOnce({ count: 0 }) // overdue trials
        .mockReturnValueOnce({ total: 15.5 }); // weekly spend

      mockAll.mockResolvedValueOnce([]); // open roles

      const { getHiringHealthBanners } = await import(
        "@/lib/hiring/cockpit"
      );
      const banners = await getHiringHealthBanners(Date.now());

      const costBanner = banners.find(
        (b) => b.id === "hiring_discovery_cost_anomaly",
      );
      expect(costBanner).toBeDefined();
      expect(costBanner!.severity).toBe("critical");
      expect(costBanner!.summary).toContain("$15.50");
    });
  });
});
