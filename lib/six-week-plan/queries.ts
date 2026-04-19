import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import type { StrategyOutput } from "@/lib/ai/prompts/six-week-plan/strategy";
import type { WeeksOutput } from "@/lib/ai/prompts/six-week-plan/weeks";

export interface PlanForReview {
  plan: {
    id: string;
    dealId: string;
    status: string;
    generationVersion: number;
    regenCount: number;
    selfReviewPassed: boolean | null;
    selfReviewIssues: string[] | null;
    strategyJson: StrategyOutput | null;
    weeksJson: WeeksOutput | null;
    strategyApprovedAtMs: number | null;
  };
  prospect: {
    name: string;
    businessName: string;
    dealTitle: string;
  };
}

export async function getPlanForReview(
  planId: string,
): Promise<PlanForReview | null> {
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return null;

  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, plan.deal_id),
  });
  if (!deal) return null;

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, deal.company_id),
  });

  const contact = deal.primary_contact_id
    ? await db.query.contacts.findFirst({
        where: eq(contacts.id, deal.primary_contact_id),
      })
    : null;

  return {
    plan: {
      id: plan.id,
      dealId: plan.deal_id,
      status: plan.status,
      generationVersion: plan.generation_version,
      regenCount: plan.regen_count,
      selfReviewPassed: plan.self_review_passed,
      selfReviewIssues: plan.self_review_issues_json as string[] | null,
      strategyJson: plan.strategy_json as unknown as StrategyOutput | null,
      weeksJson: plan.weeks_json as unknown as WeeksOutput | null,
      strategyApprovedAtMs: plan.strategy_approved_at_ms,
    },
    prospect: {
      name: contact?.name ?? "Unknown",
      businessName: company?.name ?? deal.title,
      dealTitle: deal.title,
    },
  };
}
