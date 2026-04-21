import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { cost_anomalies, type CostAnomalyRow } from "@/lib/db/schema/cost-anomalies";
import { eq, and, desc } from "drizzle-orm";

export interface AnomalyDetail {
  anomaly: CostAnomalyRow;
  recent_calls: RecentCall[];
}

export interface RecentCall {
  id: string;
  job: string;
  actor_type: string;
  actor_id: string | null;
  units: unknown;
  estimated_cost_aud: number;
  prompt_version_hash: string | null;
  created_at_ms: number;
}

export async function getAnomalyDetail(
  anomalyId: string,
): Promise<AnomalyDetail | null> {
  const rows = await db
    .select()
    .from(cost_anomalies)
    .where(eq(cost_anomalies.id, anomalyId))
    .limit(1);

  const anomaly = rows[0];
  if (!anomaly) return null;

  const scope = anomaly.actor_scope as { actor_type?: string; actor_id?: string } | null;

  const conditions = [eq(external_call_log.job, anomaly.job)];
  if (scope?.actor_id) {
    conditions.push(eq(external_call_log.actor_id, scope.actor_id));
  }

  const calls = await db
    .select()
    .from(external_call_log)
    .where(and(...conditions))
    .orderBy(desc(external_call_log.created_at_ms))
    .limit(100);

  return {
    anomaly,
    recent_calls: calls.map((c) => ({
      id: c.id,
      job: c.job,
      actor_type: c.actor_type,
      actor_id: c.actor_id,
      units: c.units,
      estimated_cost_aud: c.estimated_cost_aud,
      prompt_version_hash: c.prompt_version_hash,
      created_at_ms: c.created_at_ms,
    })),
  };
}
