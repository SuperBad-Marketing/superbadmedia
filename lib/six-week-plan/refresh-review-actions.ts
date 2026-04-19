"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { active_strategies } from "@/lib/db/schema/active-strategies";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { auth } from "@/lib/auth/session";
import type { WeekPlan } from "@/lib/ai/prompts/six-week-plan/weeks";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function approveRefreshReview(
  activeStrategyId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const strategy = await db.query.active_strategies.findFirst({
    where: eq(active_strategies.id, activeStrategyId),
  });
  if (!strategy) return { ok: false, error: "Active strategy not found." };
  if (strategy.status !== "pending_refresh_review") {
    return { ok: false, error: "Strategy is not pending refresh review." };
  }

  const now = Date.now();

  await db
    .update(active_strategies)
    .set({
      status: "live",
      pending_refresh_review: false,
      reviewed_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(active_strategies.id, activeStrategyId));

  if (strategy.source_id) {
    await db
      .update(six_week_plans)
      .set({ refresh_reviewed_at_ms: now, updated_at_ms: now })
      .where(eq(six_week_plans.id, strategy.source_id));
  }

  await logActivity({
    companyId: strategy.client_id,
    kind: "six_week_plan_live_strategy_set",
    body: "Active strategy approved as-is and set live.",
    meta: { active_strategy_id: activeStrategyId },
  });

  await logActivity({
    companyId: strategy.client_id,
    kind: "active_strategy_reviewed",
    body: "Active strategy refresh-review completed.",
    meta: { active_strategy_id: activeStrategyId, action: "approve" },
  });

  await maybeFireRetroactiveWeek1(strategy.source_id, strategy.client_id, now);

  revalidatePath(`/lite/admin/clients/${strategy.client_id}/strategy/refresh-review`);
  return { ok: true };
}

export async function regenerateForRetainer(
  activeStrategyId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const strategy = await db.query.active_strategies.findFirst({
    where: eq(active_strategies.id, activeStrategyId),
  });
  if (!strategy) return { ok: false, error: "Active strategy not found." };
  if (!strategy.source_id) {
    return { ok: false, error: "No source plan to regenerate from." };
  }

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, strategy.source_id),
  });
  if (!plan) return { ok: false, error: "Source plan not found." };

  const now = Date.now();

  await enqueueTask({
    task_type: "six_week_plan_generate",
    runAt: now,
    payload: {
      plan_id: plan.id,
      deal_id: plan.deal_id,
      regen_note: `[Retainer refresh-review regen] ${note}`,
    },
    idempotencyKey: `swp_retainer_regen:${plan.id}:${now}`,
  });

  await logActivity({
    companyId: strategy.client_id,
    kind: "active_strategy_updated",
    body: "Active strategy regeneration requested for retainer scope.",
    meta: { active_strategy_id: activeStrategyId, note },
  });

  revalidatePath(`/lite/admin/clients/${strategy.client_id}/strategy/refresh-review`);
  return { ok: true };
}

export async function saveHandEditedStrategy(
  activeStrategyId: string,
  editedWeeks: WeekPlan[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const strategy = await db.query.active_strategies.findFirst({
    where: eq(active_strategies.id, activeStrategyId),
  });
  if (!strategy) return { ok: false, error: "Active strategy not found." };

  const now = Date.now();
  const currentPayload = strategy.payload_json as Record<string, unknown>;

  await db
    .update(active_strategies)
    .set({
      status: "live",
      pending_refresh_review: false,
      reviewed_at_ms: now,
      updated_at_ms: now,
      payload_json: { ...currentPayload, weeks_json: editedWeeks },
    })
    .where(eq(active_strategies.id, activeStrategyId));

  if (strategy.source_id) {
    await db
      .update(six_week_plans)
      .set({ refresh_reviewed_at_ms: now, updated_at_ms: now })
      .where(eq(six_week_plans.id, strategy.source_id));
  }

  await logActivity({
    companyId: strategy.client_id,
    kind: "six_week_plan_live_strategy_set",
    body: "Active strategy hand-edited and set live.",
    meta: { active_strategy_id: activeStrategyId, action: "hand_edit" },
  });

  await logActivity({
    companyId: strategy.client_id,
    kind: "active_strategy_reviewed",
    body: "Active strategy refresh-review completed via hand-edit.",
    meta: { active_strategy_id: activeStrategyId, action: "hand_edit" },
  });

  await maybeFireRetroactiveWeek1(strategy.source_id, strategy.client_id, now);

  revalidatePath(`/lite/admin/clients/${strategy.client_id}/strategy/refresh-review`);
  return { ok: true };
}

async function maybeFireRetroactiveWeek1(
  sourceId: string | null,
  companyId: string,
  nowMs: number,
): Promise<void> {
  if (!sourceId) return;

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, sourceId),
  });
  if (!plan?.retainer_payment_received_at_ms) return;

  await db
    .update(six_week_plans)
    .set({
      activated_at_ms: nowMs,
      activation_path: "retainer_payment",
      updated_at_ms: nowMs,
    })
    .where(eq(six_week_plans.id, sourceId));

  await logActivity({
    companyId,
    dealId: plan.deal_id,
    kind: "six_week_plan_retainer_week_1_activated",
    body: "Week 1 activated retroactively after refresh-review publish.",
    meta: {
      plan_id: sourceId,
      trigger: "refresh_review_publish",
      payment_received_at: plan.retainer_payment_received_at_ms,
    },
  });
}
