import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AutonomyMode } from "@/lib/db/schema/autonomy-state";

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "mock" }),
}));

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    track: "saas" as const,
    mode: "manual" as AutonomyMode,
    clean_approval_streak: 0,
    graduation_threshold: 10,
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

let capturedSets: Record<string, unknown>[] = [];
let currentRow = makeRow();
let mockMaintenanceResult = true;

function buildMockDb() {
  capturedSets = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chainable: any = {};
  chainable.where = vi.fn().mockReturnValue(chainable);
  chainable.limit = vi.fn().mockImplementation(() => Promise.resolve([currentRow]));
  chainable.set = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
    capturedSets.push(vals);
    Object.assign(currentRow, vals);
    return chainable;
  });
  chainable.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  chainable.values = vi.fn().mockReturnValue({
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  });
  chainable.from = vi.fn().mockReturnValue(chainable);
  chainable.orderBy = vi.fn().mockImplementation(() => Promise.resolve([currentRow]));
  chainable.innerJoin = vi.fn().mockReturnValue(chainable);

  return {
    select: vi.fn().mockReturnValue(chainable),
    update: vi.fn().mockReturnValue(chainable),
    insert: vi.fn().mockReturnValue(chainable),
  };
}

vi.mock("@/lib/db", () => ({
  db: buildMockDb(),
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
  leadCandidates: {
    id: "id",
    qualified_track: "qualified_track",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  sql: Object.assign(vi.fn(), {
    join: vi.fn(),
  }),
}));

describe("Autonomy state machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRow = makeRow();
    capturedSets = [];
    mockMaintenanceResult = true;
  });

  describe("clean_approval in manual mode", () => {
    it("increments streak without transitioning below threshold", async () => {
      currentRow = makeRow({ clean_approval_streak: 5 });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "clean_approval",
      });

      expect(result.previousMode).toBe("manual");
      expect(result.newMode).toBe("manual");
      expect(result.streak).toBe(6);
      expect(result.transitioned).toBe(false);
    });

    it("transitions to probation at graduation threshold", async () => {
      currentRow = makeRow({ clean_approval_streak: 9 });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "clean_approval",
      });

      expect(result.previousMode).toBe("manual");
      expect(result.newMode).toBe("probation");
      expect(result.streak).toBe(10);
      expect(result.transitioned).toBe(true);
    });
  });

  describe("non_clean_approval", () => {
    it("resets streak to zero in manual mode", async () => {
      currentRow = makeRow({ clean_approval_streak: 7 });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "non_clean_approval",
      });

      expect(result.newMode).toBe("manual");
      expect(result.streak).toBe(0);
      expect(result.transitioned).toBe(false);
    });

    it("demotes from probation to manual", async () => {
      currentRow = makeRow({
        mode: "probation",
        clean_approval_streak: 10,
        probation_sends_remaining: 3,
      });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "non_clean_approval",
      });

      expect(result.previousMode).toBe("probation");
      expect(result.newMode).toBe("manual");
      expect(result.streak).toBe(0);
      expect(result.transitioned).toBe(true);
    });

    it("demotes from auto_send to manual", async () => {
      currentRow = makeRow({ mode: "auto_send", clean_approval_streak: 15 });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "non_clean_approval",
      });

      expect(result.previousMode).toBe("auto_send");
      expect(result.newMode).toBe("manual");
      expect(result.transitioned).toBe(true);
    });
  });

  describe("rejection", () => {
    it("resets streak in manual mode without transition", async () => {
      currentRow = makeRow({ clean_approval_streak: 5 });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "rejection",
      });

      expect(result.newMode).toBe("manual");
      expect(result.streak).toBe(0);
      expect(result.transitioned).toBe(false);
    });

    it("demotes from auto_send to manual", async () => {
      currentRow = makeRow({ mode: "auto_send" });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "rejection",
      });

      expect(result.previousMode).toBe("auto_send");
      expect(result.newMode).toBe("manual");
      expect(result.transitioned).toBe(true);
    });
  });

  describe("circuit breakers", () => {
    it("demotes to manual on hard bounce", async () => {
      currentRow = makeRow({ mode: "auto_send" });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "hard_bounce",
        sendId: "send-1",
      });

      expect(result.newMode).toBe("manual");
      expect(result.transitioned).toBe(true);
      expect(result.reason).toContain("Hard bounce");
    });

    it("demotes to manual on spam complaint", async () => {
      currentRow = makeRow({ mode: "probation" });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "spam_complaint",
        sendId: "send-2",
      });

      expect(result.newMode).toBe("manual");
      expect(result.transitioned).toBe(true);
    });

    it("demotes on fast unsubscribe", async () => {
      currentRow = makeRow({ mode: "auto_send" });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "fast_unsubscribe",
        sendId: "send-3",
      });

      expect(result.newMode).toBe("manual");
      expect(result.reason).toContain("60 seconds");
    });

    it("demotes on drift flag during auto_send", async () => {
      currentRow = makeRow({ mode: "auto_send" });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "drift_flag_on_auto_send",
        draftId: "draft-1",
      });

      expect(result.newMode).toBe("manual");
      expect(result.transitioned).toBe(true);
    });
  });

  describe("probation_send_completed", () => {
    it("decrements remaining in probation", async () => {
      currentRow = makeRow({
        mode: "probation",
        probation_sends_remaining: 3,
      });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "probation_send_completed",
      });

      expect(result.newMode).toBe("probation");
      expect(result.transitioned).toBe(false);
    });

    it("graduates to auto_send when probation ends", async () => {
      currentRow = makeRow({
        mode: "probation",
        probation_sends_remaining: 1,
      });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "probation_send_completed",
      });

      expect(result.previousMode).toBe("probation");
      expect(result.newMode).toBe("auto_send");
      expect(result.transitioned).toBe(true);
    });

    it("no-ops if not in probation mode", async () => {
      currentRow = makeRow({ mode: "manual" });
      const { transitionAutonomyState } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const result = await transitionAutonomyState("saas", {
        type: "probation_send_completed",
      });

      expect(result.transitioned).toBe(false);
      expect(result.newMode).toBe("manual");
    });
  });

  describe("activity log kinds", () => {
    it("includes autonomy_circuit_broken and autonomy_probation_started", async () => {
      const { ACTIVITY_LOG_KINDS } = await import(
        "@/lib/db/schema/activity-log"
      );
      expect(ACTIVITY_LOG_KINDS).toContain("autonomy_circuit_broken");
      expect(ACTIVITY_LOG_KINDS).toContain("autonomy_probation_started");
      expect(ACTIVITY_LOG_KINDS).toContain("autonomy_graduated");
      expect(ACTIVITY_LOG_KINDS).toContain("autonomy_demoted");
    });
  });

  describe("AUTO_SEND_DELAY_MS", () => {
    it("is 15 minutes in milliseconds", async () => {
      const { AUTO_SEND_DELAY_MS } = await import(
        "@/lib/lead-gen/autonomy"
      );
      expect(AUTO_SEND_DELAY_MS).toBe(15 * 60 * 1000);
    });
  });

  describe("getAutonomyStates", () => {
    it("maps rows to AutonomyStateView shape", async () => {
      currentRow = makeRow({
        track: "saas",
        mode: "probation",
        clean_approval_streak: 10,
        probation_sends_remaining: 3,
      });
      const { getAutonomyStates } = await import(
        "@/lib/lead-gen/autonomy"
      );
      const states = await getAutonomyStates();
      expect(states.length).toBeGreaterThanOrEqual(1);
      const saas = states[0];
      expect(saas.track).toBe("saas");
      expect(saas.mode).toBe("probation");
      expect(saas.streak).toBe(10);
      expect(saas.probationRemaining).toBe(3);
    });
  });
});
