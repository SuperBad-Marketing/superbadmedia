"use server";

import { randomUUID } from "node:crypto";
import { eq, and, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { generateWeeksFromStrategy } from "./generate";
import settingsRegistry from "@/lib/settings";
import { auth } from "@/lib/auth/session";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function approveStrategy(planId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireAdmin();
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "pending_strategy_review") {
    return { ok: false, error: `Cannot approve strategy in status: ${plan.status}` };
  }

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      strategy_approved_at_ms: now,
      reviewed_by: userId,
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId: plan.deal_id,
    kind: "six_week_plan_strategy_approved",
    body: "Strategy outline approved. Generating weekly detail.",
    meta: { plan_id: planId },
  });

  const result = await generateWeeksFromStrategy(planId, plan.deal_id);
  if (!result.ok) {
    return { ok: false, error: result.reason };
  }

  revalidatePath(`/lite/six-week-plans/${planId}/review`);
  return { ok: true };
}

export async function regenStrategy(
  planId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };

  const regenWarning = await checkRegenWarning(planId);
  const now = Date.now();

  await db
    .update(six_week_plans)
    .set({
      regen_count: (plan.regen_count ?? 0) + 1,
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId: plan.deal_id,
    kind: "six_week_plan_strategy_regenerated",
    body: "Strategy outline regenerated with note.",
    meta: { plan_id: planId, note, regen_warning: regenWarning },
  });

  await enqueueTask({
    task_type: "six_week_plan_generate",
    runAt: Date.now(),
    payload: { plan_id: planId, deal_id: plan.deal_id, regen_note: note },
    idempotencyKey: `swp_regen:${planId}:${now}`,
  });

  revalidatePath(`/lite/six-week-plans/${planId}/review`);
  return { ok: true };
}

export async function pausePlan(planId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };

  revalidatePath(`/lite/six-week-plans/${planId}/review`);
  return { ok: true };
}

export async function approveDetail(planId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireAdmin();
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "pending_detail_review") {
    return { ok: false, error: `Cannot approve detail in status: ${plan.status}` };
  }

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      status: "approved",
      approved_at_ms: now,
      reviewed_by: userId,
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId: plan.deal_id,
    kind: "six_week_plan_approved",
    body: "Six-week plan approved and ready for release.",
    meta: { plan_id: planId },
  });

  revalidatePath(`/lite/six-week-plans/${planId}/review`);
  return { ok: true };
}

export async function regenWeeks(
  planId: string,
  note: string,
  weekNumbers?: number[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      regen_count: (plan.regen_count ?? 0) + 1,
      status: "generating",
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  const result = await generateWeeksFromStrategy(
    planId,
    plan.deal_id,
    note,
    weekNumbers?.length ? weekNumbers : null,
  );

  if (!result.ok) {
    return { ok: false, error: result.reason };
  }

  revalidatePath(`/lite/six-week-plans/${planId}/review`);
  return { ok: true };
}

export async function rejectToStrategy(planId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      status: "pending_strategy_review",
      weeks_json: null,
      weeks_generated_at_ms: null,
      self_review_passed: null,
      self_review_issues_json: null,
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  revalidatePath(`/lite/six-week-plans/${planId}/review`);
  return { ok: true };
}

async function checkRegenWarning(planId: string): Promise<boolean> {
  const threshold = await settingsRegistry.get("plan.regen_soft_warning_threshold");
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  return (plan?.regen_count ?? 0) >= threshold;
}

export async function getRegenWarningStatus(planId: string): Promise<boolean> {
  return checkRegenWarning(planId);
}
