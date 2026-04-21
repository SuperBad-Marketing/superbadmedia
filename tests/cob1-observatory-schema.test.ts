import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import {
  COST_ANOMALY_DETECTORS,
  COST_ANOMALY_TIERS,
} from "@/lib/db/schema/cost-anomalies";
import { DEPLOY_EVENT_STATUSES } from "@/lib/db/schema/deploy-events";
import { EXTERNAL_CALL_ACTOR_TYPES } from "@/lib/db/schema/external-call-log";
import {
  estimateAnthropicCostAud,
  estimateStripeCostAud,
  estimateResendCostAud,
} from "@/lib/observatory/pricing";
import { MODEL_JOB_SLUGS } from "@/lib/ai/models";
import { SETTINGS_KEYS } from "@/lib/settings";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob1-schema.db");
let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const testDb = drizzle(sqlite);
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

describe("COB-1 — cost_anomalies table", () => {
  it("exists with all required columns", () => {
    const cols = sqlite
      .prepare("PRAGMA table_info(cost_anomalies)")
      .all() as { name: string; notnull: number }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("detector");
    expect(names).toContain("job");
    expect(names).toContain("actor_scope");
    expect(names).toContain("tier");
    expect(names).toContain("first_fired_at_ms");
    expect(names).toContain("last_fired_at_ms");
    expect(names).toContain("fire_count");
    expect(names).toContain("observed_value");
    expect(names).toContain("expected_band");
    expect(names).toContain("diagnosis_json");
    expect(names).toContain("diagnosis_cost_aud");
    expect(names).toContain("acknowledged_at_ms");
    expect(names).toContain("acknowledged_until_ms");
    expect(names).toContain("kill_switch_triggered_at_ms");
    expect(names).toContain("resolved_at_ms");
  });

  it("accepts a valid insert and rejects invalid detector", () => {
    const id = crypto.randomUUID();
    sqlite
      .prepare(
        `INSERT INTO cost_anomalies (id, detector, job, tier, first_fired_at_ms, last_fired_at_ms, fire_count, observed_value, expected_band)
         VALUES (?, 'hard_threshold', 'outreach-writer', 'severe', ?, ?, 1, 87.5, '{"daily_ceiling_aud":15}')`,
      )
      .run(id, Date.now(), Date.now());

    const row = sqlite
      .prepare("SELECT * FROM cost_anomalies WHERE id = ?")
      .get(id) as Record<string, unknown>;
    expect(row.detector).toBe("hard_threshold");
    expect(row.tier).toBe("severe");

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO cost_anomalies (id, detector, job, tier, first_fired_at_ms, last_fired_at_ms, fire_count, observed_value, expected_band)
           VALUES (?, 'invalid_detector', 'x', 'low', 0, 0, 1, 1, '{}')`,
        )
        .run(crypto.randomUUID()),
    ).toThrow();
  });

  it("has the three required indexes", () => {
    const indexes = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='cost_anomalies'",
      )
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain("cost_anomalies_job_idx");
    expect(names).toContain("cost_anomalies_tier_idx");
    expect(names).toContain("cost_anomalies_unresolved_idx");
  });
});

describe("COB-1 — deploy_events table", () => {
  it("exists with all required columns", () => {
    const cols = sqlite
      .prepare("PRAGMA table_info(deploy_events)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("commit_sha");
    expect(names).toContain("deployed_at_ms");
    expect(names).toContain("status");
    expect(names).toContain("preview_url");
  });

  it("accepts valid deploy event statuses", () => {
    for (const status of DEPLOY_EVENT_STATUSES) {
      sqlite
        .prepare(
          `INSERT INTO deploy_events (id, commit_sha, deployed_at_ms, status)
           VALUES (?, 'abc123', ?, ?)`,
        )
        .run(crypto.randomUUID(), Date.now(), status);
    }
    const count = sqlite
      .prepare("SELECT COUNT(*) as c FROM deploy_events")
      .get() as { c: number };
    expect(count.c).toBe(3);
  });

  it("rejects invalid status", () => {
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO deploy_events (id, commit_sha, deployed_at_ms, status)
           VALUES (?, 'abc', 0, 'bogus')`,
        )
        .run(crypto.randomUUID()),
    ).toThrow();
  });

  it("has the deployed_at index", () => {
    const indexes = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='deploy_events'",
      )
      .all() as { name: string }[];
    expect(indexes.map((i) => i.name)).toContain("deploy_events_deployed_idx");
  });
});

