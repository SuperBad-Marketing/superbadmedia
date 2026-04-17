import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import {
  getFleetSummary,
  getFleetList,
} from "@/lib/content-engine/fleet-overview";
import { db } from "@/lib/db";

// ── Test helpers ────────────────────────────────────────────────────

let selectCallCount = 0;

function mockDbSelectSequence(responses: unknown[][]) {
  selectCallCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const idx = selectCallCount++;
    const rows = responses[idx] ?? [];
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(rows),
          }),
          orderBy: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(rows),
          }),
          all: vi.fn().mockResolvedValue(rows),
          get: vi.fn().mockResolvedValue(rows[0] ?? { cnt: 0 }),
        }),
        all: vi.fn().mockResolvedValue(rows),
        get: vi.fn().mockResolvedValue(rows[0] ?? { cnt: 0 }),
      }),
    };
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("getFleetSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeros when no configs exist", async () => {
    // configs, publishedThisMonth, activeListSize, unreviewedCompanies
    mockDbSelectSequence([[], [{ cnt: 0 }], [{ cnt: 0 }], []]);

    const summary = await getFleetSummary({ db: db as never });
    expect(summary.totalSubscribers).toBe(0);
    expect(summary.postsPublishedThisMonth).toBe(0);
    expect(summary.aggregateListSize).toBe(0);
    expect(summary.subscribersWithUnreviewedDrafts).toBe(0);
  });

  it("counts subscriber companies from configs", async () => {
    mockDbSelectSequence([
      [{ company_id: "co-1" }, { company_id: "co-2" }],
      [{ cnt: 3 }],
      [{ cnt: 150 }],
      [{ company_id: "co-1" }],
    ]);

    const summary = await getFleetSummary({ db: db as never });
    expect(summary.totalSubscribers).toBe(2);
    expect(summary.subscribersWithUnreviewedDrafts).toBe(1);
  });
});

describe("getFleetList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no configs", async () => {
    mockDbSelectSequence([[]]);

    const list = await getFleetList({ db: db as never });
    expect(list).toEqual([]);
  });
});
