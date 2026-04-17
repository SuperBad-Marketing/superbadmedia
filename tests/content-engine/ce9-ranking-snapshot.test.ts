import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
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

vi.mock("@/lib/integrations/getCredential", () => ({
  getCredential: vi.fn(),
}));

vi.mock("@/lib/content-engine/research", () => ({
  fetchSerpResults: vi.fn(),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { getCredential } from "@/lib/integrations/getCredential";
import { fetchSerpResults } from "@/lib/content-engine/research";
import { db } from "@/lib/db";
import {
  handleContentRankingSnapshot,
  ensureRankingSnapshotEnqueued,
  ContentRankingSnapshotPayloadSchema,
} from "@/lib/scheduled-tasks/handlers/content-ranking-snapshot";
import {
  takeRankingSnapshots,
  getPostRankingTrend,
} from "@/lib/content-engine/ranking-snapshot";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import type { SerpSnapshot } from "@/lib/content-engine/research";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTask(payload: Record<string, unknown>): ScheduledTaskRow {
  return {
    id: "task-1",
    task_type: "content_ranking_snapshot",
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

function makeSerpSnapshot(
  keyword: string,
  results: Array<{ position: number; domain: string }>,
): SerpSnapshot {
  return {
    keyword,
    results: results.map((r) => ({
      position: r.position,
      title: `Result at ${r.position}`,
      link: `https://${r.domain}/page`,
      domain: r.domain,
      snippet: "",
    })),
    searchedAt: Date.now(),
  };
}

function mockPublishedPosts(
  posts: Array<{ postId: string; publishedUrl: string | null; keyword: string }>,
) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(posts),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>);
}

function mockInsert() {
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValue({
    values: valuesFn,
  } as unknown as ReturnType<typeof db.insert>);
  return valuesFn;
}

// ── Handler tests ──────────────────────────────────────────────────

describe("content_ranking_snapshot handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_automations_enabled = true;
    vi.mocked(getCredential).mockResolvedValue("serpapi-key-123");
    mockPublishedPosts([]);
    mockInsert();
  });

  it("exits silently when kill switch is off", async () => {
    (killSwitches as Record<string, boolean>).content_automations_enabled =
      false;
    await handleContentRankingSnapshot(makeTask({ company_id: "co-1" }));
    expect(getCredential).not.toHaveBeenCalled();
    expect(enqueueTask).not.toHaveBeenCalled();
  });

  it("throws on invalid payload", async () => {
    await expect(
      handleContentRankingSnapshot(makeTask({})),
    ).rejects.toThrow("invalid payload");
  });

  it("self-re-enqueues after successful run", async () => {
    await handleContentRankingSnapshot(makeTask({ company_id: "co-1" }));

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_ranking_snapshot",
        payload: { company_id: "co-1" },
      }),
    );
  });

  it("re-enqueue delay is approximately 7 days", async () => {
    const before = Date.now();
    await handleContentRankingSnapshot(makeTask({ company_id: "co-1" }));
    const after = Date.now();

    const call = vi.mocked(enqueueTask).mock.calls[0][0];
    const runAt = call.runAt as number;
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    // runAt should be ~7 days from now (within a few seconds tolerance)
    expect(runAt).toBeGreaterThanOrEqual(before + weekMs - 5000);
    expect(runAt).toBeLessThanOrEqual(after + weekMs + 5000);
  });
});

// ── Payload schema tests ───────────────────────────────────────────

