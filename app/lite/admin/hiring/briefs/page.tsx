import { redirect } from "next/navigation";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { role_briefs } from "@/lib/db/schema/role-briefs";
import { candidates } from "@/lib/db/schema/candidates";
import { RoleBriefsClient, type RoleBriefListRow } from "@/components/lite/hiring-pipeline/role-briefs-client";

export const metadata: Metadata = {
  title: "SuperBad — Role Briefs",
  robots: { index: false, follow: false },
};

export default async function RoleBriefsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const allBriefs = await db.select().from(role_briefs).orderBy(
    sql`CASE ${role_briefs.status}
      WHEN 'open' THEN 0
      WHEN 'draft' THEN 1
      WHEN 'paused' THEN 2
      WHEN 'filled' THEN 3
    END`,
    role_briefs.updated_at_ms,
  ).all();

  const briefIds = allBriefs.map((b) => b.id);

  const benchCounts = briefIds.length > 0
    ? await db
        .select({
          role_brief_id: candidates.role_brief_id,
          active_count: sql<number>`sum(CASE WHEN ${candidates.bench_status} = 'active' THEN 1 ELSE 0 END)`,
          total_count: sql<number>`count(*)`,
        })
        .from(candidates)
        .where(
          and(
            eq(candidates.stage, "bench"),
            inArray(candidates.role_brief_id, briefIds),
          ),
        )
        .groupBy(candidates.role_brief_id)
        .all()
    : [];

  const benchMap = new Map(
    benchCounts.map((r) => [r.role_brief_id, { active: r.active_count, total: r.total_count }]),
  );

  const candidateCounts = briefIds.length > 0
    ? await db
        .select({
          role_brief_id: candidates.role_brief_id,
          count: sql<number>`count(*)`,
        })
        .from(candidates)
        .where(inArray(candidates.role_brief_id, briefIds))
        .groupBy(candidates.role_brief_id)
        .all()
    : [];

  const candidateMap = new Map(
    candidateCounts.map((r) => [r.role_brief_id, r.count]),
  );

  const rows: RoleBriefListRow[] = allBriefs.map((b) => ({
    id: b.id,
    role_name: b.role_name,
    status: b.status,
    engagement_type: b.engagement_type,
    rate_min_aud: b.rate_min_aud,
    rate_max_aud: b.rate_max_aud,
    rate_unit: b.rate_unit,
    target_hours_per_week: b.target_hours_per_week,
    location_pref_city: b.location_pref_city,
    remote_ok: b.remote_ok,
    bench_active: benchMap.get(b.id)?.active ?? 0,
    bench_total: benchMap.get(b.id)?.total ?? 0,
    candidate_count: candidateMap.get(b.id) ?? 0,
    last_discovery_run_at_ms: b.last_discovery_run_at_ms,
    last_regenerated_at_ms: b.last_regenerated_at_ms,
    created_at_ms: b.created_at_ms,
    updated_at_ms: b.updated_at_ms,
  }));

  return <RoleBriefsClient rows={rows} />;
}
