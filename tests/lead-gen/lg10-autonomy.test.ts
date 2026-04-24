/**
 * LG-10 acceptance criteria:
 * - manual → probation at graduation threshold
 * - streak reset on non-clean approval
 * - probation → auto_send on probation complete
 * - maintenance demote from auto_send when floor breached
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AutonomyMode } from "@/lib/db/schema/autonomy-state";

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "mock" }),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "lead_generation.auto_send_delay_minutes") return 15;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
}));

vi.mock("@/lib/db/schema/autonomy-state", () => ({
  AUTONOMY_MODES: ["manual", "probation", "auto_send", "circuit_broken"],
  autonomyState: {
    track: "track",
    mode: "mode",
    clean_approval_streak: "clean_approval_streak",
    graduation_threshold: "graduation_threshold",
    probation_sends_remaining: "probation_sends_remaining",
    probation_threshold: "probation_threshold",
    rolling_window_size: "rolling_window_size",
    maintenance_floor_pct: "maintenance_floor_pct",
    circuit_broken_at: "circuit_broken_at",
    circuit_broken_reason: "circuit_broken_reason",
    last_graduated_at: "last_graduated_at",
    last_demoted_at: "last_demoted_at",
    $inferSelect: {},
    $inferInsert: {},
  },
}));

vi.mock("@/lib/db/schema/outreach-sends", () => ({
  outreachSends: { draft_id: "draft_id", sent_at: "sent_at", id: "id" },
}));

vi.mock("@/lib/db/schema/outreach-drafts", () => ({
  outreachDrafts: {
    id: "id",
    candidate_id: "candidate_id",
    approval_kind: "approval_kind",
  },
}));

vi.mock("@/lib/db/schema/lead-candidates", () => ({
  leadCandidates: { id: "id", qualified_track: "qualified_track" },
}));

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    track: "saas" as const,
    mode: "manual" as AutonomyMode,
    clean_approval_streak: 0,
    graduation_threshold: 5,
    probation_sends_remaining: null as number | null,
    probation_threshold: 5,
    rolling_window_size: 20,
    maintenance_floor_pct: 80,
    circuit_broken_at: null as Date | null,
    circuit_broken_reason: null as string | null,
    last_graduated_at: null as Date | null,
    last_demoted_at: null as Date | null,
    ...overrides,
  };
}

let currentRow = makeRow();
// When true, .limit(n>1) returns n fake send rows (simulates full maintenance window)
let fullWindowMode = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chainable: any = {};
chainable.where = vi.fn().mockReturnValue(chainable);
chainable.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
chainable.values = vi.fn().mockReturnValue({
  onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
});
chainable.from = vi.fn().mockReturnValue(chainable);
chainable.innerJoin = vi.fn().mockReturnValue(chainable);
chainable.orderBy = vi.fn().mockReturnValue(chainable);
chainable.set = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
  Object.assign(currentRow, vals);
  return chainable;
});
chainable.limit = vi.fn().mockImplementation((n: number) => {
  if (n === 1) return Promise.resolve([currentRow]);
  if (fullWindowMode) return Promise.resolve(Array(n).fill({ draftId: "draft-1" }));
  return Promise.resolve([currentRow]);
});

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue(chainable),
    update: vi.fn().mockReturnValue(chainable),
    insert: vi.fn().mockReturnValue(chainable),
  },
}));

describe("LG-10 autonomy acceptance criteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRow = makeRow();
    fullWindowMode = false;
    // Re-attach set after clearAllMocks resets mock implementations
    chainable.where.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.innerJoin.mockReturnValue(chainable);
    chainable.orderBy.mockReturnValue(chainable);
    chainable.onConflictDoNothing.mockResolvedValue(undefined);
    chainable.set.mockImplementation((vals: Record<string, unknown>) => {
      Object.assign(currentRow, vals);
      return chainable;
    });
    chainable.limit.mockImplementation((n: number) => {
      if (n === 1) return Promise.resolve([currentRow]);
      if (fullWindowMode) return Promise.resolve(Array(n).fill({ draftId: "draft-1" }));
      return Promise.resolve([currentRow]);
    });
  });

  it("AC5a — manual graduates to probation at graduation_threshold", async () => {
    currentRow = makeRow({ clean_approval_streak: 4, graduation_threshold: 5 });
    const { transitionAutonomyState } = await import("@/lib/lead-gen/autonomy");

    const result = await transitionAutonomyState("saas", { type: "clean_approval" });

    expect(result.previousMode).toBe("manual");
    expect(result.newMode).toBe("probation");
    expect(result.streak).toBe(5);
    expect(result.transitioned).toBe(true);
  });

  it("AC5b — non_clean_approval resets streak to zero in manual mode", async () => {
    currentRow = makeRow({ clean_approval_streak: 3 });
    const { transitionAutonomyState } = await import("@/lib/lead-gen/autonomy");

    const result = await transitionAutonomyState("saas", { type: "non_clean_approval" });

    expect(result.newMode).toBe("manual");
    expect(result.streak).toBe(0);
    expect(result.transitioned).toBe(false);
  });

  it("AC5c — probation graduates to auto_send when probation_sends_remaining hits 0", async () => {
    currentRow = makeRow({ mode: "probation", probation_sends_remaining: 1 });
    const { transitionAutonomyState } = await import("@/lib/lead-gen/autonomy");

    const result = await transitionAutonomyState("saas", { type: "probation_send_completed" });

    expect(result.previousMode).toBe("probation");
    expect(result.newMode).toBe("auto_send");
    expect(result.transitioned).toBe(true);
  });

  it("AC5d — auto_send demotes to manual when maintenance floor is breached", async () => {
    currentRow = makeRow({
      mode: "auto_send",
      rolling_window_size: 20,
      maintenance_floor_pct: 80,
    });
    // Return 20 sends for the window query → maintenance check runs
    // Clean count falls through to chainable (not an array) → count=0 → 0% < 80% → demote
    fullWindowMode = true;
    const { transitionAutonomyState } = await import("@/lib/lead-gen/autonomy");

    const result = await transitionAutonomyState("saas", { type: "auto_send_completed" });

    expect(result.previousMode).toBe("auto_send");
    expect(result.newMode).toBe("manual");
    expect(result.transitioned).toBe(true);
    expect(result.reason).toMatch(/maintenance/i);
  });
});
