import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { external_call_log } from "@/lib/db/schema/external-call-log";

const TEST_DB = path.join(process.cwd(), "tests/.test-cob9.db");
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

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg-1" }),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => {
      const vals: Record<string, unknown> = {
        "observatory.monthly_threshold_1_aud": 250,
        "observatory.monthly_threshold_2_aud": 500,
        "observatory.monthly_threshold_3_aud": 1000,
        "observatory.projection_alert_enabled": true,
      };
      return Promise.resolve(vals[key] ?? null);
    }),
  },
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
  vi.clearAllMocks();
  sqlite.exec("DELETE FROM cost_anomalies");
  sqlite.exec("DELETE FROM external_call_log");
});

// ── Health banners ─────────────────────────────────────────────────

describe("COB-9: getObservatoryHealthBanners", () => {
  it("returns empty array when kill switch is off", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    (killSwitches as Record<string, boolean>).observatory_detectors_enabled = false;

    const { getObservatoryHealthBanners } = await import(
      "@/lib/observatory/health-banners"
    );
    const banners = await getObservatoryHealthBanners();
    expect(banners).toEqual([]);

    (killSwitches as Record<string, boolean>).observatory_detectors_enabled = true;
  });

  it("returns banners for unresolved anomalies", async () => {
    const now = Date.now();
    testDb.insert(cost_anomalies).values({
      id: "a1",
      detector: "hard_threshold",
      job: "outreach-writer",
      tier: "severe",
      first_fired_at_ms: now - 3600_000,
      last_fired_at_ms: now - 1800_000,
      fire_count: 3,
      observed_value: 340.12,
      expected_band: { daily_ceiling_aud: 15 },
    }).run();

    const { getObservatoryHealthBanners } = await import(
      "@/lib/observatory/health-banners"
    );
    const banners = await getObservatoryHealthBanners(now);

    const anomalyBanner = banners.find((b) => b.id === "cost_anomaly:a1");
    expect(anomalyBanner).toBeDefined();
    expect(anomalyBanner!.severity).toBe("critical");
    expect(anomalyBanner!.source).toBe("cost-usage-observatory");
    expect(anomalyBanner!.href).toBe("/lite/observatory/anomalies/a1");
    expect(anomalyBanner!.summary).toContain("outreach-writer");
  });

  it("skips suppressed anomalies", async () => {
    const now = Date.now();
    testDb.insert(cost_anomalies).values({
      id: "a-suppressed",
      detector: "learned_band",
      job: "brand-dna-generate-prose-portrait",
      tier: "low",
      first_fired_at_ms: now - 7200_000,
      last_fired_at_ms: now - 3600_000,
      fire_count: 1,
      observed_value: 43.80,
      expected_band: { daily_ceiling_aud: 6 },
      acknowledged_at_ms: now - 3000_000,
      acknowledged_until_ms: now + 86400_000,
    }).run();

    const { getObservatoryHealthBanners } = await import(
      "@/lib/observatory/health-banners"
    );
    const banners = await getObservatoryHealthBanners(now);
    const anomalyBanners = banners.filter((b) => b.id.startsWith("cost_anomaly:"));
    expect(anomalyBanners.length).toBe(0);
  });

  it("maps tier low/mid to warning, severe to critical", async () => {
    const now = Date.now();
    testDb.insert(cost_anomalies).values([
      {
        id: "low1",
        detector: "learned_band",
        job: "test-low",
        tier: "low",
        first_fired_at_ms: now,
        last_fired_at_ms: now,
        fire_count: 1,
        observed_value: 12,
        expected_band: { daily_ceiling_aud: 6 },
      },
      {
        id: "mid1",
        detector: "hard_threshold",
        job: "test-mid",
        tier: "mid",
        first_fired_at_ms: now,
        last_fired_at_ms: now,
        fire_count: 1,
        observed_value: 87,
        expected_band: { daily_ceiling_aud: 8 },
      },
      {
        id: "sev1",
        detector: "rate",
        job: "test-severe",
        tier: "severe",
        first_fired_at_ms: now,
        last_fired_at_ms: now,
        fire_count: 5,
        observed_value: 200,
        expected_band: { rate_override: null },
      },
    ]).run();

    const { getObservatoryHealthBanners } = await import(
      "@/lib/observatory/health-banners"
    );
    const banners = await getObservatoryHealthBanners(now);

    expect(banners.find((b) => b.id === "cost_anomaly:low1")?.severity).toBe("warning");
    expect(banners.find((b) => b.id === "cost_anomaly:mid1")?.severity).toBe("warning");
    expect(banners.find((b) => b.id === "cost_anomaly:sev1")?.severity).toBe("critical");
  });

  it("emits monthly threshold banner when MTD exceeds threshold", async () => {
    const now = Date.now();
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

    for (let i = 0; i < 30; i++) {
      testDb.insert(external_call_log).values({
        id: `ecl-${i}`,
        job: "outreach-writer",
        actor_type: "internal",
        units: JSON.stringify({ input_tokens: 100, output_tokens: 50 }),
        estimated_cost_aud: 10,
        created_at_ms: monthStart + i * 3600_000,
      }).run();
    }

    const { getObservatoryHealthBanners } = await import(
      "@/lib/observatory/health-banners"
    );
    const banners = await getObservatoryHealthBanners(now);

    const thresholdBanner = banners.find((b) => b.id === "monthly_threshold:250");
    expect(thresholdBanner).toBeDefined();
    expect(thresholdBanner!.summary).toContain("250");
    expect(thresholdBanner!.source).toBe("cost-usage-observatory");
  });

  it("does not emit resolved anomalies", async () => {
    const now = Date.now();
    testDb.insert(cost_anomalies).values({
      id: "resolved1",
      detector: "hard_threshold",
      job: "test-resolved",
      tier: "severe",
      first_fired_at_ms: now - 86400_000,
      last_fired_at_ms: now - 86400_000,
      fire_count: 1,
      observed_value: 500,
      expected_band: { daily_ceiling_aud: 15 },
      resolved_at_ms: now - 3600_000,
    }).run();

    const { getObservatoryHealthBanners } = await import(
      "@/lib/observatory/health-banners"
    );
    const banners = await getObservatoryHealthBanners(now);
    const anomalyBanners = banners.filter((b) => b.id.startsWith("cost_anomaly:"));
    expect(anomalyBanners.length).toBe(0);
  });
});

