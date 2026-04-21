import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import { eq, sql } from "drizzle-orm";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { sweepRateDetector } from "@/lib/observatory/rate-detector";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob5-rate-detector.db");
let sqlite: Database.Database;
let testDb: BetterSQLite3Database;

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    observatory_detectors_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

vi.mock("@/lib/observatory/enqueue-diagnosis", () => ({
  enqueueDiagnosis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/observatory/enqueue-severe-alert", () => ({
  maybeSendSevereAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({
    id: "test",
    kind: "cost_anomaly_fired",
    body: "",
    meta: null,
    company_id: null,
    contact_id: null,
    deal_id: null,
    created_at_ms: Date.now(),
    created_by: null,
  }),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  const folder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder: folder });
  runSeeds(sqlite, folder);
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  sqlite.exec("DELETE FROM cost_anomalies");
  sqlite.exec("DELETE FROM external_call_log");
});

function insertCalls(
  job: string,
  actorId: string | null,
  count: number,
  timestampMs: number,
  actorType: "internal" | "external" | "prospect" = "external",
) {
  const stmt = sqlite.prepare(
    `INSERT INTO external_call_log (id, job, actor_type, actor_id, units, estimated_cost_aud, created_at_ms)
     VALUES (?, ?, ?, ?, '{}', 0.01, ?)`,
  );
  for (let i = 0; i < count; i++) {
    stmt.run(crypto.randomUUID(), job, actorType, actorId, timestampMs + i);
  }
}

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

describe("kill switch", () => {
  it("returns breaches=0 when detectors are disabled", async () => {
    const ks = await import("@/lib/kill-switches");
    (ks.killSwitches as any).observatory_detectors_enabled = false;
    try {
      const now = Date.now();
      insertCalls("cockpit-brief", "actor-1", 25, now - 2 * 60 * 1000);
      const result = await sweepRateDetector(testDb as any);
      expect(result.breaches).toBe(0);
    } finally {
      (ks.killSwitches as any).observatory_detectors_enabled = true;
    }
  });
});

// ---------------------------------------------------------------------------
// Minimum call gate
// ---------------------------------------------------------------------------