describe("COB-1 — observatory settings seeded", () => {
  const OBSERVATORY_KEYS = [
    "observatory.monthly_threshold_1_aud",
    "observatory.monthly_threshold_2_aud",
    "observatory.monthly_threshold_3_aud",
    "observatory.projection_alert_enabled",
    "observatory.weekly_digest_enabled",
  ];

  it("all 5 observatory keys exist in the seed", () => {
    for (const key of OBSERVATORY_KEYS) {
      const row = sqlite
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key) as { value: string } | undefined;
      expect(row, `missing seed for ${key}`).toBeTruthy();
    }
  });

  it("threshold defaults are sensible AUD values", () => {
    const t1 = sqlite
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("observatory.monthly_threshold_1_aud") as { value: string };
    const t2 = sqlite
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("observatory.monthly_threshold_2_aud") as { value: string };
    const t3 = sqlite
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("observatory.monthly_threshold_3_aud") as { value: string };
    expect(Number(t1.value)).toBeLessThan(Number(t2.value));
    expect(Number(t2.value)).toBeLessThan(Number(t3.value));
  });

  it("all observatory keys are registered in settings.ts", () => {
    for (const key of OBSERVATORY_KEYS) {
      expect(SETTINGS_KEYS).toContain(key);
    }
  });
});

describe("COB-1 — TypeScript enums match spec", () => {
  it("cost anomaly detectors cover spec §3.2 detectors", () => {
    expect(COST_ANOMALY_DETECTORS).toContain("hard_threshold");
    expect(COST_ANOMALY_DETECTORS).toContain("rate");
    expect(COST_ANOMALY_DETECTORS).toContain("learned_band");
    expect(COST_ANOMALY_DETECTORS.length).toBe(3);
  });

  it("cost anomaly tiers cover spec §3.3 banner severities", () => {
    expect(COST_ANOMALY_TIERS).toContain("low");
    expect(COST_ANOMALY_TIERS).toContain("mid");
    expect(COST_ANOMALY_TIERS).toContain("severe");
    expect(COST_ANOMALY_TIERS.length).toBe(3);
  });

  it("external call actor types cover spec §2 Q2 actor model", () => {
    expect(EXTERNAL_CALL_ACTOR_TYPES).toContain("internal");
    expect(EXTERNAL_CALL_ACTOR_TYPES).toContain("external");
    expect(EXTERNAL_CALL_ACTOR_TYPES).toContain("shared");
    expect(EXTERNAL_CALL_ACTOR_TYPES).toContain("prospect");
    expect(EXTERNAL_CALL_ACTOR_TYPES.length).toBe(4);
  });

  it("deploy event statuses cover spec §4.1", () => {
    expect(DEPLOY_EVENT_STATUSES).toContain("deploying");
    expect(DEPLOY_EVENT_STATUSES).toContain("ready");
    expect(DEPLOY_EVENT_STATUSES).toContain("failed");
    expect(DEPLOY_EVENT_STATUSES.length).toBe(3);
  });
});

describe("COB-1 — observatory model registry contains observatory jobs", () => {
  it("all 3 observatory job slugs are in the model registry", () => {
    expect(MODEL_JOB_SLUGS).toContain("observatory-diagnose-cost-anomaly");
    expect(MODEL_JOB_SLUGS).toContain("observatory-draft-negative-margin-email");
    expect(MODEL_JOB_SLUGS).toContain("observatory-draft-weekly-digest");
  });
});

describe("COB-1 — pricing estimates", () => {
  it("Opus estimate for 1000 input + 500 output tokens is non-zero AUD", () => {
    const cost = estimateAnthropicCostAud("opus", {
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1);
  });

  it("Haiku is cheaper than Opus for same usage", () => {
    const usage = { inputTokens: 10000, outputTokens: 5000 };
    const opus = estimateAnthropicCostAud("opus", usage);
    const haiku = estimateAnthropicCostAud("haiku", usage);
    expect(haiku).toBeLessThan(opus);
  });

  it("zero tokens = zero cost", () => {
    expect(
      estimateAnthropicCostAud("opus", { inputTokens: 0, outputTokens: 0 }),
    ).toBe(0);
  });

  it("Stripe per-call estimate is non-zero", () => {
    expect(estimateStripeCostAud()).toBeGreaterThan(0);
  });

  it("Resend per-call estimate is non-zero", () => {
    expect(estimateResendCostAud()).toBeGreaterThan(0);
  });
});

describe("COB-1 — external_call_log pre-existing table", () => {
  it("accepts a cost-logged row via direct SQL insert", () => {
    const id = crypto.randomUUID();
    sqlite
      .prepare(
        `INSERT INTO external_call_log (id, job, actor_type, units, estimated_cost_aud, created_at_ms)
         VALUES (?, 'observatory-diagnose-cost-anomaly', 'internal', '{"inputTokens":500,"outputTokens":200}', 0.0234, ?)`,
      )
      .run(id, Date.now());
    const row = sqlite
      .prepare("SELECT * FROM external_call_log WHERE id = ?")
      .get(id) as Record<string, unknown>;
    expect(row.job).toBe("observatory-diagnose-cost-anomaly");
    expect(row.actor_type).toBe("internal");
  });
});