// ── Severe alert email ─────────────────────────────────────────────

describe("COB-9: sendSevereAlertEmail", () => {
  it("sends transactional email with correct subject", async () => {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const { sendSevereAlertEmail } = await import(
      "@/lib/observatory/severe-alert-email"
    );

    const anomaly = {
      id: "a-severe",
      detector: "hard_threshold" as const,
      job: "outreach-writer",
      actor_scope: null,
      tier: "severe" as const,
      first_fired_at_ms: Date.now(),
      last_fired_at_ms: Date.now(),
      fire_count: 1,
      observed_value: 340.12,
      expected_band: { daily_ceiling_aud: 15 },
      diagnosis_json: null,
      diagnosis_cost_aud: null,
      acknowledged_at_ms: null,
      acknowledged_until_ms: null,
      kill_switch_triggered_at_ms: null,
      resolved_at_ms: null,
    };

    const result = await sendSevereAlertEmail(anomaly);
    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.classification).toBe("transactional");
    expect(call.subject).toContain("[SEVERE]");
    expect(call.subject).toContain("outreach-writer");
    expect(call.body).toContain("Investigate");
  });

  it("uses rate-detector subject for rate anomalies", async () => {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const { sendSevereAlertEmail } = await import(
      "@/lib/observatory/severe-alert-email"
    );

    await sendSevereAlertEmail({
      id: "a-rate",
      detector: "rate" as const,
      job: "content-generate-blog-post",
      actor_scope: null,
      tier: "severe" as const,
      first_fired_at_ms: Date.now(),
      last_fired_at_ms: Date.now(),
      fire_count: 5,
      observed_value: 200,
      expected_band: { rate_override: null },
      diagnosis_json: null,
      diagnosis_cost_aud: null,
      acknowledged_at_ms: null,
      acknowledged_until_ms: null,
      kill_switch_triggered_at_ms: null,
      resolved_at_ms: null,
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toContain("Rate limit triggered");
  });
});

// ── Kill-switch toggle ─────────────────────────────────────────────

describe("COB-9: toggleJobKillSwitch", () => {
  it("disables a job and logs activity", async () => {
    const { logActivity } = await import("@/lib/activity-log");
    const { toggleJobKillSwitch } = await import(
      "@/lib/observatory/kill-switch-toggle"
    );
    const { JOB_REGISTRY } = await import("@/lib/observatory/job-registry");

    const testJob = Object.keys(JOB_REGISTRY)[0];
    const entry = JOB_REGISTRY[testJob]!;
    entry.jobDisabledUntil = null;

    const result = await toggleJobKillSwitch({
      job: testJob,
      action: "disable",
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe("disable");
    expect(result.disabledUntil).toBeGreaterThan(Date.now());
    expect(entry.jobDisabledUntil).toBeGreaterThan(Date.now());
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "kill_switch_triggered" }),
    );

    entry.jobDisabledUntil = null;
  });

  it("re-enables a job and logs activity", async () => {
    const { logActivity } = await import("@/lib/activity-log");
    const { toggleJobKillSwitch } = await import(
      "@/lib/observatory/kill-switch-toggle"
    );
    const { JOB_REGISTRY } = await import("@/lib/observatory/job-registry");

    const testJob = Object.keys(JOB_REGISTRY)[0];
    const entry = JOB_REGISTRY[testJob]!;
    entry.jobDisabledUntil = Date.now() + 86400_000;

    const result = await toggleJobKillSwitch({
      job: testJob,
      action: "enable",
    });

    expect(result.success).toBe(true);
    expect(result.disabledUntil).toBeNull();
    expect(entry.jobDisabledUntil).toBeNull();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "kill_switch_released" }),
    );
  });

  it("throws for unknown job", async () => {
    const { toggleJobKillSwitch } = await import(
      "@/lib/observatory/kill-switch-toggle"
    );

    await expect(
      toggleJobKillSwitch({ job: "nonexistent-job-xyz", action: "disable" }),
    ).rejects.toThrow("Unknown job");
  });

  it("stamps anomaly row with kill_switch_triggered_at_ms on disable", async () => {
    const { toggleJobKillSwitch } = await import(
      "@/lib/observatory/kill-switch-toggle"
    );
    const { JOB_REGISTRY } = await import("@/lib/observatory/job-registry");

    const testJob = Object.keys(JOB_REGISTRY)[0];
    const now = Date.now();

    testDb.insert(cost_anomalies).values({
      id: "ks-anomaly",
      detector: "hard_threshold",
      job: testJob,
      tier: "severe",
      first_fired_at_ms: now,
      last_fired_at_ms: now,
      fire_count: 1,
      observed_value: 500,
      expected_band: { daily_ceiling_aud: 15 },
    }).run();

    JOB_REGISTRY[testJob]!.jobDisabledUntil = null;

    await toggleJobKillSwitch({
      job: testJob,
      action: "disable",
      anomalyId: "ks-anomaly",
    });

    const row = testDb
      .select({ ks: cost_anomalies.kill_switch_triggered_at_ms })
      .from(cost_anomalies)
      .where(require("drizzle-orm").eq(cost_anomalies.id, "ks-anomaly"))
      .get();

    expect(row?.ks).toBeGreaterThan(0);

    JOB_REGISTRY[testJob]!.jobDisabledUntil = null;
  });
});

