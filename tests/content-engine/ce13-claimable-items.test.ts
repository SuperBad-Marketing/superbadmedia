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

// ── Imports (after mocks) ───────────────────────────────────────────

import {
  listClaimableContentItems,
  claimInternalContentItem,
  releaseContentItem,
} from "@/lib/content-engine/claimable-items";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTopic(overrides: Record<string, unknown> = {}) {
  return {
    id: "topic-1",
    keyword: "best coffee roasters melbourne",
    rankability_score: 72,
    outline: { sections: ["Intro", "Top picks"], wordCount: 1200 },
    status: "queued" as const,
    created_at_ms: 1000,
    company_id: "co-sb",
    claimed_by: null,
    claimed_at_ms: null,
    claim_budget_cap_aud: null,
    claim_released_at_ms: null,
    claim_released_reason: null,
    ...overrides,
  };
}

// ── Tests: listClaimableContentItems ────────────────────────────────

describe("listClaimableContentItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no topics exist", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue([]),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await listClaimableContentItems({
      suitableFor: "trial_task",
      companyId: "co-sb",
    });
    expect(result).toEqual([]);
  });

  it("filters out topics without outlines", async () => {
    const topicWithOutline = makeTopic();
    const topicWithoutOutline = makeTopic({
      id: "topic-2",
      outline: null,
    });

    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue([topicWithOutline, topicWithoutOutline]),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await listClaimableContentItems({
      suitableFor: "trial_task",
      companyId: "co-sb",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("topic-1");
  });

  it("maps fields correctly", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue([makeTopic()]),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await listClaimableContentItems({
      suitableFor: "trial_task",
      companyId: "co-sb",
    });
    expect(result[0]).toEqual({
      id: "topic-1",
      keyword: "best coffee roasters melbourne",
      rankabilityScore: 72,
      outline: { sections: ["Intro", "Top picks"], wordCount: 1200 },
      status: "queued",
      createdAtMs: 1000,
    });
  });
});

// ── Tests: claimInternalContentItem ─────────────────────────────────

describe("claimInternalContentItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true on successful claim", async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    };
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await claimInternalContentItem("topic-1", "candidate-1", 50);
    expect(result).toEqual({ ok: true });
    expect(logActivity).toHaveBeenCalledOnce();
  });

  it("returns already_claimed when item is taken", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue({ changes: 0 }),
    };
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    // Follow-up select to check why
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue({
        status: "queued",
        claimed_by: "other-candidate",
      }),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

    const result = await claimInternalContentItem("topic-1", "candidate-1", 50);
    expect(result).toEqual({ ok: false, reason: "already_claimed" });
  });

  it("returns archived when topic is not queued", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue({ changes: 0 }),
    };
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue({ status: "generated", claimed_by: null }),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

    const result = await claimInternalContentItem("topic-1", "candidate-1", 50);
    expect(result).toEqual({ ok: false, reason: "archived" });
  });

  it("returns ineligible when topic doesn't exist", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue({ changes: 0 }),
    };
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue(undefined),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

    const result = await claimInternalContentItem("topic-missing", "candidate-1", 50);
    expect(result).toEqual({ ok: false, reason: "ineligible" });
  });
});

// ── Tests: releaseContentItem ───────────────────────────────────────

describe("releaseContentItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears claim fields and logs activity", async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    };
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await releaseContentItem("topic-1", "candidate withdrew");
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        claimed_by: null,
        claimed_at_ms: null,
        claim_budget_cap_aud: null,
        claim_released_reason: "candidate withdrew",
      }),
    );
    expect(logActivity).toHaveBeenCalledOnce();
  });
});