describe("ContentRankingSnapshotPayloadSchema", () => {
  it("accepts valid payload", () => {
    const result = ContentRankingSnapshotPayloadSchema.safeParse({
      company_id: "co-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty company_id", () => {
    const result = ContentRankingSnapshotPayloadSchema.safeParse({
      company_id: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing company_id", () => {
    const result = ContentRankingSnapshotPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── Library tests (takeRankingSnapshots) ───────────────────────────

describe("takeRankingSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCredential).mockResolvedValue("serpapi-key-123");
    mockInsert();
  });

  it("throws when SerpAPI credential is missing", async () => {
    vi.mocked(getCredential).mockResolvedValue(null);
    await expect(takeRankingSnapshots("co-1")).rejects.toThrow(
      "SerpAPI credential not found",
    );
  });

  it("returns zero counts when no published posts exist", async () => {
    mockPublishedPosts([]);
    const result = await takeRankingSnapshots("co-1");
    expect(result).toEqual({
      ok: true,
      postsChecked: 0,
      postsRanked: 0,
      postsNotFound: 0,
      errors: 0,
    });
    expect(fetchSerpResults).not.toHaveBeenCalled();
  });

  it("records position when post domain is found in SERP results", async () => {
    mockPublishedPosts([
      {
        postId: "post-1",
        publishedUrl: "https://example.com/blog/test-post",
        keyword: "test keyword",
      },
    ]);
    vi.mocked(fetchSerpResults).mockResolvedValue(
      makeSerpSnapshot("test keyword", [
        { position: 1, domain: "other.com" },
        { position: 2, domain: "another.com" },
        { position: 3, domain: "example.com" },
      ]),
    );

    const valuesFn = mockInsert();
    const result = await takeRankingSnapshots("co-1");

    expect(result.postsRanked).toBe(1);
    expect(result.postsNotFound).toBe(0);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        blog_post_id: "post-1",
        keyword: "test keyword",
        position: 3,
        source: "serpapi",
      }),
    );
  });

  it("records null position when post domain is not in SERP results", async () => {
    mockPublishedPosts([
      {
        postId: "post-1",
        publishedUrl: "https://example.com/blog/test-post",
        keyword: "test keyword",
      },
    ]);
    vi.mocked(fetchSerpResults).mockResolvedValue(
      makeSerpSnapshot("test keyword", [
        { position: 1, domain: "other.com" },
        { position: 2, domain: "another.com" },
      ]),
    );

    const valuesFn = mockInsert();
    const result = await takeRankingSnapshots("co-1");

    expect(result.postsNotFound).toBe(1);
    expect(result.postsRanked).toBe(0);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        position: null,
      }),
    );
  });

  it("records null position when publishedUrl is null", async () => {
    mockPublishedPosts([
      {
        postId: "post-1",
        publishedUrl: null,
        keyword: "test keyword",
      },
    ]);
    vi.mocked(fetchSerpResults).mockResolvedValue(
      makeSerpSnapshot("test keyword", [
        { position: 1, domain: "other.com" },
      ]),
    );

    const valuesFn = mockInsert();
    const result = await takeRankingSnapshots("co-1");

    expect(result.postsNotFound).toBe(1);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        position: null,
      }),
    );
  });

  it("continues processing remaining posts when one fails", async () => {
    mockPublishedPosts([
      { postId: "post-1", publishedUrl: "https://a.com/blog/p1", keyword: "kw1" },
      { postId: "post-2", publishedUrl: "https://b.com/blog/p2", keyword: "kw2" },
    ]);

    vi.mocked(fetchSerpResults)
      .mockRejectedValueOnce(new Error("SerpAPI rate limit"))
      .mockResolvedValueOnce(
        makeSerpSnapshot("kw2", [{ position: 5, domain: "b.com" }]),
      );

    const result = await takeRankingSnapshots("co-1");

    expect(result.errors).toBe(1);
    expect(result.postsRanked).toBe(1);
    expect(result.postsChecked).toBe(2);
  });

  it("logs activity after snapshot run", async () => {
    mockPublishedPosts([
      {
        postId: "post-1",
        publishedUrl: "https://example.com/blog/test",
        keyword: "test keyword",
      },
    ]);
    vi.mocked(fetchSerpResults).mockResolvedValue(
      makeSerpSnapshot("test keyword", [
        { position: 7, domain: "example.com" },
      ]),
    );

    await takeRankingSnapshots("co-1");

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "co-1",
        kind: "content_ranking_snapshot_taken",
        meta: expect.objectContaining({
          posts_checked: 1,
          posts_ranked: 1,
        }),
      }),
    );
  });
});