// ── maybeSendSevereAlert (enqueue helper) ──────────────────────────

describe("COB-9: maybeSendSevereAlert", () => {
  it("sends email for severe anomaly", async () => {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const now = Date.now();

    testDb.insert(cost_anomalies).values({
      id: "severe-for-email",
      detector: "hard_threshold",
      job: "outreach-writer",
      tier: "severe",
      first_fired_at_ms: now,
      last_fired_at_ms: now,
      fire_count: 1,
      observed_value: 500,
      expected_band: { daily_ceiling_aud: 15 },
    }).run();

    const { maybeSendSevereAlert } = await import(
      "@/lib/observatory/enqueue-severe-alert"
    );
    await maybeSendSevereAlert("severe-for-email");

    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("does not send email for non-severe anomaly", async () => {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const now = Date.now();

    testDb.insert(cost_anomalies).values({
      id: "low-no-email",
      detector: "learned_band",
      job: "test-job",
      tier: "low",
      first_fired_at_ms: now,
      last_fired_at_ms: now,
      fire_count: 1,
      observed_value: 12,
      expected_band: { daily_ceiling_aud: 6 },
    }).run();

    const { maybeSendSevereAlert } = await import(
      "@/lib/observatory/enqueue-severe-alert"
    );
    await maybeSendSevereAlert("low-no-email");

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does nothing for missing anomaly", async () => {
    const { sendEmail } = await import("@/lib/channels/email/send");

    const { maybeSendSevereAlert } = await import(
      "@/lib/observatory/enqueue-severe-alert"
    );
    await maybeSendSevereAlert("nonexistent-id");

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
