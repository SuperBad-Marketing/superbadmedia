import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_outreach_enabled: true,
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import {
  matchContentToProspects,
  RELEVANCE_THRESHOLD,
} from "@/lib/content-engine/outreach-match";
import { killSwitches } from "@/lib/kill-switches";
import { db } from "@/lib/db";

// ── Helpers ─────────────────────────────────────────────────────────

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    company_id: "co-sb",
    topic_id: "topic-1",
    title: "Test Post",
    slug: "test-post",
    body: "body",
    meta_description: null,
    og_image_url: null,
    structured_data: null,
    internal_links: null,
    snippet_target_section: null,
    status: "published" as const,
    published_at_ms: 1000,
    published_url: "https://example.com/blog/test-post",
    created_at_ms: 1000,
    updated_at_ms: 1000,
    ...overrides,
  };
}

function mockDbSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnValue(rows[0] ?? undefined),
    limit: vi.fn().mockReturnValue(rows),
    orderBy: vi.fn().mockReturnThis(),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("matchContentToProspects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_outreach_enabled = true;
  });

  it("returns kill_switch when content_outreach_enabled is false", async () => {
    (killSwitches as Record<string, boolean>).content_outreach_enabled = false;
    const result = await matchContentToProspects("post-1", "co-sb");
    expect(result).toEqual({ ok: false, reason: "kill_switch" });
  });

  it("returns lead_gen_not_available (Wave 13 not yet built)", async () => {
    // First select: isSuperBadCompany check
    // Second select: blog post lookup
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
    };
    let callCount = 0;
    chain.get.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { id: "co-sb" }; // company exists
      if (callCount === 2) return makePost(); // post found
      return undefined;
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await matchContentToProspects("post-1", "co-sb");
    expect(result).toEqual({ ok: false, reason: "lead_gen_not_available" });
  });

  it("returns post_not_found when post doesn't exist", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
    };
    let callCount = 0;
    chain.get.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { id: "co-sb" };
      return undefined; // post not found
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await matchContentToProspects("post-missing", "co-sb");
    expect(result).toEqual({ ok: false, reason: "post_not_found" });
  });

  it("returns post_not_published when post is in draft status", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
    };
    let callCount = 0;
    chain.get.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { id: "co-sb" };
      return makePost({ status: "draft" });
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await matchContentToProspects("post-1", "co-sb");
    expect(result).toEqual({ ok: false, reason: "post_not_published" });
  });

  it("exports RELEVANCE_THRESHOLD constant", () => {
    expect(RELEVANCE_THRESHOLD).toBe(60);
  });
});
