import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import type { CostAnomalyTier } from "@/lib/db/schema/cost-anomalies";
import { getJobBands, isJobRegistered } from "./job-registry";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_1H = 60 * 60 * 1000;
const MS_5MIN = 5 * 60 * 1000;
const DEFAULT_WINDOW_MIN = 5;
const RATE_MULTIPLIER = 10;
const MIN_CALLS = 20;
const DETECTOR = "rate" as const;

function actorIdCondition(actorId: string | null) {
  return actorId
    ? eq(external_call_log.actor_id, actorId)
    : sql`${external_call_log.actor_id} IS NULL`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ---------------------------------------------------------------------------
// Dedupe: upsert into cost_anomalies (scoped per {detector, job, actor_scope})
// ---------------------------------------------------------------------------

interface UpsertRateAnomalyInput {
  job: string;
  actorScope: { actor_type: string; actor_id: string } | null;
  observedValue: number;
  expectedBand: Record<string, unknown>;
  dbArg?: typeof defaultDb;
}

async function upsertRateAnomaly(input: UpsertRateAnomalyInput): Promise<{
  created: boolean;
  anomalyId: string;
}> {
  const d = input.dbArg ?? defaultDb;
  const now = Date.now();
  const windowStart = now - MS_24H;
  const tier: CostAnomalyTier = "severe";

  const actorScopeStr = input.actorScope
    ? JSON.stringify(input.actorScope)
    : null;

  const existing = await d
    .select({ id: cost_anomalies.id, fire_count: cost_anomalies.fire_count })
    .from(cost_anomalies)
    .where(
      and(
        eq(cost_anomalies.detector, DETECTOR),
        eq(cost_anomalies.job, input.job),
        actorScopeStr
          ? sql`${cost_anomalies.actor_scope} = ${actorScopeStr}`
          : sql`${cost_anomalies.actor_scope} IS NULL`,
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
        tier,
      })
      .where(eq(cost_anomalies.id, row.id));
    return { created: false, anomalyId: row.id };
  }

  const id = crypto.randomUUID();
  await d.insert(cost_anomalies).values({
    id,
    detector: DETECTOR,
    job: input.job,
    actor_scope: input.actorScope,
    tier,
    first_fired_at_ms: now,
    last_fired_at_ms: now,
    fire_count: 1,
    observed_value: input.observedValue,
    expected_band: input.expectedBand,
  });

  const actorLabel = input.actorScope
    ? ` (actor: ${input.actorScope.actor_type}/${input.actorScope.actor_id})`
    : "";

  await logActivity({
    kind: "cost_anomaly_fired",
    body: `Rate anomaly on "${input.job}"${actorLabel}: ${input.observedValue} calls in window (tier: ${tier}).`,
    meta: {
      detector: DETECTOR,
      job: input.job,
      actor_scope: input.actorScope,
      tier,
      observed: input.observedValue,
      expected_band: input.expectedBand,
    },
  });

  return { created: true, anomalyId: id };
}

// ---------------------------------------------------------------------------
// Main sweep — runs every 1 minute via scheduled tasks
// ---------------------------------------------------------------------------

export async function sweepRateDetector(
  dbArg?: typeof defaultDb,
): Promise<{ breaches: number }> {
  if (!killSwitches.observatory_detectors_enabled) {
    return { breaches: 0 };
  }

  const d = dbArg ?? defaultDb;
  const now = Date.now();
  const defaultWindowMs = MS_5MIN;

  const recentPairs = await d
    .select({
      job: external_call_log.job,
      actor_id: external_call_log.actor_id,
      actor_type: external_call_log.actor_type,
      call_count: sql<number>`count(*)`,
    })
    .from(external_call_log)
    .where(gte(external_call_log.created_at_ms, now - defaultWindowMs))
    .groupBy(external_call_log.job, external_call_log.actor_id);

  let breaches = 0;

  for (const pair of recentPairs) {
    if (!isJobRegistered(pair.job)) continue;
    if (pair.call_count < MIN_CALLS) continue;

    const bands = getJobBands(pair.job);
    if (!bands) continue;

    const windowMin = bands.rate_override ?? DEFAULT_WINDOW_MIN;
    const windowMs = windowMin * 60 * 1000;

    let actualCount = pair.call_count;
    if (windowMin !== DEFAULT_WINDOW_MIN) {
      const recount = await d
        .select({ cnt: sql<number>`count(*)` })
        .from(external_call_log)
        .where(
          and(
            eq(external_call_log.job, pair.job),
            actorIdCondition(pair.actor_id),
            gte(external_call_log.created_at_ms, now - windowMs),
          ),
        );
      actualCount = recount[0]?.cnt ?? 0;
      if (actualCount < MIN_CALLS) continue;
    }

    const trailingStart = now - windowMs - MS_1H;
    const trailingEnd = now - windowMs;

    const trailingCalls = await d
      .select({ created_at_ms: external_call_log.created_at_ms })
      .from(external_call_log)
      .where(
        and(
          eq(external_call_log.job, pair.job),
          actorIdCondition(pair.actor_id),
          gte(external_call_log.created_at_ms, trailingStart),
          lt(external_call_log.created_at_ms, trailingEnd),
        ),
      );

    const bucketCount = Math.floor(MS_1H / windowMs);
    const buckets = new Array(bucketCount).fill(0);
    for (const call of trailingCalls) {
      const offset = call.created_at_ms - trailingStart;
      const bucketIdx = Math.min(
        Math.floor(offset / windowMs),
        bucketCount - 1,
      );
      buckets[bucketIdx]++;
    }

    const trailingMedian = median(buckets);

    if (actualCount <= trailingMedian * RATE_MULTIPLIER) continue;

    const actorScope = pair.actor_id
      ? { actor_type: pair.actor_type, actor_id: pair.actor_id }
      : null;

    await upsertRateAnomaly({
      job: pair.job,
      actorScope,
      observedValue: actualCount,
      expectedBand: {
        check: "rate",
        window_min: windowMin,
        trailing_hour_median: trailingMedian,
        multiplier: RATE_MULTIPLIER,
        min_calls: MIN_CALLS,
      },
      dbArg: d,
    });

    breaches++;
  }

  return { breaches };
}
