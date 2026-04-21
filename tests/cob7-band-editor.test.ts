import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob7-band-editor.db");
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
    kind: "band_adjusted",
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
  sqlite.exec("DELETE FROM band_overrides");
  sqlite.exec("DELETE FROM activity_log");
});

describe("getEffectiveBands", () => {
  it("returns registry defaults when no override exists", async () => {
    const { getEffectiveBands, getJobBands } = await import(
      "@/lib/observatory/job-registry"
    );
    const effective = await getEffectiveBands("cockpit-brief");
    const defaults = getJobBands("cockpit-brief");
    expect(effective).toBeDefined();
    expect(effective!.per_call_ceiling_aud).toBe(defaults!.per_call_ceiling_aud);
    expect(effective!.daily_ceiling_aud).toBe(defaults!.daily_ceiling_aud);
    expect(effective!.learned_band_multiplier).toBe(defaults!.learned_band_multiplier);
  });

  it("returns undefined for unknown jobs", async () => {
    const { getEffectiveBands } = await import("@/lib/observatory/job-registry");
    const result = await getEffectiveBands("nonexistent-job");
    expect(result).toBeUndefined();
  });

  it("merges partial overrides with defaults", async () => {
    const { getEffectiveBands, getJobBands } = await import(
      "@/lib/observatory/job-registry"
    );
    const defaults = getJobBands("cockpit-brief")!;

    sqlite.exec(
      `INSERT INTO band_overrides (job, per_call_ceiling_aud, daily_ceiling_aud, learned_band_multiplier, updated_at_ms)
       VALUES ('cockpit-brief', 10.0, NULL, NULL, ${Date.now()})`,
    );

    const effective = await getEffectiveBands("cockpit-brief");
    expect(effective!.per_call_ceiling_aud).toBe(10.0);
    expect(effective!.daily_ceiling_aud).toBe(defaults.daily_ceiling_aud);
    expect(effective!.learned_band_multiplier).toBe(defaults.learned_band_multiplier);
  });

  it("applies full overrides", async () => {
    const { getEffectiveBands } = await import("@/lib/observatory/job-registry");

    sqlite.exec(
      `INSERT INTO band_overrides (job, per_call_ceiling_aud, daily_ceiling_aud, learned_band_multiplier, updated_at_ms)
       VALUES ('cockpit-brief', 8.0, 200.0, 5.0, ${Date.now()})`,
    );

    const effective = await getEffectiveBands("cockpit-brief");
    expect(effective!.per_call_ceiling_aud).toBe(8.0);
    expect(effective!.daily_ceiling_aud).toBe(200.0);
    expect(effective!.learned_band_multiplier).toBe(5.0);
  });
});

describe("adjustBands", () => {
  it("creates an override and logs activity", async () => {
    const { adjustBands } = await import("@/lib/observatory/band-editor");
    const { logActivity } = await import("@/lib/activity-log");

    const result = await adjustBands({
      job: "cockpit-brief",
      per_call_ceiling_aud: 10.0,
      daily_ceiling_aud: 200.0,
      learned_band_multiplier: 4.0,
    });

    expect(result.current.per_call_ceiling_aud).toBe(10.0);
    expect(result.current.daily_ceiling_aud).toBe(200.0);
    expect(result.current.learned_band_multiplier).toBe(4.0);
    expect(result.previous.per_call_ceiling_aud).toBe(5.0);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "band_adjusted",
        meta: expect.objectContaining({
          job: "cockpit-brief",
          previous: expect.any(Object),
          current: expect.any(Object),
        }),
      }),
    );
  });

  it("upserts on repeated adjustments", async () => {
    const { adjustBands } = await import("@/lib/observatory/band-editor");

    await adjustBands({
      job: "cockpit-brief",
      per_call_ceiling_aud: 10.0,
    });

    const result2 = await adjustBands({
      job: "cockpit-brief",
      per_call_ceiling_aud: 15.0,
      daily_ceiling_aud: 300.0,
    });

    expect(result2.current.per_call_ceiling_aud).toBe(15.0);
    expect(result2.current.daily_ceiling_aud).toBe(300.0);

    const rows = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM band_overrides WHERE job = 'cockpit-brief'")
      .get() as { cnt: number };
    expect(rows.cnt).toBe(1);
  });

  it("throws for unknown jobs", async () => {
    const { adjustBands } = await import("@/lib/observatory/band-editor");

    await expect(
      adjustBands({ job: "nonexistent-job", per_call_ceiling_aud: 1.0 }),
    ).rejects.toThrow("[band-editor] unknown job: nonexistent-job");
  });

  it("reverts to defaults when null values are passed", async () => {
    const { adjustBands } = await import("@/lib/observatory/band-editor");
    const { getJobBands } = await import("@/lib/observatory/job-registry");

    await adjustBands({
      job: "cockpit-brief",
      per_call_ceiling_aud: 10.0,
      daily_ceiling_aud: 200.0,
    });

    const result = await adjustBands({
      job: "cockpit-brief",
      per_call_ceiling_aud: null,
      daily_ceiling_aud: null,
    });

    const defaults = getJobBands("cockpit-brief")!;
    expect(result.current.per_call_ceiling_aud).toBe(defaults.per_call_ceiling_aud);
    expect(result.current.daily_ceiling_aud).toBe(defaults.daily_ceiling_aud);
  });

  it("preserves rate_override from registry (not editable)", async () => {
    const { adjustBands } = await import("@/lib/observatory/band-editor");

    const result = await adjustBands({
      job: "cockpit-brief",
      per_call_ceiling_aud: 10.0,
    });

    expect(result.current).toHaveProperty("rate_override");
    expect(result.current.rate_override).toBeNull();
  });
});
