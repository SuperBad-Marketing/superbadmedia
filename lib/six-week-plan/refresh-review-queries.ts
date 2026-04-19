import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { active_strategies } from "@/lib/db/schema/active-strategies";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import type { StrategyOutput } from "@/lib/ai/prompts/six-week-plan/strategy";
import type { WeeksOutput, WeekPlan } from "@/lib/ai/prompts/six-week-plan/weeks";

export interface RefreshReviewData {
  activeStrategy: {
    id: string;
    status: string;
    sourceId: string | null;
    payload: {
      intro: string;
      weeks_json: WeekPlan[];
      chosen_primitives: string[];
      theme_arc: string;
    };
    pendingRefreshReview: boolean;
    reviewedAtMs: number | null;
  };
  sourcePlan: {
    id: string;
    generationVersion: number;
    strategyJson: StrategyOutput | null;
    weeksJson: WeeksOutput | null;
    dealId: string;
  } | null;
  client: {
    companyId: string;
    companyName: string;
    contactName: string;
    dealId: string;
    dealTitle: string;
    wonOutcome: string | null;
  };
}

export async function getRefreshReviewData(
  companyId: string,
): Promise<RefreshReviewData | null> {
  const strategy = await db.query.active_strategies.findFirst({
    where: eq(active_strategies.client_id, companyId),
  });

  if (!strategy) return null;

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });
  if (!company) return null;

  const deal = await db.query.deals.findFirst({
    where: eq(deals.company_id, companyId),
  });
  if (!deal) return null;

  const contact = deal.primary_contact_id
    ? await db.query.contacts.findFirst({
        where: eq(contacts.id, deal.primary_contact_id),
      })
    : null;

  let sourcePlan: RefreshReviewData["sourcePlan"] = null;
  if (strategy.source_id) {
    const plan = await db.query.six_week_plans.findFirst({
      where: eq(six_week_plans.id, strategy.source_id),
    });
    if (plan) {
      sourcePlan = {
        id: plan.id,
        generationVersion: plan.generation_version,
        strategyJson: plan.strategy_json as unknown as StrategyOutput | null,
        weeksJson: plan.weeks_json as unknown as WeeksOutput | null,
        dealId: plan.deal_id,
      };
    }
  }

  const payload = strategy.payload_json as RefreshReviewData["activeStrategy"]["payload"];

  return {
    activeStrategy: {
      id: strategy.id,
      status: strategy.status,
      sourceId: strategy.source_id,
      payload: payload ?? { intro: "", weeks_json: [], chosen_primitives: [], theme_arc: "" },
      pendingRefreshReview: strategy.pending_refresh_review,
      reviewedAtMs: strategy.reviewed_at_ms,
    },
    sourcePlan,
    client: {
      companyId,
      companyName: company.name,
      contactName: contact?.name ?? "Unknown",
      dealId: deal.id,
      dealTitle: deal.title,
      wonOutcome: deal.won_outcome,
    },
  };
}