describe("minimum call gate", () => {
  it("does not fire when under 20 calls in the window", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", "actor-1", 19, now - 2 * 60 * 1000);
    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(0);
    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(0);
  });

  it("fires when exactly 20 calls in the window with no trailing history", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", "actor-1", 20, now - 2 * 60 * 1000);
    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rate comparison against trailing-hour median
// ---------------------------------------------------------------------------

describe("trailing-hour median comparison", () => {
  it("fires when current window exceeds 10x trailing-hour median", async () => {
    const now = Date.now();
    const MS_5MIN = 5 * 60 * 1000;

    // Trailing hour: 2 calls per 5-min bucket (12 buckets, median = 2)
    // Threshold = 10 × 2 = 20. Need > 20 AND >= 20 min-calls.
    for (let bucket = 0; bucket < 12; bucket++) {
      const bucketTime = now - MS_5MIN - (60 * 60 * 1000) + bucket * MS_5MIN;
      insertCalls("cockpit-brief", "actor-1", 2, bucketTime);
    }

    // Current window: 25 calls (> 20 threshold, > 20 min-calls)
    insertCalls("cockpit-brief", "actor-1", 25, now - 2 * 60 * 1000);

    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(1);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].detector).toBe("rate");
    expect(anomalies[0].tier).toBe("severe");
    expect(anomalies[0].observed_value).toBe(25);
  });

  it("does not fire when current window is within 10x trailing-hour median", async () => {
    const now = Date.now();
    const MS_5MIN = 5 * 60 * 1000;

    // Trailing hour: 5 calls per bucket (median = 5). Threshold = 50.
    for (let bucket = 0; bucket < 12; bucket++) {
      const bucketTime = now - MS_5MIN - (60 * 60 * 1000) + bucket * MS_5MIN;
      insertCalls("cockpit-brief", "actor-1", 5, bucketTime);
    }

    // Current window: 25 calls (>= 20 min-calls, but <= 50 threshold)
    insertCalls("cockpit-brief", "actor-1", 25, now - 2 * 60 * 1000);

    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(0);
  });

  it("fires with zero trailing history when min-calls met", async () => {
    const now = Date.now();
    // No trailing hour data. Median = 0. Threshold = 0. 20 calls > 0.
    insertCalls("cockpit-brief", "actor-1", 20, now - 2 * 60 * 1000);

    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Actor scoping
// ---------------------------------------------------------------------------

describe("actor scoping", () => {
  it("detects per {job, actor_id} independently", async () => {
    const now = Date.now();

    // Actor A: 25 calls (fires)
    insertCalls("cockpit-brief", "actor-a", 25, now - 2 * 60 * 1000);
    // Actor B: 10 calls (does not fire — under min-calls)
    insertCalls("cockpit-brief", "actor-b", 10, now - 2 * 60 * 1000);

    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(1);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);

    const scope = anomalies[0].actor_scope;
    expect(scope).toEqual({ actor_type: "external", actor_id: "actor-a" });
  });

  it("fires separately for two actors on the same job", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", "actor-a", 25, now - 2 * 60 * 1000);
    insertCalls("cockpit-brief", "actor-b", 25, now - 2 * 60 * 1000);

    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(2);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(2);
  });

  it("handles null actor_id", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", null, 25, now - 2 * 60 * 1000, "internal");

    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(1);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].actor_scope).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dedupe within 24h window
// ---------------------------------------------------------------------------

describe("dedupe", () => {
  it("updates existing anomaly on second fire within 24h", async () => {
    const now = Date.now();

    // First fire
    insertCalls("cockpit-brief", "actor-1", 25, now - 3 * 60 * 1000);
    await sweepRateDetector(testDb as any);

    let anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].fire_count).toBe(1);

    // Add more calls and fire again
    insertCalls("cockpit-brief", "actor-1", 30, now - 1 * 60 * 1000);
    await sweepRateDetector(testDb as any);

    anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].fire_count).toBe(2);
    expect(anomalies[0].observed_value).toBe(55);
  });

  it("creates separate anomalies for different actors on same job", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", "actor-a", 25, now - 2 * 60 * 1000);
    insertCalls("cockpit-brief", "actor-b", 25, now - 2 * 60 * 1000);

    await sweepRateDetector(testDb as any);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Unregistered jobs
// ---------------------------------------------------------------------------

describe("unregistered jobs", () => {
  it("ignores calls from unregistered job names", async () => {
    const now = Date.now();
    insertCalls("totally-unknown-job", "actor-1", 30, now - 2 * 60 * 1000);
    const result = await sweepRateDetector(testDb as any);
    expect(result.breaches).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tier assignment
// ---------------------------------------------------------------------------

describe("tier assignment", () => {
  it("always assigns severe tier (loop-in-progress)", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", "actor-1", 20, now - 2 * 60 * 1000);

    await sweepRateDetector(testDb as any);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].tier).toBe("severe");
  });
});

// ---------------------------------------------------------------------------
// Expected band metadata
// ---------------------------------------------------------------------------

describe("expected_band metadata", () => {
  it("stores rate-specific metadata in expected_band", async () => {
    const now = Date.now();
    insertCalls("cockpit-brief", "actor-1", 25, now - 2 * 60 * 1000);

    await sweepRateDetector(testDb as any);

    const anomalies = await (testDb as any)
      .select()
      .from(cost_anomalies);
    expect(anomalies).toHaveLength(1);

    const band = anomalies[0].expected_band;
    expect(band.check).toBe("rate");
    expect(band.window_min).toBe(5);
    expect(band.trailing_hour_median).toBe(0);
    expect(band.multiplier).toBe(10);
    expect(band.min_calls).toBe(20);
  });
});
