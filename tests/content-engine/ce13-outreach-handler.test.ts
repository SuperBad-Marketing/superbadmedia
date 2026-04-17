import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_outreach_enabled: true,
  },
}));

vi.mock("@/lib/content-engine/outreach-match", () => ({
  matchContentToProspects: vi.fn().mockResolvedValue({
    ok: false,
    reason: "lead_gen_not_available",
  }),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { handleContentOutreachMatch } from "@/lib/scheduled-tasks/handlers/content-outreach-match";
import { killSwitches } from "@/lib/kill-switches";
import { matchContentToProspects } from "@/lib/content-engine/outreach-match";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTask(payload: Record<string, unknown>) {
  return {
    id: "task-1",
    task_type: "content_outreach_match" as const,
    run_at_ms: 1000,
    payload,
    status: "pending" as const,
    attempts: 0,
    idempotency_key: null,
    created_at_ms: 1000,
    last_attempted_at_ms: null,
    last_error: null,
    done_at_ms: null,
    reclaimed_at_ms: null,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("handleContentOutreachMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_outreach_enabled = true;
  });

  it("returns early when kill switch is off", async () => {
    (killSwitches as Record<string, boolean>).content_outreach_enabled = false;
    await handleContentOutreachMatch(makeTask({ post_id: "p1", company_id: "c1" }));
    expect(matchContentToProspects).not.toHaveBeenCalled();
  });

  it("throws on invalid payload", async () => {
    await expect(
      handleContentOutreachMatch(makeTask({ bad: "data" })),
    ).rejects.toThrow("content_outreach_match: invalid payload");
  });

  it("delegates to matchContentToProspects with correct args", async () => {
    await handleContentOutreachMatch(
      makeTask({ post_id: "post-1", company_id: "co-sb" }),
    );
    expect(matchContentToProspects).toHaveBeenCalledWith("post-1", "co-sb");
  });
});
