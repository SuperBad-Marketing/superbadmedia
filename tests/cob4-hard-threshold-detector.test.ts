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
import {
  checkPerCallThreshold,
  sweepDailyThresholds,
} from "@/lib/observatory/hard-threshold-detector";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob4-detector.db");
let sqlite: Database.Database;
let testDb: BetterSQLite3Database;

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    observatory_detectors_enabled: true,
    scheduled_tasks_enabled: true,
  },
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

// ---------------------------------------------------------------------------
// Per-call threshold checks
// ---------------------------------------------------------------------------

describe("checkPerCallThreshold", () => {
  it("returns breached=false when cost is under ceiling", async () => {
    const result = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 0.50 },
      testDb as any,
    );
    expect(result.breached).toBe(false);
  });

  it("creates a cost_anomaly when cost exceeds per-call ceiling", async () => {
    const result = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 10.0 },
      testDb as any,
    );
    expect(result.breached).toBe(true);
    expect(result.anomalyId).toBeDefined();

    const rows = sqlite
      .prepare("SELECT * FROM cost_anomalies WHERE id = ?")
      .all(result.anomalyId!) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].detector).toBe("hard_threshold");
    expect(rows[0].job).toBe("cockpit-brief");
    expect(rows[0].fire_count).toBe(1);
  });

  it("assigns tier=severe when ratio >= 5x", async () => {
    const result = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 30.0 },
      testDb as any,
    );
    const rows = sqlite
      .prepare("SELECT tier FROM cost_anomalies WHERE id = ?")
      .all(result.anomalyId!) as any[];
    expect(rows[0].tier).toBe("severe");
  });

  it("assigns tier=mid when ratio >= 2x and < 5x", async () => {
    const result = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 12.0 },
      testDb as any,
    );
    const rows = sqlite
      .prepare("SELECT tier FROM cost_anomalies WHERE id = ?")
      .all(result.anomalyId!) as any[];
    expect(rows[0].tier).toBe("mid");
  });

  it("assigns tier=low when ratio > 1x and < 2x", async () => {
    const result = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 6.0 },
      testDb as any,
    );
    const rows = sqlite
      .prepare("SELECT tier FROM cost_anomalies WHERE id = ?")
      .all(result.anomalyId!) as any[];
    expect(rows[0].tier).toBe("low");
  });

  it("dedupes within 24h window — updates existing row", async () => {
    const first = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 10.0 },
      testDb as any,
    );
    const second = await checkPerCallThreshold(
      { job: "cockpit-brief", estimatedCostAud: 15.0 },
      testDb as any,
    );

    expect(first.anomalyId).toBe(second.anomalyId);

    const rows = sqlite
      .prepare("SELECT fire_count, observed_value FROM cost_anomalies WHERE id = ?")
      .all(first.anomalyId!) as any[];
    expect(rows[0].fire_count).toBe(2);
    expect(rows[0].observed_value).toBe(15.0);
  });

  it("returns breached=false for unregistered jobs", async () => {
    const result = await checkPerCallThreshold(
      { job: "nonexistent-job-xyz", estimatedCostAud: 9999 },
      testDb as any,
    );
    expect(result.breached).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Daily sweep
// ---------------------------------------------------------------------------

describe("sweepDailyThresholds", () => {
  function insertCall(job: string, costAud: number, ageMs = 0) {
    const now = Date.now() - ageMs;
    sqlite.prepare(
      `INSERT INTO external_call_log (id, job, actor_type, units, estimated_cost_aud, created_at_ms)
       VALUES (?, ?, 'internal', '{}', ?, ?)`,
    ).run(crypto.randomUUID(), job, costAud, now);
  }

  it("detects daily ceiling breach", async () => {
    for (let i = 0; i < 40; i++) {
      insertCall("cockpit-brief", 5.0);
    }

    const result = await sweepDailyThresholds(testDb as any);
    expect(result.breaches).toBeGreaterThanOrEqual(1);

    const rows = sqlite
      .prepare(
        "SELECT * FROM cost_anomalies WHERE detector = 'hard_threshold' AND job = 'cockpit-brief'",
      )
      .all() as any[];
    expect(rows).toHaveLength(1);
    const band = JSON.parse(rows[0].expected_band);
    expect(band.check).toBe("daily");
  });

  it("skips jobs under daily ceiling", async () => {
    insertCall("cockpit-brief", 1.0);

    const result = await sweepDailyThresholds(testDb as any);
    expect(result.breaches).toBe(0);
  });

  it("ignores calls older than 24h", async () => {
    const ms25h = 25 * 60 * 60 * 1000;
    for (let i = 0; i < 40; i++) {
      insertCall("cockpit-brief", 5.0, ms25h);
    }

    const result = await sweepDailyThresholds(testDb as any);
    expect(result.breaches).toBe(0);
  });

  it("dedupes daily anomalies across sweeps", async () => {
    for (let i = 0; i < 40; i++) {
      insertCall("cockpit-brief", 5.0);
    }

    await sweepDailyThresholds(testDb as any);
    await sweepDailyThresholds(testDb as any);

    const rows = sqlite
      .prepare(
        "SELECT fire_count FROM cost_anomalies WHERE detector = 'hard_threshold' AND job = 'cockpit-brief'",
      )
      .all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].fire_count).toBe(2);
  });
});
