import "server-only";
import { randomUUID } from "node:crypto";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { active_strategies } from "@/lib/db/schema/active-strategies";
import { logActivity } from "@/lib/activity-log";
import type { StrategyOutput } from "@/lib/ai/prompts/six-week-plan/strategy";
import type { WeeksOutput } from "@/lib/ai/prompts/six-week-plan/weeks";

interface MigrateResult {
  ok: boolean;
  activeStrategyId?: string;
  error?: string;
}

export async function migratePlanOnWon(
  dealId: string,
  companyId: string,
): Promise<MigrateResult> {
  const plan = await db.query.six_week_plans.findFirst({
    where: and(
      eq(six_week_plans.deal_id, dealId),
      inArray(six_week_plans.status, ["approved", "released"]),
    ),
    orderBy: [desc(six_week_plans.generation_version)],
  });

  if (!plan) {
    return { ok: false, error: "No approved/released plan found for deal." };
  }

  if (plan.migrated_to_client_context_at_ms) {
    return { ok: false, error: "Plan already migrated." };
  }

  const weeksData = plan.weeks_json as unknown as WeeksOutput | null;
  const strategyData = plan.strategy_json as unknown as StrategyOutput | null;

  const payload = {
    intro: weeksData?.plan_intro ?? "",
    weeks_json: weeksData?.weeks ?? [],
    chosen_primitives: strategyData?.chosen_primitives ?? [],
    theme_arc: strategyData?.theme_arc ?? "",
  };

  const now = Date.now();
  const id = randomUUID();

  const existing = await db.query.active_strategies.findFirst({
    where: eq(active_strategies.client_id, companyId),
  });

  if (existing) {
    await db
      .update(active_strategies)
      .set({
        status: "archived",
        pending_refresh_review: false,
        updated_at_ms: now,
      })
      .where(eq(active_strategies.id, existing.id));
  }

  await db.insert(active_strategies).values({
    id,
    client_id: companyId,
    origin: "six_week_plan",
    source_id: plan.id,
    status: "pending_refresh_review",
    payload_json: payload,
    pending_refresh_review: true,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await db
    .update(six_week_plans)
    .set({
      migrated_to_client_context_at_ms: now,
      retainer_payment_received_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, plan.id));

  await logActivity({
    companyId,
    dealId,
    kind: "six_week_plan_migrated_to_client_context",
    body: "Approved plan migrated to active strategy for retainer kickoff.",
    meta: { plan_id: plan.id, active_strategy_id: id },
  });

  await logActivity({
    companyId,
    kind: "active_strategy_created",
    body: "Active strategy created from six-week plan.",
    meta: {
      active_strategy_id: id,
      origin: "six_week_plan",
      source_plan_id: plan.id,
    },
  });

  return { ok: true, activeStrategyId: id };
}
