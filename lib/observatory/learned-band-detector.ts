import { and, eq, gte, sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import type { CostAnomalyTier } from "@/lib/db/schema/cost-anomalies";
import { getJobBands, isJobRegistered, REGISTERED_JOB_KEYS } from "./job-registry";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_14D = 14 * 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MIN_CALLS_WARMUP = 50;
const DETECTOR = "learned_band" as const;

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(idx, 0)];
}

function assignTier(observed: number, threshold: number): CostAnomalyTier {
  const ratio = observed / threshold;
  if (ratio >= 5) return "mid";
  return "low";
}

// ---------------------------------------------------------------------------
// Dedupe: upsert into cost_anomalies (scoped per {detector, job})
// ---------------------------------------------------------------------------

interface UpsertLearnedAnomalyInput {
  job: string;
  tier: CostAnomalyTier;
  observedValue: number;
  expectedBand: Record<string, unknown>;
  dbArg?: typeof defaultDb;
}

async function upsertLearnedAnomaly(input: UpsertLearnedAnomalyInput): Promise<{
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
    body: `Learned-band breach on "${input.job}": $${input.observedValue.toFixed(2)} per call vs $${(input.expectedBand.p95 as number).toFixed(2)} p95 band (tier: ${input.tier}).`,
    meta: {
      detector: DETECTOR,
      job: input.job,
      tier: input.tier,
      observed: input.observedValue,
      expected_band: input.expectedBand,
    },
  });

  return { created: true, anomalyId: id };
}

// ---------------------------------------------------------------------------
// Main sweep — runs every 15 minutes via scheduled tasks
// ---------------------------------------------------------------------------

export async function sweepLearnedBandDetector(
  dbArg?: typeof defaultDb,
): Promise<{ breaches: number }> {
  if (!killSwitches.observatory_detectors_enabled) {
    return { breaches: 0 };
  }

  const d = dbArg ?? defaultDb;
  const now = Date.now();
  const trailingStart = now - MS_14D;
  const warmupCutoff = now - MS_7D;

  let breaches = 0;

  for (const jobKey of REGISTERED_JOB_KEYS) {
    if (!isJobRegistered(jobKey)) continue;

    const bands = getJobBands(jobKey);
    if (!bands) continue;

    const multiplier = bands.learned_band_multiplier;
    if (multiplier <= 0) continue;

    const trailingCalls = await d
      .select({
        estimated_cost_aud: external_call_log.estimated_cost_aud,
        created_at_ms: external_call_log.created_at_ms,
      })
      .from(external_call_log)
      .where(
        and(
          eq(external_call_log.job, jobKey),
          gte(external_call_log.created_at_ms, trailingStart),
        ),
      );

    if (trailingCalls.length < MIN_CALLS_WARMUP) continue;

    const hasOldEnough = trailingCalls.some((c) => c.created_at_ms <= warmupCutoff);
    if (!hasOldEnough) continue;

    const costs = trailingCalls.map((c) => c.estimated_cost_aud);
    const p95 = percentile95(costs);
    if (p95 <= 0) continue;

    const threshold = p95 * multiplier;

    const recentWindow = now - 15 * 60 * 1000;
    const recentCalls = trailingCalls.filter((c) => c.created_at_ms >= recentWindow);

    for (const call of recentCalls) {
      if (call.estimated_cost_aud <= threshold) continue;

      const tier = assignTier(call.estimated_cost_aud, threshold);
      await upsertLearnedAnomaly({
        job: jobKey,
        tier,
        observedValue: call.estimated_cost_aud,
        expectedBand: {
          check: "learned_band",
          p95,
          multiplier,
          threshold,
          trailing_days: 14,
          total_calls: trailingCalls.length,
        },
        dbArg: d,
      });

      breaches++;
      break;
    }
  }

  return { breaches };
}
