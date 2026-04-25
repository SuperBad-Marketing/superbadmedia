import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockReturnValue(undefined),
    query: {
      role_briefs: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(2),
  },
}));

describe("HP-19 — getHiringBriefingSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty signals when no data exists", async () => {
    const { getHiringBriefingSignals } = await import(
      "@/lib/hiring/cockpit"
    );

    const result = await getHiringBriefingSignals();

    expect(result.newly_applied_yesterday).toEqual([]);
    expect(result.trials_delivered_overnight).toEqual([]);
    expect(result.bench_capacity_hours).toBe(0);
    expect(result.discovery_last_run).toBeNull();
  });

  it("picks up recent applicants within 24h window", async () => {
    const { db } = await import("@/lib/db");
    const nowMs = Date.now();

    let callCount = 0;
    vi.mocked(db.all).mockImplementation((_q) => {
      callCount++;
      if (callCount === 1) {
        return [
          { name: "Alice", role_brief_id: "rb-1" },
        ];
      }
      if (callCount === 2) {
        return [{ id: "rb-1", role_name: "Video Editor" }];
      }
      return [];
    });
    vi.mocked(db.get).mockResolvedValue({ total: 0 });

    const { getHiringBriefingSignals } = await import(
      "@/lib/hiring/cockpit"
    );
    const result = await getHiringBriefingSignals(nowMs);

    expect(result.newly_applied_yesterday).toEqual([
      { name: "Alice", role: "Video Editor" },
    ]);
  });

  it("returns bench capacity from active bench members", async () => {
    const { db } = await import("@/lib/db");
    const nowMs = Date.now();

    vi.mocked(db.all).mockResolvedValue([]);
    vi.mocked(db.get).mockImplementation(async () => {
      return { total: 40 };
    });

    const { getHiringBriefingSignals } = await import(
      "@/lib/hiring/cockpit"
    );
    const result = await getHiringBriefingSignals(nowMs);

    expect(result.bench_capacity_hours).toBe(40);
  });

  it("returns discovery_last_run when a role has been discovered", async () => {
    const { db } = await import("@/lib/db");
    const nowMs = Date.now();
    const runAt = nowMs - 86_400_000;

    let getAllCount = 0;
    vi.mocked(db.all).mockImplementation((_q) => {
      getAllCount++;
      return [];
    });

    let getCount = 0;
    vi.mocked(db.get).mockImplementation(async () => {
      getCount++;
      if (getCount === 1) {
        return { total: 0 };
      }
      if (getCount === 2) {
        return { role_name: "Colourist", last_discovery_run_at_ms: runAt };
      }
      if (getCount === 3) {
        return { count: 5 };
      }
      return undefined;
    });

    const { getHiringBriefingSignals } = await import(
      "@/lib/hiring/cockpit"
    );
    const result = await getHiringBriefingSignals(nowMs);

    expect(result.discovery_last_run).toEqual({
      role: "Colourist",
      candidates_found: 5,
      run_at_ms: runAt,
    });
  });

  it("exports the HiringBriefingSignals type", async () => {
    const mod = await import("@/lib/hiring/cockpit");
    expect(mod.getHiringBriefingSignals).toBeDefined();
  });
});
