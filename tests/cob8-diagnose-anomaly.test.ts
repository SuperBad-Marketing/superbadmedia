import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { deploy_events } from "@/lib/db/schema/deploy-events";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob8-diagnose.db");
let sqlite: Database.Database;
let testDb: BetterSQLite3Database;

const mockInvokeLlmTextWithMeta = vi.fn();

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

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmTextWithMeta: (...args: unknown[]) => mockInvokeLlmTextWithMeta(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/observatory/enqueue-diagnosis", () => ({
  enqueueDiagnosis: vi.fn().mockResolvedValue(undefined),
}));

import { diagnoseAnomaly } from "@/lib/observatory/diagnose-anomaly";

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
  sqlite.exec("DELETE FROM deploy_events");
  mockInvokeLlmTextWithMeta.mockReset();
});

function seedAnomaly(overrides: Partial<typeof cost_anomalies.$inferInsert> = {}) {
  const now = Date.now();
  const id = overrides.id ?? crypto.randomUUID();
  sqlite.exec(`
    INSERT INTO cost_anomalies (id, detector, job, tier, first_fired_at_ms, last_fired_at_ms, fire_count, observed_value, expected_band)
    VALUES (
      '${id}',
      '${overrides.detector ?? "hard_threshold"}',
      '${overrides.job ?? "cockpit-brief"}',
      '${overrides.tier ?? "mid"}',
      ${overrides.first_fired_at_ms ?? now},
      ${overrides.last_fired_at_ms ?? now},
      ${overrides.fire_count ?? 1},
      ${overrides.observed_value ?? 6.5},
      '${JSON.stringify(overrides.expected_band ?? { per_call_ceiling_aud: 5.0, check: "per_call" })}'
    )
  `);
  return id;
}

function seedCall(job: string, costAud: number, createdAtMs?: number) {
  const id = crypto.randomUUID();
  sqlite.exec(`
    INSERT INTO external_call_log (id, job, actor_type, units, estimated_cost_aud, created_at_ms)
    VALUES ('${id}', '${job}', 'internal', '{"inputTokens":100,"outputTokens":50}', ${costAud}, ${createdAtMs ?? Date.now()})
  `);
  return id;
}

function seedDeployEvent(commitSha: string, deployedAtMs?: number) {
  const id = crypto.randomUUID();
  sqlite.exec(`
    INSERT INTO deploy_events (id, commit_sha, deployed_at_ms, status)
    VALUES ('${id}', '${commitSha}', ${deployedAtMs ?? Date.now()}, 'ready')
  `);
  return id;
}

const VALID_DIAGNOSIS = JSON.stringify({
  hypothesis: "Per-call cost doubled after a prompt regression.",
  confidence: "high",
  recommended_action: "investigate",
  timeline_markdown: "- 14:02 Deploy landed\n- 14:08 Cost doubled",
});

// ---------------------------------------------------------------------------
// Core diagnosis flow
// ---------------------------------------------------------------------------

