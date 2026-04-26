import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_accounts,
  instagram_content_plans,
  instagram_strategy_reports,
  instagram_audience_snapshots,
  type ContentPlanSlot,
} from "@/lib/db/schema/instagram";
import { logActivity } from "@/lib/activity-log";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getWeekBounds(refDate: Date): {
  start: string;
  end: string;
} {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon + 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function assignDates(
  count: number,
  weekStart: string,
  _onlineHours?: unknown,
): { date: string; day: string }[] {
  const base = new Date(weekStart + "T00:00:00");
  const preferredOffsets = [1, 2, 3, 4, 0];
  const result: { date: string; day: string }[] = [];

  for (let i = 0; i < count; i++) {
    const offset = preferredOffsets[i % preferredOffsets.length];
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    result.push({
      date: d.toISOString().slice(0, 10),
      day: DAY_NAMES[d.getDay()],
    });
  }

  return result;
}

export async function generateWeeklyPlans(): Promise<number> {
  const activeAccounts = await db
    .select()
    .from(instagram_accounts)
    .where(eq(instagram_accounts.status, "active"));

  if (activeAccounts.length === 0) return 0;

  const { start: weekStart, end: weekEnd } = getWeekBounds(new Date());
  let plansCreated = 0;

  for (const account of activeAccounts) {
    const existing = await db
      .select({ id: instagram_content_plans.id })
      .from(instagram_content_plans)
      .where(
        and(
          eq(instagram_content_plans.account_id, account.id),
          eq(instagram_content_plans.week_start_date, weekStart),
        ),
      )
      .get();

    if (existing) continue;

    const latestDigest = await db
      .select()
      .from(instagram_strategy_reports)
      .where(
        and(
          eq(instagram_strategy_reports.account_id, account.id),
          eq(instagram_strategy_reports.report_type, "weekly_digest"),
        ),
      )
      .orderBy(desc(instagram_strategy_reports.generated_at_ms))
      .limit(1)
      .get();

    const audienceSnapshot = await db
      .select()
      .from(instagram_audience_snapshots)
      .where(eq(instagram_audience_snapshots.account_id, account.id))
      .orderBy(desc(instagram_audience_snapshots.snapshot_date))
      .limit(1)
      .get();

    const contentIdeas = (latestDigest?.content_ideas_json ?? []) as Array<{
      content_type?: string;
      topic?: string;
      brief?: string;
      template_suggestion?: string;
    }>;

    const slotCount = Math.min(Math.max(contentIdeas.length, 3), 5);
    const dates = assignDates(
      slotCount,
      weekStart,
      audienceSnapshot?.online_hours_json,
    );

    const CONTENT_TYPES = ["carousel", "single", "reel", "story"] as const;

    const slots: ContentPlanSlot[] = [];
    for (let i = 0; i < slotCount; i++) {
      const idea = contentIdeas[i];
      const contentType =
        idea?.content_type &&
        CONTENT_TYPES.includes(idea.content_type as (typeof CONTENT_TYPES)[number])
          ? (idea.content_type as ContentPlanSlot["content_type"])
          : CONTENT_TYPES[i % 2];

      slots.push({
        index: i,
        suggested_date: dates[i].date,
        day_of_week: dates[i].day,
        content_type: contentType,
        topic: idea?.topic ?? `Content idea ${i + 1} for @${account.username}`,
        caption_direction:
          idea?.brief ??
          "Write in SuperBad's dry, observational voice. Let the visual do most of the work.",
        approved: false,
        task_id: null,
      });
    }

    const themeSummary =
      latestDigest?.summary_text?.split(".")[0] ??
      `Weekly content plan for @${account.username}`;

    const now = Date.now();
    await db.insert(instagram_content_plans).values({
      id: randomUUID(),
      account_id: account.id,
      strategy_report_id: latestDigest?.id ?? null,
      week_start_date: weekStart,
      week_end_date: weekEnd,
      theme_summary: themeSummary,
      slots_json: slots,
      status: "awaiting_review",
      nudge_sent: false,
      created_at_ms: now,
      updated_at_ms: now,
    });

    await logActivity({
      kind: "instagram_plan_generated",
      companyId: account.company_id ?? undefined,
      body: `Instagram content plan generated for @${account.username} (${weekStart} – ${weekEnd}).`,
      meta: {
        account_id: account.id,
        username: account.username,
        slot_count: slotCount,
        week_start: weekStart,
      },
    });

    plansCreated++;
  }

  return plansCreated;
}

export async function expireOldPlans(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const stale = await db
    .select({ id: instagram_content_plans.id, account_id: instagram_content_plans.account_id })
    .from(instagram_content_plans)
    .where(eq(instagram_content_plans.status, "awaiting_review"));

  let expired = 0;
  const now = Date.now();

  for (const plan of stale) {
    const row = await db
      .select({ week_end_date: instagram_content_plans.week_end_date })
      .from(instagram_content_plans)
      .where(eq(instagram_content_plans.id, plan.id))
      .get();

    if (row && row.week_end_date < cutoff) {
      await db
        .update(instagram_content_plans)
        .set({ status: "expired", updated_at_ms: now })
        .where(eq(instagram_content_plans.id, plan.id));

      await logActivity({
        kind: "instagram_plan_expired",
        body: `Instagram content plan expired (past week end + 7 days).`,
        meta: { plan_id: plan.id, account_id: plan.account_id },
      });

      expired++;
    }
  }

  return expired;
}
