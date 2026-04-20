import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals, type DealStage } from "@/lib/db/schema/deals";
import settings from "@/lib/settings";
import type { FinanceProjection } from "@/lib/db/schema/finance-snapshots";

const STAGE_PROBABILITIES: Record<DealStage, number> = {
  lead: 0.05,
  contacted: 0.1,
  conversation: 0.2,
  trial_shoot: 0.4,
  quoted: 0.6,
  negotiating: 0.75,
  won: 1.0,
  lost: 0,
};

const STAGE_EXPECTED_DWELL_DAYS: Record<DealStage, number> = {
  lead: 14,
  contacted: 7,
  conversation: 14,
  trial_shoot: 21,
  quoted: 14,
  negotiating: 10,
  won: 0,
  lost: 0,
};

const MS_PER_DAY = 86_400_000;

interface ContractedDeal {
  value_cents: number | null;
  billing_cadence: string | null;
  committed_until_date_ms: number | null;
  won_outcome: string | null;
}

interface PipelineDeal {
  stage: DealStage;
  value_cents: number | null;
  last_stage_change_at_ms: number;
}

export async function computeProjection(
  nowMs: number,
): Promise<FinanceProjection> {
  const horizonDays = await settings.get("finance.projection_horizon_days");
  const decayHalflifeDays = await settings.get(
    "finance.stage_age_decay_halflife_days",
  );

  const contracted = await getContractedRevenue(nowMs);
  const pipeline = await getPipelineDeals();

  const dates: string[] = [];
  for (let d = 0; d < horizonDays; d++) {
    const ms = nowMs + d * MS_PER_DAY;
    dates.push(msToDateStr(ms));
  }

  const contractedCurve = buildContractedCurve(contracted, dates, nowMs);
  const pipelineCurve = buildPipelineCurve(pipeline, dates, nowMs, 0);
  const decayCurve = buildPipelineCurve(
    pipeline,
    dates,
    nowMs,
    decayHalflifeDays,
  );

  return {
    contracted_curve: contractedCurve,
    pipeline_weighted_curve: pipelineCurve,
    decay_adjusted_curve: decayCurve,
  };
}

async function getContractedRevenue(nowMs: number): Promise<ContractedDeal[]> {
  const rows = await db
    .select({
      value_cents: deals.value_cents,
      billing_cadence: deals.billing_cadence,
      committed_until_date_ms: deals.committed_until_date_ms,
      won_outcome: deals.won_outcome,
    })
    .from(deals)
    .where(
      and(
        eq(deals.stage, "won"),
        inArray(deals.subscription_state, [
          "active_current",
          "past_due",
          "paused",
        ]),
      ),
    );

  return rows.filter((r) => r.value_cents != null && r.value_cents > 0);
}

async function getPipelineDeals(): Promise<PipelineDeal[]> {
  const rows = await db
    .select({
      stage: deals.stage,
      value_cents: deals.value_cents,
      last_stage_change_at_ms: deals.last_stage_change_at_ms,
    })
    .from(deals)
    .where(
      and(
        ne(deals.stage, "won"),
        ne(deals.stage, "lost"),
        sql`${deals.value_cents} > 0`,
      ),
    );

  return rows.filter((r) => r.value_cents != null && r.value_cents > 0);
}

function buildContractedCurve(
  contracted: ContractedDeal[],
  dates: string[],
  nowMs: number,
): Array<{ date: string; cents: number }> {
  return dates.map((date) => {
    const dateMs = dateStrToMs(date);
    let total = 0;
    for (const deal of contracted) {
      const vc = deal.value_cents ?? 0;
      if (vc <= 0) continue;
      if (
        deal.committed_until_date_ms &&
        dateMs > deal.committed_until_date_ms
      ) {
        if (deal.billing_cadence === "monthly") {
          total += monthlyFromDealValue(vc, deal.billing_cadence);
        }
        continue;
      }
      total += monthlyFromDealValue(vc, deal.billing_cadence);
    }
    return { date, cents: Math.round(total / 30) };
  });
}

function buildPipelineCurve(
  pipeline: PipelineDeal[],
  dates: string[],
  nowMs: number,
  decayHalflifeDays: number,
): Array<{ date: string; cents: number }> {
  return dates.map((date) => {
    const dateMs = dateStrToMs(date);
    let total = 0;
    for (const deal of pipeline) {
      const baseProbability = STAGE_PROBABILITIES[deal.stage] ?? 0;
      if (baseProbability === 0) continue;

      let probability = baseProbability;
      if (decayHalflifeDays > 0) {
        const expectedDwell = STAGE_EXPECTED_DWELL_DAYS[deal.stage] ?? 14;
        const daysInStage =
          (nowMs - deal.last_stage_change_at_ms) / MS_PER_DAY;
        const overdueDays = Math.max(0, daysInStage - expectedDwell);
        if (overdueDays > 0) {
          probability *= Math.pow(0.5, overdueDays / decayHalflifeDays);
        }
      }

      const dailyValue = monthlyFromDealValue(deal.value_cents ?? 0, null) / 30;
      total += dailyValue * probability;
    }
    return { date, cents: Math.round(total) };
  });
}

function monthlyFromDealValue(
  valueCents: number,
  cadence: string | null,
): number {
  switch (cadence) {
    case "annual_upfront":
      return valueCents / 12;
    case "annual_monthly":
      return valueCents / 12;
    default:
      return valueCents;
  }
}

function msToDateStr(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function dateStrToMs(date: string): number {
  return new Date(date + "T00:00:00Z").getTime();
}

export {
  STAGE_PROBABILITIES,
  STAGE_EXPECTED_DWELL_DAYS,
  msToDateStr,
  dateStrToMs,
};
