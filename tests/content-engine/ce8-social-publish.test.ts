import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => {
  const mockSet = vi.fn(() => ({ where: vi.fn() }));
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(),
          })),
        })),
      })),
      update: vi.fn(() => ({ set: mockSet })),
      __mockSet: mockSet,
    },
  };
});

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { markSocialDraftPublished } from "@/lib/content-engine/social-publish";

// ── Helpers ─────────────────────────────────────────────────────────

function makeDraftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    blog_post_id: "post-1",
    platform: "instagram",
    status: "ready",
    ...overrides,
  };
}

function makePostRow(overrides: Record<string, unknown> = {}) {
  return {
    company_id: "company-1",
    title: "Test Blog Post",
    ...overrides,
  };
}

/**
 * Wire up the chained db.select().from().where().get() to return `val`.
 * Supports multiple sequential calls via mockResolvedValueOnce chaining.
 */
function mockSelectGet(...values: (unknown | undefined)[]) {
  const getMock = vi.fn();
  for (const val of values) {
    getMock.mockResolvedValueOnce(val);
  }
  const whereMock = vi.fn(() => ({ get: getMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  vi.mocked(db.select).mockReturnValue({ from: fromMock } as never);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("markSocialDraftPublished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when draft does not exist", async () => {
    mockSelectGet(undefined);
    const result = await markSocialDraftPublished("nonexistent");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns already_published when draft is already published", async () => {
    mockSelectGet(makeDraftRow({ status: "published" }));
    const result = await markSocialDraftPublished("draft-1");
    expect(result).toEqual({ ok: false, reason: "already_published" });
  });

  it("returns not_ready when draft is still generating", async () => {
    mockSelectGet(makeDraftRow({ status: "generating" }));
    const result = await markSocialDraftPublished("draft-1");
    expect(result).toEqual({ ok: false, reason: "not_ready" });
  });

  it("publishes a ready draft and logs activity", async () => {
    // First select returns draft, second returns post
    const getMock = vi.fn()
      .mockResolvedValueOnce(makeDraftRow())
      .mockResolvedValueOnce(makePostRow());
    const whereMock = vi.fn(() => ({ get: getMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never);

    const mockSet = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

    const result = await markSocialDraftPublished("draft-1");

    expect(result).toEqual({ ok: true });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at_ms: expect.any(Number),
      }),
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        kind: "content_social_published",
        meta: expect.objectContaining({
          draft_id: "draft-1",
          platform: "instagram",
        }),
      }),
    );
  });

  it("publishes without logging if post lookup fails", async () => {
    const getMock = vi.fn()
      .mockResolvedValueOnce(makeDraftRow())
      .mockResolvedValueOnce(undefined);
    const whereMock = vi.fn(() => ({ get: getMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never);

    const mockSet = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

    const result = await markSocialDraftPublished("draft-1");

    expect(result).toEqual({ ok: true });
    expect(mockSet).toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("includes correct platform in activity log for linkedin", async () => {
    const getMock = vi.fn()
      .mockResolvedValueOnce(makeDraftRow({ platform: "linkedin" }))
      .mockResolvedValueOnce(makePostRow());
    const whereMock = vi.fn(() => ({ get: getMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never);

    const mockSet = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

    await markSocialDraftPublished("draft-1");

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ platform: "linkedin" }),
      }),
    );
  });
});
