/**
 * Hard-threshold detector — spec §3.2, detector (a).
 *
 * Two modes:
 *   1. **Sync on insert** — `checkPerCallThreshold()` fires on every
 *      `logExternalCall()`. Compares the single call's cost against the
 *      job's `per_call_ceiling_aud`.
 *   2. **5-min sweep** — `sweepDailyThresholds()` scans trailing-24h
 *      aggregate spend per job against each job's `daily_ceiling_aud`.
 *
 * Dedupe: per {detector, job} per 24h window. Subsequent fires update
 * the existing `cost_anomaly` row rather than creating a new one.
 *
 * Owner: COB-4 (Wave 21). Consumer: scheduled-tasks handler, logExternalCall.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import type { CostAnomalyTier } from "@/lib/db/schema/cost-anomalies";
import { getEffectiveBands, isJobRegistered } from "./job-registry";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueDiagnosis } from "./enqueue-diagnosis";
import { maybeSendSevereAlert } from "./enqueue-severe-alert";

const MS_24H = 24 * 60 * 60 * 1000;
const DETECTOR = "hard_threshold" as const;

// ---------------------------------------------------------------------------
// Tier assignment
// ---------------------------------------------------------------------------

function assignTier(observed: number, ceiling: number): CostAnomalyTier {
  const ratio = observed / ceiling;
  if (ratio >= 5) return "severe";
  if (ratio >= 2) return "mid";
  return "low";
}

// ---------------------------------------------------------------------------
// Dedupe: upsert into cost_anomalies
// ---------------------------------------------------------------------------

interface UpsertAnomalyInput {
  job: string;
  tier: CostAnomalyTier;
  observedValue: number;
  expectedBand: Record<string, unknown>;
  dbArg?: typeof defaultDb;
}

async function upsertAnomaly(input: UpsertAnomalyInput): Promise<{
  created: boolean;
  anomalyId: string;
}> {
  const d = input.dbArg ?? defaultDb;
  const now = Date.now();
  const windowStart = now - MS_24H;

  const existing = await d
    .select({ id: cost_anomalies.id, fire_count: cost_anomalies.fire_count })
    .from(cost_anomalies)
    .where(
      and(
        eq(cost_anomalies.detector, DETECTOR),
        eq(cost_anomalies.job, input.job),
        gte(cost_anomalies.first_fired_at_ms, windowStart),
        sql`${cost_anomalies.resolved_at_ms} IS NULL`,
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    await d
      .update(cost_anomalies)
      .set({
        last_fired_at_ms: now,
        fire_count: row.fire_count + 1,
        observed_value: input.observedValue,
        tier: input.tier,
      })
      .where(eq(cost_anomalies.id, row.id));
    return { created: false, anomalyId: row.id };
  }

  const id = crypto.randomUUID();
  await d.insert(cost_anomalies).values({
    id,
    detector: DETECTOR,
    job: input.job,
    tier: input.tier,
    first_fired_at_ms: now,
    last_fired_at_ms: now,
    fire_count: 1,
    observed_value: input.observedValue,
    expected_band: input.expectedBand,
  });

  await logActivity({
    kind: "cost_anomaly_fired",
    body: `Hard-threshold breach on "${input.job}": $${input.observedValue.toFixed(2)} (tier: ${input.tier}).`,
    meta: {
      detector: DETECTOR,
      job: input.job,
      tier: input.tier,
      observed: input.observedValue,
      expected_band: input.expectedBand,
    },
  });

  enqueueDiagnosis(id).catch(() => {});
  if (input.tier === "severe") {
    maybeSendSevereAlert(id).catch(() => {});
  }

  return { created: true, anomalyId: id };
}

// ---------------------------------------------------------------------------
// 1. Sync-on-insert: per-call ceiling check
// ---------------------------------------------------------------------------

export interface PerCallCheckInput {
  job: string;
  estimatedCostAud: number;
}

export async function checkPerCallThreshold(
  input: PerCallCheckInput,
  dbArg?: typeof defaultDb,
): Promise<{ breached: boolean; anomalyId?: string }> {
  if (!killSwitches.observatory_detectors_enabled) {
    return { breached: false };
  }

  if (!isJobRegistered(input.job)) {
    return { breached: false };
  }

  const bands = await getEffectiveBands(input.job);
  if (!bands || input.estimatedCostAud <= bands.per_call_ceiling_aud) {
    return { breached: false };
  }

  const tier = assignTier(input.estimatedCostAud, bands.per_call_ceiling_aud);
  const result = await upsertAnomaly({
    job: input.job,
    tier,
    observedValue: input.estimatedCostAud,
    expectedBand: {
      per_call_ceiling_aud: bands.per_call_ceiling_aud,
      check: "per_call",
    },
    dbArg,
  });

  return { breached: true, anomalyId: result.anomalyId };
}

// ---------------------------------------------------------------------------
// 2. 5-min sweep: daily ceiling check
// ---------------------------------------------------------------------------

export async function sweepDailyThresholds(
  dbArg?: typeof defaultDb,
): Promise<{ breaches: number }> {
  if (!killSwitches.observatory_detectors_enabled) {
    return { breaches: 0 };
  }

  const d = dbArg ?? defaultDb;
  const now = Date.now();
  const windowStart = now - MS_24H;

  const dailySpend = await d
    .select({
      job: external_call_log.job,
      total_aud: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
    })
    .from(external_call_log)
    .where(gte(external_call_log.created_at_ms, windowStart))
    .groupBy(external_call_log.job);

  let breaches = 0;

  for (const row of dailySpend) {
    if (!isJobRegistered(row.job)) continue;

    const bands = await getEffectiveBands(row.job);
    if (!bands || !row.total_aud || row.total_aud <= bands.daily_ceiling_aud) {
      continue;
    }

    const tier = assignTier(row.total_aud, bands.daily_ceiling_aud);
    await upsertAnomaly({
      job: row.job,
      tier,
      observedValue: row.total_aud,
      expectedBand: {
        daily_ceiling_aud: bands.daily_ceiling_aud,
        check: "daily",
      },
      dbArg: d,
    });

    breaches++;
  }

  return { breaches };
}
