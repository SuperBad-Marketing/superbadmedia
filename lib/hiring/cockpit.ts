import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { trial_tasks } from "@/lib/db/schema/trial-tasks";
import { role_briefs } from "@/lib/db/schema/role-briefs";
import { invite_drafts } from "@/lib/db/schema/invite-drafts";
import { and, eq, lte, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import settings from "@/lib/settings";
import type { WaitingItem, HealthBanner } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;

// ── Waiting items (Daily Cockpit §5 attention rail) ──────────────────────────

export async function getHiringWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const oneDayAgo = nowMs - MS_PER_DAY;

  // 1. candidate_application_unreviewed — Applied > 24h without review
  const unreviewedApplicants = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.stage, "applied"),
        lte(candidates.updated_at_ms, oneDayAgo),
      ),
    )
    .all();

  for (const c of unreviewedApplicants) {
    const daysWaiting = Math.floor((nowMs - c.updated_at_ms) / MS_PER_DAY);
    items.push({
      id: `candidate_application_unreviewed_${c.id}`,
      label: `${c.name} applied — ${daysWaiting}d waiting`,
      href: `/lite/hiring?candidate=${c.id}`,
      urgency: { kind: "age_of_wait", value: c.updated_at_ms },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  // 2. candidate_followup_reply_received — Applied + replied, awaiting screen
  const repliedCandidates = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.stage, "applied"),
        eq(candidates.followup_status, "replied"),
      ),
    )
    .all();

  for (const c of repliedCandidates) {
    items.push({
      id: `candidate_followup_reply_${c.id}`,
      label: `${c.name} replied to followup — awaiting screen`,
      href: `/lite/hiring?candidate=${c.id}`,
      urgency: { kind: "age_of_wait", value: c.updated_at_ms },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  // 3. trial_task_delivered_unreviewed — delivered but no andy_review_notes
  const deliveredUnreviewed = await db
    .select({ trial_tasks, candidates })
    .from(trial_tasks)
    .innerJoin(candidates, eq(trial_tasks.candidate_id, candidates.id))
    .where(
      and(
        isNotNull(trial_tasks.delivered_at_ms),
        isNull(trial_tasks.andy_review_notes),
        eq(trial_tasks.disposition, "pending"),
      ),
    )
    .all();

  for (const row of deliveredUnreviewed) {
    items.push({
      id: `trial_delivered_unreviewed_${row.trial_tasks.id}`,
      label: `${row.candidates.name} trial delivered`,
      href: `/lite/hiring?candidate=${row.candidates.id}`,
      urgency: { kind: "age_of_wait", value: row.trial_tasks.delivered_at_ms! },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  // 4. trial_task_overdue — pending + past due_at_ms
  const overdueTasks = await db
    .select({ trial_tasks, candidates })
    .from(trial_tasks)
    .innerJoin(candidates, eq(trial_tasks.candidate_id, candidates.id))
    .where(
      and(
        eq(trial_tasks.disposition, "pending"),
        isNull(trial_tasks.delivered_at_ms),
        lte(trial_tasks.due_at_ms, nowMs),
      ),
    )
    .all();

  for (const row of overdueTasks) {
    const daysOverdue = Math.floor(
      (nowMs - row.trial_tasks.due_at_ms) / MS_PER_DAY,
    );
    items.push({
      id: `trial_task_overdue_${row.trial_tasks.id}`,
      label: `${row.candidates.name}'s trial overdue — ${daysOverdue}d`,
      href: `/lite/hiring?candidate=${row.candidates.id}`,
      urgency: { kind: "time_sensitive", value: row.trial_tasks.due_at_ms },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  // 5. draft_invites_awaiting — pending_review drafts
  const pendingDrafts = await db
    .select({ count: sql<number>`count(*)` })
    .from(invite_drafts)
    .where(eq(invite_drafts.status, "pending_review"))
    .get();

  const draftCount = pendingDrafts?.count ?? 0;
  if (draftCount > 0) {
    items.push({
      id: "draft_invites_awaiting",
      label: `${draftCount} invite draft${draftCount === 1 ? "" : "s"} awaiting review`,
      href: "/lite/hiring?tab=invites",
      urgency: { kind: "age_of_wait", value: nowMs - MS_PER_DAY },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  // 6. bench_pause_ending_soon — paused_until ≤ 2d away
  const pauseWarnDays = await settings.get("hiring.bench.pause_ending_warn_days");
  const pauseThreshold = nowMs + (pauseWarnDays ?? 2) * MS_PER_DAY;

  const pauseEndingSoon = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.stage, "bench"),
        eq(candidates.bench_status, "paused"),
        isNotNull(candidates.paused_until_ms),
        lte(candidates.paused_until_ms, pauseThreshold),
      ),
    )
    .all();

  for (const c of pauseEndingSoon) {
    items.push({
      id: `bench_pause_ending_${c.id}`,
      label: `${c.name} pause ending soon`,
      href: `/lite/hiring?candidate=${c.id}`,
      urgency: { kind: "time_sensitive", value: c.paused_until_ms! },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  // 7. role_brief_discovery_stale — open roles with last_discovery_run_at > 10d ago
  const tenDaysAgo = nowMs - 10 * MS_PER_DAY;
  const staleRoles = await db
    .select()
    .from(role_briefs)
    .where(
      and(
        eq(role_briefs.status, "open"),
        lte(role_briefs.last_discovery_run_at_ms, tenDaysAgo),
      ),
    )
    .all();

  for (const rb of staleRoles) {
    items.push({
      id: `role_brief_discovery_stale_${rb.id}`,
      label: `${rb.role_name} — discovery stale`,
      href: `/lite/hiring?brief=${rb.id}`,
      urgency: { kind: "age_of_wait", value: rb.last_discovery_run_at_ms! },
      scope: "own",
      source: "hiring-pipeline",
    });
  }

  return items;
}

// ── Health banners (Daily Cockpit §6 banner strip) ───────────────────────────

export async function getHiringHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const banners: HealthBanner[] = [];

  // 1. hiring_trial_task_overdue — any trial past due_at + grace
  const graceDays = await settings.get("hiring.trial.delivery_grace_days");
  const graceMs = (graceDays ?? 2) * MS_PER_DAY;
  const overdueThreshold = nowMs - graceMs;

  const overdueTrials = await db
    .select({ count: sql<number>`count(*)` })
    .from(trial_tasks)
    .where(
      and(
        eq(trial_tasks.disposition, "pending"),
        isNull(trial_tasks.delivered_at_ms),
        lte(trial_tasks.due_at_ms, overdueThreshold),
      ),
    )
    .get();

  const overdueCount = overdueTrials?.count ?? 0;
  if (overdueCount > 0) {
    banners.push({
      id: "hiring_trial_task_overdue",
      severity: overdueCount >= 3 ? "critical" : "warning",
      summary: `${overdueCount} trial task${overdueCount === 1 ? "" : "s"} overdue past grace period`,
      href: "/lite/hiring?tab=trials&filter=overdue",
      source: "hiring-pipeline",
    });
  }

  // 2. hiring_bench_empty_for_open_role — open Role Brief with 0 active bench for > 21d
  const twentyOneDaysAgo = nowMs - 21 * MS_PER_DAY;
  const openRoles = await db
    .select()
    .from(role_briefs)
    .where(
      and(
        eq(role_briefs.status, "open"),
        lte(role_briefs.created_at_ms, twentyOneDaysAgo),
      ),
    )
    .all();

  for (const rb of openRoles) {
    const benchCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(candidates)
      .where(
        and(
          eq(candidates.stage, "bench"),
          eq(candidates.bench_status, "active"),
          eq(candidates.role_brief_id, rb.id),
        ),
      )
      .get();

    if ((benchCount?.count ?? 0) === 0) {
      banners.push({
        id: `hiring_bench_empty_${rb.id}`,
        severity: "warning",
        summary: `${rb.role_name} — no active bench members (open > 21d)`,
        href: `/lite/hiring?brief=${rb.id}`,
        source: "hiring-pipeline",
      });
    }
  }

  // 3. hiring_discovery_cost_anomaly — weekly spend > threshold
  const weeklyThreshold = await settings.get(
    "hiring.discovery.weekly_cost_warn_threshold_aud",
  );
  if (weeklyThreshold != null) {
    const sevenDaysAgo = nowMs - 7 * MS_PER_DAY;
    const { external_call_log } = await import(
      "@/lib/db/schema/external-call-log"
    );

    const weeklySpend = await db
      .select({ total: sql<number>`coalesce(sum(estimated_cost_aud), 0)` })
      .from(external_call_log)
      .where(
        and(
          sql`${external_call_log.job} LIKE 'hiring_discovery%'`,
          sql`${external_call_log.created_at_ms} >= ${sevenDaysAgo}`,
        ),
      )
      .get();

    if ((weeklySpend?.total ?? 0) > weeklyThreshold) {
      banners.push({
        id: "hiring_discovery_cost_anomaly",
        severity: "critical",
        summary: `Hiring discovery weekly spend ($${(weeklySpend?.total ?? 0).toFixed(2)}) exceeds threshold ($${weeklyThreshold.toFixed(2)})`,
        href: "/lite/hiring?tab=discovery",
        source: "hiring-pipeline",
      });
    }
  }

  return banners;
}