// ── Trend query tests ──────────────────────────────────────────────

describe("getPostRankingTrend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no snapshots exist", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as typeof db;

    const result = await getPostRankingTrend("post-1", { db: mockDb });
    expect(result).toBeNull();
  });

  it("returns 'new' direction for single snapshot", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { position: 5, keyword: "seo tips", snapshot_date_ms: 1000 },
            ]),
          }),
        }),
      }),
    } as unknown as typeof db;

    const result = await getPostRankingTrend("post-1", { db: mockDb });
    expect(result).toEqual(
      expect.objectContaining({
        direction: "new",
        currentPosition: 5,
        entryPosition: 5,
        peakPosition: 5,
        snapshotCount: 1,
      }),
    );
  });

  it("returns 'up' direction when position improved", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              // Most recent first (desc order)
              { position: 3, keyword: "seo tips", snapshot_date_ms: 3000 },
              { position: 5, keyword: "seo tips", snapshot_date_ms: 2000 },
              { position: 8, keyword: "seo tips", snapshot_date_ms: 1000 },
            ]),
          }),
        }),
      }),
    } as unknown as typeof db;

    const result = await getPostRankingTrend("post-1", { db: mockDb });
    expect(result).toEqual(
      expect.objectContaining({
        direction: "up",
        currentPosition: 3,
        entryPosition: 8,
        peakPosition: 3,
      }),
    );
  });

  it("returns 'down' direction when position worsened", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { position: 10, keyword: "seo tips", snapshot_date_ms: 2000 },
              { position: 5, keyword: "seo tips", snapshot_date_ms: 1000 },
            ]),
          }),
        }),
      }),
    } as unknown as typeof db;

    const result = await getPostRankingTrend("post-1", { db: mockDb });
    expect(result).toEqual(
      expect.objectContaining({
        direction: "down",
        currentPosition: 10,
        peakPosition: 5,
      }),
    );
  });

  it("returns 'lost' when current position is null but previously ranked", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { position: null, keyword: "seo tips", snapshot_date_ms: 2000 },
              { position: 5, keyword: "seo tips", snapshot_date_ms: 1000 },
            ]),
          }),
        }),
      }),
    } as unknown as typeof db;

    const result = await getPostRankingTrend("post-1", { db: mockDb });
    expect(result).toEqual(
      expect.objectContaining({
        direction: "lost",
        currentPosition: null,
        peakPosition: 5,
      }),
    );
  });

  it("returns 'stable' when position unchanged", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { position: 5, keyword: "seo tips", snapshot_date_ms: 2000 },
              { position: 5, keyword: "seo tips", snapshot_date_ms: 1000 },
            ]),
          }),
        }),
      }),
    } as unknown as typeof db;

    const result = await getPostRankingTrend("post-1", { db: mockDb });
    expect(result).toEqual(
      expect.objectContaining({
        direction: "stable",
        currentPosition: 5,
        peakPosition: 5,
      }),
    );
  });
});

// ── Bootstrap tests ────────────────────────────────────────────────

describe("ensureRankingSnapshotEnqueued", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues with correct task type and weekly delay", async () => {
    const nowMs = 1000000;
    await ensureRankingSnapshotEnqueued("co-1", nowMs);

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    expect(enqueueTask).toHaveBeenCalledWith({
      task_type: "content_ranking_snapshot",
      runAt: nowMs + weekMs,
      payload: { company_id: "co-1" },
      idempotencyKey: "content_ranking_snapshot:co-1:bootstrap",
    });
  });

  it("uses Date.now() when nowMs not provided", async () => {
    const before = Date.now();
    await ensureRankingSnapshotEnqueued("co-1");

    const call = vi.mocked(enqueueTask).mock.calls[0][0];
    const runAt = call.runAt as number;
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    expect(runAt).toBeGreaterThanOrEqual(before + weekMs - 1000);
  });
});
