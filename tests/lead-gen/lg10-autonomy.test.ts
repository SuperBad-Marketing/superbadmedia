/**
 * LG-10: transitionAutonomyState() — earned-autonomy state machine.
 *
 * Tests:
 * 1. manual → probation when streak hits graduation_threshold
 * 2. streak reset on non_clean_approve
 * 3. streak increments (but doesn't graduate) below threshold
 * 4. probation → auto_send when probation_sends_remaining hits 0
 * 5. probation → manual on reject (demoted)
 * 6. maintenance_demote from auto_send → manual
 * 7. reject from auto_send → circuit_broken
 * 8. kill-switch gate throws when lead_gen_enabled is false
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AutonomyStateRow } from "@/lib/db/schema/autonomy-state";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { lead_gen_enabled: true },
}));

vi.mock("@/lib/db/schema/autonomy-state", () => ({
  autonomyState: { track: "track" },
  AUTONOMY_MODES: ["manual", "probation", "auto_send", "circuit_broken"],
}));

vi.mock("@/lib/db/schema/activity-log", () => ({
  activity_log: {},
}));

// ── Test db factory ───────────────────────────────────────────────────────────

function makeDb(initial: Partial<AutonomyStateRow> = {}) {
  const base: AutonomyStateRow = {
    track: "saas",
    mode: "manual",
    clean_approval_streak: 0,
    graduation_threshold: 10,
    probation_sends_remaining: null,
    probation_threshold: 5,
    rolling_window_size: 20,
    maintenance_floor_pct: 80,
    circuit_broken_at: null,
    circuit_broken_reason: null,
    last_graduated_at: null,
    last_demoted_at: null,
  };

  let current: AutonomyStateRow = { ...base, ...initial };
  const activityInserted: unknown[] = [];

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve([current])),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        activityInserted.push(vals);
        return {
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((patches: Partial<AutonomyStateRow>) => {
        current = { ...current, ...patches };
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };

  return {
    db: db as never,
    getRow: () => current,
    activityInserted,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("transitionAutonomyState", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("manual → probation when streak hits graduation_threshold", async () => {
    const { db } = makeDb({
      mode: "manual",
      clean_approval_streak: 9,
      graduation_threshold: 10,
      probation_threshold: 5,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState("saas", "clean_approve", db);

    expect(result.mode).toBe("probation");
    expect(result.clean_approval_streak).toBe(0);
    expect(result.probation_sends_remaining).toBe(5);
    expect(result.last_graduated_at).toBeInstanceOf(Date);
  });

  it("activity_log row inserted on graduation", async () => {
    const { db, activityInserted } = makeDb({
      mode: "manual",
      clean_approval_streak: 9,
      graduation_threshold: 10,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    await transitionAutonomyState("saas", "clean_approve", db);

    expect(activityInserted).toHaveLength(1);
    const log = activityInserted[0] as Record<string, unknown>;
    expect(log.kind).toBe("autonomy_graduated");
  });

  it("streak increments below threshold without graduating", async () => {
    const { db } = makeDb({
      mode: "manual",
      clean_approval_streak: 3,
      graduation_threshold: 10,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState("saas", "clean_approve", db);

    expect(result.mode).toBe("manual");
    expect(result.clean_approval_streak).toBe(4);
  });

  it("streak reset on non_clean_approve", async () => {
    const { db } = makeDb({
      mode: "manual",
      clean_approval_streak: 7,
      graduation_threshold: 10,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState(
      "saas",
      "non_clean_approve",
      db,
    );

    expect(result.mode).toBe("manual");
    expect(result.clean_approval_streak).toBe(0);
  });

  it("probation → auto_send when probation_sends_remaining reaches 0", async () => {
    const { db } = makeDb({
      mode: "probation",
      probation_sends_remaining: 1,
      probation_threshold: 5,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState("saas", "clean_approve", db);

    expect(result.mode).toBe("auto_send");
    expect(result.probation_sends_remaining).toBeNull();
    expect(result.last_graduated_at).toBeInstanceOf(Date);
  });

  it("activity_log inserted on probation → auto_send graduation", async () => {
    const { db, activityInserted } = makeDb({
      mode: "probation",
      probation_sends_remaining: 1,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    await transitionAutonomyState("saas", "clean_approve", db);

    expect(activityInserted).toHaveLength(1);
    const log = activityInserted[0] as Record<string, unknown>;
    expect(log.kind).toBe("autonomy_graduated");
  });

  it("reject from probation → manual (demoted)", async () => {
    const { db, activityInserted } = makeDb({
      mode: "probation",
      probation_sends_remaining: 3,
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState("saas", "reject", db);

    expect(result.mode).toBe("manual");
    expect(result.clean_approval_streak).toBe(0);
    expect(result.probation_sends_remaining).toBeNull();
    expect(result.last_demoted_at).toBeInstanceOf(Date);
    const log = activityInserted[0] as Record<string, unknown>;
    expect(log.kind).toBe("autonomy_demoted");
  });

  it("maintenance_demote from auto_send → manual", async () => {
    const { db, activityInserted } = makeDb({
      track: "retainer",
      mode: "auto_send",
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState(
      "retainer",
      "maintenance_demote",
      db,
    );

    expect(result.mode).toBe("manual");
    expect(result.clean_approval_streak).toBe(0);
    expect(result.last_demoted_at).toBeInstanceOf(Date);
    const log = activityInserted[0] as Record<string, unknown>;
    expect(log.kind).toBe("autonomy_demoted");
  });

  it("reject from auto_send → circuit_broken", async () => {
    const { db, activityInserted } = makeDb({
      mode: "auto_send",
    });

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );

    const result = await transitionAutonomyState("saas", "reject", db);

    expect(result.mode).toBe("circuit_broken");
    expect(result.circuit_broken_at).toBeInstanceOf(Date);
    expect(result.circuit_broken_reason).toBe("manual_reject");
    expect(result.clean_approval_streak).toBe(0);
    const log = activityInserted[0] as Record<string, unknown>;
    expect(log.kind).toBe("autonomy_demoted");
  });

  it("throws when lead_gen_enabled kill-switch is off", async () => {
    vi.doMock("@/lib/kill-switches", () => ({
      killSwitches: { lead_gen_enabled: false },
    }));

    const { transitionAutonomyState } = await import(
      "@/lib/lead-gen/autonomy"
    );
    const { db } = makeDb();

    await expect(
      transitionAutonomyState("saas", "clean_approve", db),
    ).rejects.toThrow("lead_gen_enabled kill-switch is off");
  });
});
