import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import {
  cost_anomalies,
  type CostAnomalyRow,
} from "@/lib/db/schema/cost-anomalies";
import { sql, and, isNull, gte, desc, asc } from "drizzle-orm";
import { getJobEntry, REGISTERED_JOB_KEYS } from "../job-registry";

export interface MtdSummary {
  total_aud: number;
  daily_totals: Array<{ date: string; total: number }>;
  projection_aud: number;
  days_elapsed: number;
  days_in_month: number;
  thresholds: Array<number | null>;
}

export interface AnomalyListItem {
  id: string;
  detector: string;
  job: string;
  actor_scope: unknown;
  tier: string;
  first_fired_at_ms: number;
  last_fired_at_ms: number;
  fire_count: number;
  observed_value: number;
  expected_band: unknown;
  diagnosis_snippet: string | null;
  kill_switch_triggered_at_ms: number | null;
  acknowledged_at_ms: number | null;
  resolved_at_ms: number | null;
}

export interface TopJobRow {
  job: string;
  vendor: string;
  total_calls: number;
  total_aud: number;
  avg_aud_per_call: number;
}

export interface KillSwitchedJob {
  job: string;
  disabled_until: number;
}

export async function getMtdSummary(): Promise<MtdSummary> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthStartMs = monthStart.getTime();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const rows = await db
    .select({
      date_str: sql<string>`date(${external_call_log.created_at_ms} / 1000, 'unixepoch', '+10 hours')`,
      daily_total: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
    })
    .from(external_call_log)
    .where(gte(external_call_log.created_at_ms, monthStartMs))
    .groupBy(sql`date(${external_call_log.created_at_ms} / 1000, 'unixepoch', '+10 hours')`)
    .orderBy(asc(sql`date(${external_call_log.created_at_ms} / 1000, 'unixepoch', '+10 hours')`));

  const dailyTotals = rows.map((r) => ({
    date: r.date_str,
    total: r.daily_total ?? 0,
  }));

  const totalAud = dailyTotals.reduce((sum, d) => sum + d.total, 0);
  const projectionAud =
    dayOfMonth > 0 ? (totalAud / dayOfMonth) * daysInMonth : 0;

  const settingsRegistry = (await import("@/lib/settings")).default;
  const t1 = await settingsRegistry.get("observatory.monthly_threshold_1_aud");
  const t2 = await settingsRegistry.get("observatory.monthly_threshold_2_aud");
  const t3 = await settingsRegistry.get("observatory.monthly_threshold_3_aud");

  return {
    total_aud: totalAud,
    daily_totals: dailyTotals,
    projection_aud: projectionAud,
    days_elapsed: dayOfMonth,
    days_in_month: daysInMonth,
    thresholds: [
      t1 != null ? Number(t1) : null,
      t2 != null ? Number(t2) : null,
      t3 != null ? Number(t3) : null,
    ],
  };
}

export async function getActiveAnomalies(): Promise<AnomalyListItem[]> {
  const rows = await db
    .select()
    .from(cost_anomalies)
    .where(isNull(cost_anomalies.resolved_at_ms))
    .orderBy(
      desc(sql`CASE ${cost_anomalies.tier} WHEN 'severe' THEN 3 WHEN 'mid' THEN 2 WHEN 'low' THEN 1 ELSE 0 END`),
      desc(cost_anomalies.last_fired_at_ms),
    );

  return rows.map(toAnomalyListItem);
}

export async function getRecentResolvedAnomalies(): Promise<AnomalyListItem[]> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const rows = await db
    .select()
    .from(cost_anomalies)
    .where(
      and(
        gte(cost_anomalies.resolved_at_ms, sevenDaysAgo),
      ),
    )
    .orderBy(desc(cost_anomalies.resolved_at_ms))
    .limit(50);

  return rows.map(toAnomalyListItem);
}

function extractDiagnosisSnippet(diagnosis: unknown): string | null {
  if (!diagnosis || typeof diagnosis !== "object") return null;
  const d = diagnosis as Record<string, unknown>;
  if (typeof d.hypothesis !== "string") return null;
  const words = d.hypothesis.split(/\s+/).slice(0, 15).join(" ");
  return words.length < d.hypothesis.length ? words + "…" : words;
}

function toAnomalyListItem(row: CostAnomalyRow): AnomalyListItem {
  return {
    id: row.id,
    detector: row.detector,
    job: row.job,
    actor_scope: row.actor_scope,
    tier: row.tier,
    first_fired_at_ms: row.first_fired_at_ms,
    last_fired_at_ms: row.last_fired_at_ms,
    fire_count: row.fire_count,
    observed_value: row.observed_value,
    expected_band: row.expected_band,
    diagnosis_snippet: extractDiagnosisSnippet(row.diagnosis_json),
    kill_switch_triggered_at_ms: row.kill_switch_triggered_at_ms ?? null,
    acknowledged_at_ms: row.acknowledged_at_ms ?? null,
    resolved_at_ms: row.resolved_at_ms ?? null,
  };
}

export async function getTopJobs(): Promise<TopJobRow[]> {
  const now = new Date();
  const monthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const rows = await db
    .select({
      job: external_call_log.job,
      total_calls: sql<number>`count(*)`,
      total_aud: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
      avg_aud: sql<number>`avg(${external_call_log.estimated_cost_aud})`,
    })
    .from(external_call_log)
    .where(gte(external_call_log.created_at_ms, monthStartMs))
    .groupBy(external_call_log.job)
    .orderBy(desc(sql`sum(${external_call_log.estimated_cost_aud})`));

  return rows.map((r) => {
    const entry = getJobEntry(r.job);
    return {
      job: r.job,
      vendor: entry?.vendor ?? "unknown",
      total_calls: r.total_calls,
      total_aud: r.total_aud ?? 0,
      avg_aud_per_call: r.avg_aud ?? 0,
    };
  });
}

export function getKillSwitchedJobs(): KillSwitchedJob[] {
  const now = Date.now();
  const result: KillSwitchedJob[] = [];
  for (const key of REGISTERED_JOB_KEYS) {
    const entry = getJobEntry(key);
    if (!entry) continue;
    const until = entry.jobDisabledUntil;
    if (until && until > now) {
      result.push({ job: key, disabled_until: until });
    }
  }
  return result;
}
