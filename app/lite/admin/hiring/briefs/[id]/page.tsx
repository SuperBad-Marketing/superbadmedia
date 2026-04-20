import { redirect, notFound } from "next/navigation";
import { eq, and, sql, desc } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { role_briefs } from "@/lib/db/schema/role-briefs";
import { candidates } from "@/lib/db/schema/candidates";
import { candidate_archives } from "@/lib/db/schema/candidate-archives";
import { RoleBriefDetailClient, type RoleBriefDetail } from "@/components/lite/hiring-pipeline/role-brief-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const brief = await db.query.role_briefs.findFirst({
    where: eq(role_briefs.id, id),
  });
  return {
    title: brief ? `SuperBad — ${brief.role_name}` : "SuperBad — Role Brief",
    robots: { index: false, follow: false },
  };
}

export default async function RoleBriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const brief = await db.query.role_briefs.findFirst({
    where: eq(role_briefs.id, id),
  });

  if (!brief) notFound();

  // Bench members for this role
  const benchMembers = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      bench_status: candidates.bench_status,
      weekly_capacity_hours: candidates.weekly_capacity_hours,
      hourly_rate_aud: candidates.hourly_rate_aud,
    })
    .from(candidates)
    .where(
      and(eq(candidates.stage, "bench"), eq(candidates.role_brief_id, id)),
    )
    .all();

  // Archive patterns (top reason codes)
  const archivePatterns = await db
    .select({
      reason_code: candidate_archives.reason_code,
      count: sql<number>`count(*)`,
    })
    .from(candidate_archives)
    .innerJoin(candidates, eq(candidate_archives.candidate_id, candidates.id))
    .where(eq(candidates.role_brief_id, id))
    .groupBy(candidate_archives.reason_code)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  // Pipeline counts by stage
  const pipelineCounts = await db
    .select({
      stage: candidates.stage,
      count: sql<number>`count(*)`,
    })
    .from(candidates)
    .where(eq(candidates.role_brief_id, id))
    .groupBy(candidates.stage)
    .all();

  const detail: RoleBriefDetail = {
    id: brief.id,
    role_name: brief.role_name,
    status: brief.status,
    engagement_type: brief.engagement_type,
    rate_min_aud: brief.rate_min_aud,
    rate_max_aud: brief.rate_max_aud,
    rate_unit: brief.rate_unit,
    target_hours_per_week: brief.target_hours_per_week,
    location_pref_city: brief.location_pref_city,
    remote_ok: brief.remote_ok,
    open_count: brief.open_count,
    style_summary: brief.style_summary,
    extracted_tags: (brief.extracted_tags_json as string[]) ?? [],
    style_do_list: (brief.style_do_list_json as string[]) ?? [],
    style_avoid_list: (brief.style_avoid_list_json as string[]) ?? [],
    discovery_search_hints: (brief.discovery_search_hints_json as string[]) ?? [],
    andy_overrides: brief.andy_overrides,
    last_regenerated_at_ms: brief.last_regenerated_at_ms,
    last_discovery_run_at_ms: brief.last_discovery_run_at_ms,
    created_at_ms: brief.created_at_ms,
    bench_members: benchMembers.map((m) => ({
      id: m.id,
      name: m.name,
      bench_status: m.bench_status ?? "active",
      weekly_capacity_hours: m.weekly_capacity_hours ?? 0,
      hourly_rate_aud: m.hourly_rate_aud ?? 0,
    })),
    archive_patterns: archivePatterns.map((p) => ({
      reason_code: p.reason_code,
      count: p.count,
    })),
    pipeline_counts: Object.fromEntries(
      pipelineCounts.map((p) => [p.stage, p.count]),
    ),
  };

  return <RoleBriefDetailClient detail={detail} />;
}
