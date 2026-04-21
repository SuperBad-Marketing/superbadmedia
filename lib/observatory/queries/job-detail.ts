import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { sql, eq, desc, gte, and } from "drizzle-orm";
import { getJobEntry, type JobRegistryEntry } from "../job-registry";

export interface JobCallRow {
  id: string;
  actor_type: string;
  actor_id: string | null;
  units: unknown;
  estimated_cost_aud: number;
  prompt_version_hash: string | null;
  created_at_ms: number;
}

export interface JobDailySummary {
  date: string;
  call_count: number;
  total_aud: number;
}

export interface PromptVersionEntry {
  hash: string;
  first_seen_ms: number;
  last_seen_ms: number;
  call_count: number;
  total_cost_aud: number;
}

export interface JobDetail {
  job: string;
  registry: JobRegistryEntry | null;
  calls: JobCallRow[];
  call_count_total: number;
  daily_summary: JobDailySummary[];
  prompt_versions: PromptVersionEntry[];
}

export async function getJobDetail(
  jobKey: string,
  page: number = 0,
  pageSize: number = 100,
): Promise<JobDetail> {
  const registry = getJobEntry(jobKey) ?? null;

  const now = new Date();
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const [calls, countResult, dailySummary, promptVersions] = await Promise.all([
    db
      .select({
        id: external_call_log.id,
        actor_type: external_call_log.actor_type,
        actor_id: external_call_log.actor_id,
        units: external_call_log.units,
        estimated_cost_aud: external_call_log.estimated_cost_aud,
        prompt_version_hash: external_call_log.prompt_version_hash,
        created_at_ms: external_call_log.created_at_ms,
      })
      .from(external_call_log)
      .where(eq(external_call_log.job, jobKey))
      .orderBy(desc(external_call_log.created_at_ms))
      .limit(pageSize)
      .offset(page * pageSize)
      .all(),

    db
      .select({ count: sql<number>`count(*)` })
      .from(external_call_log)
      .where(eq(external_call_log.job, jobKey))
      .get(),

    db
      .select({
        date_str: sql<string>`date(${external_call_log.created_at_ms} / 1000, 'unixepoch', '+10 hours')`,
        call_count: sql<number>`count(*)`,
        total_aud: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
      })
      .from(external_call_log)
      .where(
        and(
          eq(external_call_log.job, jobKey),
          gte(external_call_log.created_at_ms, thirtyDaysAgo),
        ),
      )
      .groupBy(
        sql`date(${external_call_log.created_at_ms} / 1000, 'unixepoch', '+10 hours')`,
      )
      .orderBy(
        sql`date(${external_call_log.created_at_ms} / 1000, 'unixepoch', '+10 hours')`,
      )
      .all(),

    db
      .select({
        hash: external_call_log.prompt_version_hash,
        first_seen: sql<number>`min(${external_call_log.created_at_ms})`,
        last_seen: sql<number>`max(${external_call_log.created_at_ms})`,
        call_count: sql<number>`count(*)`,
        total_cost: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
      })
      .from(external_call_log)
      .where(
        and(
          eq(external_call_log.job, jobKey),
          sql`${external_call_log.prompt_version_hash} IS NOT NULL`,
        ),
      )
      .groupBy(external_call_log.prompt_version_hash)
      .orderBy(desc(sql`max(${external_call_log.created_at_ms})`))
      .all(),
  ]);

  return {
    job: jobKey,
    registry,
    calls: calls.map((c) => ({
      id: c.id,
      actor_type: c.actor_type,
      actor_id: c.actor_id ?? null,
      units: c.units,
      estimated_cost_aud: c.estimated_cost_aud,
      prompt_version_hash: c.prompt_version_hash ?? null,
      created_at_ms: c.created_at_ms,
    })),
    call_count_total: countResult?.count ?? 0,
    daily_summary: dailySummary.map((d) => ({
      date: d.date_str,
      call_count: d.call_count,
      total_aud: d.total_aud ?? 0,
    })),
    prompt_versions: promptVersions
      .filter(
        (p): p is typeof p & { hash: string } => p.hash != null,
      )
      .map((p) => ({
        hash: p.hash,
        first_seen_ms: p.first_seen,
        last_seen_ms: p.last_seen,
        call_count: p.call_count,
        total_cost_aud: p.total_cost ?? 0,
      })),
  };
}
