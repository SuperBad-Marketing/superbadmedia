import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { sweepLearnedBandDetector } from "@/lib/observatory/learned-band-detector";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob6-learned-band.db");
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

const MS_1D = 24 * 60 * 60 * 1000;
const MS_15MIN = 15 * 60 * 1000;
const NOW = Date.now();
const JOB = "cockpit-brief";

function insertCall(
  job: string,
  costAud: number,
  timestampMs: number,
) {
  sqlite.prepare(
    `INSERT INTO external_call_log (id, job, actor_type, actor_id, units, estimated_cost_aud, created_at_ms)
     VALUES (?, ?, 'internal', NULL, '{}', ?, ?)`,
  ).run(crypto.randomUUID(), job, costAud, timestampMs);
}

function seedHistory(job: string, count: number, costAud: number, startMs: number) {
  const stmt = sqlite.prepare(
    `INSERT INTO external_call_log (id, job, actor_type, actor_id, units, estimated_cost_aud, created_at_ms)
     VALUES (?, ?, 'internal', NULL, '{}', ?, ?)`,
  );
  for (let i = 0; i < count; i++) {
    const ts = startMs + i * (MS_1D / count);
    stmt.run(crypto.randomUUID(), job, costAud, ts);
  }
}

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

describe("kill switch", () => {
  it("returns zero breaches when detectors disabled", async () => {
    const mod = await import("@/lib/kill-switches");
    (mod.killSwitches as Record<string, boolean>).observatory_detectors_enabled = false;

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);

    (mod.killSwitches as Record<string, boolean>).observatory_detectors_enabled = true;
  });
});

// ---------------------------------------------------------------------------
// Warmup gate
// ---------------------------------------------------------------------------

describe("warmup gate", () => {
  it("skips job with fewer than 50 calls", async () => {
    seedHistory(JOB, 30, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 100.0, NOW - 5 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);
  });

  it("skips job with no data older than 7 days", async () => {
    seedHistory(JOB, 60, 1.0, NOW - 6 * MS_1D);
    insertCall(JOB, 100.0, NOW - 5 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);
  });

  it("activates when both warmup conditions met", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 100.0, NOW - 5 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Detection logic
// ---------------------------------------------------------------------------

describe("detection", () => {
  it("fires when recent call exceeds p95 × multiplier", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 5.0, NOW - 3 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(1);

    const anomalies = sqlite.prepare("SELECT * FROM cost_anomalies").all() as Array<Record<string, unknown>>;
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].detector).toBe("learned_band");
    expect(anomalies[0].job).toBe(JOB);
    expect(anomalies[0].actor_scope).toBeNull();

    const band = JSON.parse(anomalies[0].expected_band as string);
    expect(band.check).toBe("learned_band");
    expect(band.p95).toBeGreaterThan(0);
    expect(band.multiplier).toBe(3);
  });

  it("does not fire when recent call is within band", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 2.0, NOW - 3 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);
  });

  it("assigns tier low for moderate breach", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 5.0, NOW - 3 * 60 * 1000);

    await sweepLearnedBandDetector(testDb as never);
    const anomaly = sqlite.prepare("SELECT tier FROM cost_anomalies").get() as Record<string, string>;
    expect(anomaly.tier).toBe("low");
  });

  it("assigns tier mid for 5x+ breach", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 20.0, NOW - 3 * 60 * 1000);

    await sweepLearnedBandDetector(testDb as never);
    const anomaly = sqlite.prepare("SELECT tier FROM cost_anomalies").get() as Record<string, string>;
    expect(anomaly.tier).toBe("mid");
  });

  it("only checks calls in the last 15-minute window", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 100.0, NOW - 20 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

describe("dedupe", () => {
  it("updates existing anomaly on repeat fire", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 10.0, NOW - 5 * 60 * 1000);

    await sweepLearnedBandDetector(testDb as never);
    let anomalies = sqlite.prepare("SELECT * FROM cost_anomalies").all() as Array<Record<string, unknown>>;
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].fire_count).toBe(1);

    insertCall(JOB, 12.0, NOW - 2 * 60 * 1000);
    await sweepLearnedBandDetector(testDb as never);

    anomalies = sqlite.prepare("SELECT * FROM cost_anomalies").all() as Array<Record<string, unknown>>;
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].fire_count).toBe(2);
  });

  it("fires one anomaly per job even with multiple breaching calls", async () => {
    seedHistory(JOB, 55, 1.0, NOW - 10 * MS_1D);
    insertCall(JOB, 10.0, NOW - 5 * 60 * 1000);
    insertCall(JOB, 15.0, NOW - 3 * 60 * 1000);

    await sweepLearnedBandDetector(testDb as never);
    const anomalies = sqlite.prepare("SELECT * FROM cost_anomalies").all();
    expect(anomalies).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Scoping
// ---------------------------------------------------------------------------

describe("scoping", () => {
  it("detects independently per job", async () => {
    const jobA = JOB;
    const jobB = "brand-dna-generate-prose-portrait";

    seedHistory(jobA, 55, 1.0, NOW - 10 * MS_1D);
    seedHistory(jobB, 55, 1.0, NOW - 10 * MS_1D);

    insertCall(jobA, 10.0, NOW - 3 * 60 * 1000);
    insertCall(jobB, 10.0, NOW - 3 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(2);

    const anomalies = sqlite.prepare("SELECT job FROM cost_anomalies ORDER BY job").all() as Array<Record<string, string>>;
    expect(anomalies).toHaveLength(2);
  });

  it("skips jobs not in registry", async () => {
    seedHistory("not-a-real-job", 55, 1.0, NOW - 10 * MS_1D);
    insertCall("not-a-real-job", 100.0, NOW - 3 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);
  });

  it("skips jobs with zero p95", async () => {
    seedHistory(JOB, 55, 0, NOW - 10 * MS_1D);
    insertCall(JOB, 0, NOW - 3 * 60 * 1000);

    const result = await sweepLearnedBandDetector(testDb as never);
    expect(result.breaches).toBe(0);
  });
});
