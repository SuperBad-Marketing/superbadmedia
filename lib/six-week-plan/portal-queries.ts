import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { six_week_plan_task_progress } from "@/lib/db/schema/six-week-plan-task-progress";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import type { WeeksOutput, WeekPlan } from "@/lib/ai/prompts/six-week-plan/weeks";

export interface PortalPlanData {
  plan: {
    id: string;
    status: string;
    generationVersion: number;
    planIntro: string;
    weeks: WeekPlan[];
    activatedAtMs: number | null;
    activationPath: string | null;
    revisionRequestedAtMs: number | null;
    revisionNote: string | null;
    revisionResolution: string | null;
    revisionReplySentAtMs: number | null;
    revisionReplyBody: string | null;
    revisionReplyDismissedAtMs: number | null;
    releasedAtMs: number | null;
    approvedAtMs: number | null;
    portalArchivedAtMs: number | null;
  };
  prospect: {
    businessName: string;
    contactName: string;
  };
  taskProgress: Array<{
    weekNumber: number;
    taskIndex: number;
    completedAtMs: number | null;
  }>;
}

export async function getPlanForPortal(
  contactId: string,
): Promise<PortalPlanData | null> {
  const [contact] = await db
    .select({ company_id: contacts.company_id, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact?.company_id) return null;

  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .limit(1);

  const deal = await db.query.deals.findFirst({
    where: and(
      eq(deals.company_id, contact.company_id),
      eq(deals.stage, "trial_shoot"),
    ),
  });

  if (!deal) {
    const wonDeal = await db.query.deals.findFirst({
      where: and(
        eq(deals.company_id, contact.company_id),
        eq(deals.stage, "won"),
      ),
    });
    if (!wonDeal) return null;

    return findPlanForDeal(wonDeal.id, contact.name, company?.name ?? "Your business");
  }

  return findPlanForDeal(deal.id, contact.name, company?.name ?? "Your business");
}

async function findPlanForDeal(
  dealId: string,
  contactName: string,
  businessName: string,
): Promise<PortalPlanData | null> {
  const plan = await db.query.six_week_plans.findFirst({
    where: and(
      eq(six_week_plans.deal_id, dealId),
      eq(six_week_plans.status, "approved"),
    ),
    orderBy: [desc(six_week_plans.generation_version)],
  });

  if (!plan) {
    const releasedPlan = await db.query.six_week_plans.findFirst({
      where: and(
        eq(six_week_plans.deal_id, dealId),
        eq(six_week_plans.status, "released"),
      ),
      orderBy: [desc(six_week_plans.generation_version)],
    });
    if (!releasedPlan) return null;
    return buildPortalPlanData(releasedPlan, contactName, businessName);
  }

  return buildPortalPlanData(plan, contactName, businessName);
}

async function buildPortalPlanData(
  plan: typeof six_week_plans.$inferSelect,
  contactName: string,
  businessName: string,
): Promise<PortalPlanData> {
  const weeksData = plan.weeks_json as unknown as WeeksOutput | null;

  const progress = await db
    .select({
      week_number: six_week_plan_task_progress.week_number,
      task_index: six_week_plan_task_progress.task_index,
      completed_at_ms: six_week_plan_task_progress.completed_at_ms,
    })
    .from(six_week_plan_task_progress)
    .where(eq(six_week_plan_task_progress.plan_id, plan.id));

  return {
    plan: {
      id: plan.id,
      status: plan.status,
      generationVersion: plan.generation_version,
      planIntro: weeksData?.plan_intro ?? "",
      weeks: weeksData?.weeks ?? [],
      activatedAtMs: plan.activated_at_ms,
      activationPath: plan.activation_path,
      revisionRequestedAtMs: plan.revision_requested_at_ms,
      revisionNote: plan.revision_note,
      revisionResolution: plan.revision_resolution,
      revisionReplySentAtMs: plan.revision_reply_sent_at_ms,
      revisionReplyBody: plan.revision_reply_body,
      revisionReplyDismissedAtMs: plan.revision_reply_dismissed_at_ms,
      releasedAtMs: plan.released_at_ms,
      approvedAtMs: plan.approved_at_ms,
      portalArchivedAtMs: plan.portal_archived_at_ms,
    },
    prospect: {
      businessName,
      contactName,
    },
    taskProgress: progress.map((p) => ({
      weekNumber: p.week_number,
      taskIndex: p.task_index,
      completedAtMs: p.completed_at_ms,
    })),
  };
}
