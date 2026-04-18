import "server-only";
import { db } from "@/lib/db";
import { leadRuns } from "@/lib/db/schema/lead-runs";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { desc, gte, sql, and, eq } from "drizzle-orm";
import { enforceWarmupCap } from "../warmup";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface FunnelData {
  found: number;
  qualified: number;
  dncFiltered: number;
  drafted: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

export async function getFunnelMetrics(): Promise<FunnelData> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const runs = await db
    .select({
      found: sql<number>`coalesce(sum(${leadRuns.found_count}), 0)`,
      dncFiltered: sql<number>`coalesce(sum(${leadRuns.dnc_filtered_count}), 0)`,
      qualified: sql<number>`coalesce(sum(${leadRuns.qualified_count}), 0)`,
      drafted: sql<number>`coalesce(sum(${leadRuns.drafted_count}), 0)`,
    })
    .from(leadRuns)
    .where(gte(leadRuns.run_started_at, cutoff));

  const sendStats = await db
    .select({
      sent: sql<number>`count(*)`,
      opened: sql<number>`coalesce(sum(case when ${outreachSends.first_opened_at} is not null then 1 else 0 end), 0)`,
      clicked: sql<number>`coalesce(sum(case when ${outreachSends.first_clicked_at} is not null then 1 else 0 end), 0)`,
      replied: sql<number>`coalesce(sum(case when ${outreachSends.replied_at} is not null then 1 else 0 end), 0)`,
    })
    .from(outreachSends)
    .where(gte(outreachSends.sent_at, cutoff));

  const r = runs[0] ?? { found: 0, dncFiltered: 0, qualified: 0, drafted: 0 };
  const s = sendStats[0] ?? { sent: 0, opened: 0, clicked: 0, replied: 0 };

  return {
    found: Number(r.found),
    qualified: Number(r.qualified),
    dncFiltered: Number(r.dncFiltered),
    drafted: Number(r.drafted),
    sent: Number(s.sent),
    opened: Number(s.opened),
    clicked: Number(s.clicked),
    replied: Number(s.replied),
  };
}

export interface ApprovalSparklinePoint {
  date: string;
  rate: number;
}

export async function getApprovalRateSparkline(
  track: "saas" | "retainer",
): Promise<ApprovalSparklinePoint[]> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const drafts = await db
    .select({
      id: outreachDrafts.id,
      candidateId: outreachDrafts.candidate_id,
      approvalKind: outreachDrafts.approval_kind,
      status: outreachDrafts.status,
      createdAt: outreachDrafts.created_at,
    })
    .from(outreachDrafts)
    .where(gte(outreachDrafts.created_at, cutoff))
    .orderBy(desc(outreachDrafts.created_at));

  const candidateIds = drafts
    .map((d) => d.candidateId)
    .filter((id): id is string => id != null);

  const candidates =
    candidateIds.length > 0
      ? await db
          .select({ id: leadCandidates.id, track: leadCandidates.qualified_track })
          .from(leadCandidates)
          .where(sql`${leadCandidates.id} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

  const trackMap = new Map(candidates.map((c) => [c.id, c.track]));

  const filtered = drafts.filter(
    (d) =>
      d.candidateId &&
      trackMap.get(d.candidateId) === track &&
      (d.status === "sent" || d.status === "rejected"),
  );

  const byDay = new Map<string, { clean: number; total: number }>();

  for (const d of filtered) {
    const day = d.createdAt
      ? new Date(d.createdAt as unknown as number).toISOString().slice(0, 10)
      : null;
    if (!day) continue;
    const entry = byDay.get(day) ?? { clean: 0, total: 0 };
    entry.total++;
    if (d.approvalKind === "manual") entry.clean++;
    byDay.set(day, entry);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { clean, total }]) => ({
      date,
      rate: total > 0 ? Math.round((clean / total) * 100) : 0,
    }));
}

export interface WarmupProgress {
  cap: number;
  used: number;
  remaining: number;
  currentWeek: number;
  isGraduated: boolean;
  daysUntilNextRamp: number | null;
}

export async function getWarmupProgress(): Promise<WarmupProgress> {
  const state = await enforceWarmupCap();
  return {
    cap: state.cap,
    used: state.used,
    remaining: state.remaining,
    currentWeek: state.current_week,
    isGraduated: state.is_graduated,
    daysUntilNextRamp: state.days_until_next_ramp,
  };
}
