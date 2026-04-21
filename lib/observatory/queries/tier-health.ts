import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { deals } from "@/lib/db/schema/deals";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { companies } from "@/lib/db/schema/companies";
import { sql, eq, gte, and, inArray } from "drizzle-orm";

export interface TierHealthCard {
  tier_id: string;
  tier_name: string;
  tier_rank: number;
  subscriber_count: number;
  monthly_revenue_aud: number;
  total_cost_aud: number;
  avg_margin_per_subscriber: number;
  percent_underwater: number;
  health: "green" | "amber" | "red";
  subscribers: TierSubscriberRow[];
}

export interface TierSubscriberRow {
  deal_id: string;
  company_name: string;
  company_id: string;
  monthly_revenue_aud: number;
  total_cost_aud: number;
  margin_aud: number;
  top_jobs: Array<{ job: string; cost_aud: number }>;
}

export async function getTierHealth(): Promise<TierHealthCard[]> {
  const now = new Date();
  const monthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const tiers = await db.select().from(saas_tiers).all();
  if (tiers.length === 0) return [];

  const activeDeals = await db
    .select({
      deal_id: deals.id,
      company_id: deals.company_id,
      saas_tier_id: deals.saas_tier_id,
      monthly_price: saas_tiers.monthly_price_cents_inc_gst,
    })
    .from(deals)
    .innerJoin(saas_tiers, eq(deals.saas_tier_id, saas_tiers.id))
    .where(
      and(
        eq(deals.stage, "won"),
        eq(deals.won_outcome, "saas"),
        inArray(deals.subscription_state, ["active_current", "past_due"]),
      ),
    )
    .all();

  if (activeDeals.length === 0) {
    return tiers.map((t) => ({
      tier_id: t.id,
      tier_name: t.name,
      tier_rank: t.tier_rank,
      subscriber_count: 0,
      monthly_revenue_aud: 0,
      total_cost_aud: 0,
      avg_margin_per_subscriber: 0,
      percent_underwater: 0,
      health: "green" as const,
      subscribers: [],
    }));
  }

  const companyIds = [...new Set(activeDeals.map((d) => d.company_id))];
  const companyRows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(inArray(companies.id, companyIds))
    .all();
  const companyMap = new Map(companyRows.map((c) => [c.id, c.name]));

  const costRows = await db
    .select({
      actor_id: external_call_log.actor_id,
      job: external_call_log.job,
      total_cost: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
    })
    .from(external_call_log)
    .where(
      and(
        eq(external_call_log.actor_type, "external"),
        gte(external_call_log.created_at_ms, monthStartMs),
      ),
    )
    .groupBy(external_call_log.actor_id, external_call_log.job)
    .all();

  const costByActor = new Map<string, Map<string, number>>();
  for (const row of costRows) {
    if (!row.actor_id) continue;
    if (!costByActor.has(row.actor_id)) {
      costByActor.set(row.actor_id, new Map());
    }
    costByActor.get(row.actor_id)!.set(row.job, row.total_cost ?? 0);
  }

  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const cards = new Map<string, TierHealthCard>();

  for (const tier of tiers) {
    cards.set(tier.id, {
      tier_id: tier.id,
      tier_name: tier.name,
      tier_rank: tier.tier_rank,
      subscriber_count: 0,
      monthly_revenue_aud: 0,
      total_cost_aud: 0,
      avg_margin_per_subscriber: 0,
      percent_underwater: 0,
      health: "green",
      subscribers: [],
    });
  }

  for (const deal of activeDeals) {
    if (!deal.saas_tier_id) continue;
    const card = cards.get(deal.saas_tier_id);
    if (!card) continue;

    const revenueAud = (deal.monthly_price ?? 0) / 100;
    const actorCosts = costByActor.get(deal.company_id);
    const totalCost = actorCosts
      ? Array.from(actorCosts.values()).reduce((s, v) => s + v, 0)
      : 0;

    const topJobs = actorCosts
      ? Array.from(actorCosts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([job, cost_aud]) => ({ job, cost_aud }))
      : [];

    const subscriber: TierSubscriberRow = {
      deal_id: deal.deal_id,
      company_id: deal.company_id,
      company_name: companyMap.get(deal.company_id) ?? "Unknown",
      monthly_revenue_aud: revenueAud,
      total_cost_aud: totalCost,
      margin_aud: revenueAud - totalCost,
      top_jobs: topJobs,
    };

    card.subscriber_count++;
    card.monthly_revenue_aud += revenueAud;
    card.total_cost_aud += totalCost;
    card.subscribers.push(subscriber);
  }

  for (const card of cards.values()) {
    card.subscribers.sort((a, b) => a.margin_aud - b.margin_aud);

    if (card.subscriber_count > 0) {
      card.avg_margin_per_subscriber =
        (card.monthly_revenue_aud - card.total_cost_aud) / card.subscriber_count;

      const underwater = card.subscribers.filter((s) => s.margin_aud < 0).length;
      card.percent_underwater = Math.round(
        (underwater / card.subscriber_count) * 100,
      );
    }

    if (card.percent_underwater >= 30) {
      card.health = "red";
    } else if (card.percent_underwater >= 10) {
      card.health = "amber";
    }
  }

  return Array.from(cards.values()).sort((a, b) => a.tier_rank - b.tier_rank);
}