describe("diagnoseAnomaly", () => {
  it("calls Opus and caches diagnosis on the anomaly row", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: VALID_DIAGNOSIS,
      inputTokens: 5000,
      outputTokens: 300,
    });

    const result = await diagnoseAnomaly(anomalyId, testDb as any);

    expect(result.skipped).toBe(false);
    expect(result.diagnosis?.confidence).toBe("high");
    expect(result.diagnosis?.recommended_action).toBe("investigate");
    expect(result.costAud).toBeGreaterThan(0);

    const rows = sqlite
      .prepare("SELECT diagnosis_json, diagnosis_cost_aud FROM cost_anomalies WHERE id = ?")
      .all(anomalyId) as any[];
    expect(rows[0].diagnosis_json).toBeTruthy();
    expect(rows[0].diagnosis_cost_aud).toBeGreaterThan(0);
  });

  it("skips if anomaly not found", async () => {
    const result = await diagnoseAnomaly("nonexistent", testDb as any);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("not found");
  });

  it("skips if already diagnosed", async () => {
    const anomalyId = seedAnomaly();
    sqlite.exec(`
      UPDATE cost_anomalies SET diagnosis_json = '{"hypothesis":"already done","confidence":"high","recommended_action":"acknowledge","timeline_markdown":"- done"}'
      WHERE id = '${anomalyId}'
    `);

    const result = await diagnoseAnomaly(anomalyId, testDb as any);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("already diagnosed");
    expect(mockInvokeLlmTextWithMeta).not.toHaveBeenCalled();
  });

  it("skips when per-hour cap is reached", async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      seedAnomaly({
        id: `cap-${i}`,
        first_fired_at_ms: now - 1000 * i,
        last_fired_at_ms: now - 1000 * i,
      });
      sqlite.exec(`
        UPDATE cost_anomalies SET diagnosis_json = '{"hypothesis":"test","confidence":"high","recommended_action":"acknowledge","timeline_markdown":"- ok"}'
        WHERE id = 'cap-${i}'
      `);
    }

    const freshId = seedAnomaly({ id: "fresh-anomaly", first_fired_at_ms: now });
    const result = await diagnoseAnomaly(freshId, testDb as any);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("per-hour cap");
    expect(mockInvokeLlmTextWithMeta).not.toHaveBeenCalled();
  });

  it("includes deploy events in the prompt context", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);
    seedDeployEvent("abc1234");

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: VALID_DIAGNOSIS,
      inputTokens: 5000,
      outputTokens: 300,
    });

    await diagnoseAnomaly(anomalyId, testDb as any);

    const promptArg = mockInvokeLlmTextWithMeta.mock.calls[0][0].prompt as string;
    expect(promptArg).toContain("abc1234");
  });

  it("includes prompt version history in the context", async () => {
    const anomalyId = seedAnomaly();
    const id = crypto.randomUUID();
    sqlite.exec(`
      INSERT INTO external_call_log (id, job, actor_type, units, estimated_cost_aud, prompt_version_hash, created_at_ms)
      VALUES ('${id}', 'cockpit-brief', 'internal', '{"inputTokens":100,"outputTokens":50}', 6.5, 'hash-v2', ${Date.now()})
    `);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: VALID_DIAGNOSIS,
      inputTokens: 5000,
      outputTokens: 300,
    });

    await diagnoseAnomaly(anomalyId, testDb as any);

    const promptArg = mockInvokeLlmTextWithMeta.mock.calls[0][0].prompt as string;
    expect(promptArg).toContain("hash-v2");
  });

  it("handles malformed LLM response gracefully", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: "Sorry, I cannot diagnose this.",
      inputTokens: 5000,
      outputTokens: 50,
    });

    const result = await diagnoseAnomaly(anomalyId, testDb as any);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("diagnosis parse failure");

    const rows = sqlite
      .prepare("SELECT diagnosis_json FROM cost_anomalies WHERE id = ?")
      .all(anomalyId) as any[];
    expect(rows[0].diagnosis_json).toBeNull();
  });

  it("strips markdown fences from JSON response", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: "```json\n" + VALID_DIAGNOSIS + "\n```",
      inputTokens: 5000,
      outputTokens: 300,
    });

    const result = await diagnoseAnomaly(anomalyId, testDb as any);
    expect(result.skipped).toBe(false);
    expect(result.diagnosis?.confidence).toBe("high");
  });

  it("uses the observatory-diagnose-cost-anomaly job slug", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: VALID_DIAGNOSIS,
      inputTokens: 5000,
      outputTokens: 300,
    });

    await diagnoseAnomaly(anomalyId, testDb as any);

    expect(mockInvokeLlmTextWithMeta).toHaveBeenCalledWith(
      expect.objectContaining({ job: "observatory-diagnose-cost-anomaly" }),
    );
  });

  it("rejects invalid confidence values in LLM response", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: JSON.stringify({
        hypothesis: "Something happened.",
        confidence: "very_high",
        recommended_action: "investigate",
        timeline_markdown: "- stuff",
      }),
      inputTokens: 5000,
      outputTokens: 300,
    });

    const result = await diagnoseAnomaly(anomalyId, testDb as any);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("diagnosis parse failure");
  });

  it("rejects invalid recommended_action values in LLM response", async () => {
    const anomalyId = seedAnomaly();
    seedCall("cockpit-brief", 6.5);

    mockInvokeLlmTextWithMeta.mockResolvedValue({
      text: JSON.stringify({
        hypothesis: "Something happened.",
        confidence: "high",
        recommended_action: "panic",
        timeline_markdown: "- stuff",
      }),
      inputTokens: 5000,
      outputTokens: 300,
    });

    const result = await diagnoseAnomaly(anomalyId, testDb as any);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("diagnosis parse failure");
  });
});

// ---------------------------------------------------------------------------
// Scheduled task handler
// ---------------------------------------------------------------------------

describe("cost_anomaly_diagnose handler", () => {
  it("handler module exports the correct task type key", async () => {
    const { COST_ANOMALY_DIAGNOSE_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/cost-anomaly-diagnose"
    );
    expect(COST_ANOMALY_DIAGNOSE_HANDLERS).toHaveProperty("cost_anomaly_diagnose");
    expect(typeof COST_ANOMALY_DIAGNOSE_HANDLERS.cost_anomaly_diagnose).toBe("function");
  });
});
