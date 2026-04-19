"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { six_week_plan_task_progress } from "@/lib/db/schema/six-week-plan-task-progress";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { getPortalSession } from "@/lib/portal/guard";
import settingsRegistry from "@/lib/settings";
import type { WeeksOutput } from "@/lib/ai/prompts/six-week-plan/weeks";

async function requirePortalAuth() {
  const session = await getPortalSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export async function activatePlanAction(
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requirePortalAuth();

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });

  if (!plan) return { ok: false, error: "Plan not found." };
  if (!["approved", "released"].includes(plan.status)) {
    return { ok: false, error: "Plan is not ready for activation." };
  }
  if (plan.activated_at_ms) {
    return { ok: false, error: "Plan is already activated." };
  }

  const now = Date.now();

  const weeksData = plan.weeks_json as unknown as WeeksOutput | null;
  const taskRows: Array<{
    id: string;
    plan_id: string;
    week_number: number;
    task_index: number;
    completed_at_ms: null;
  }> = [];

  if (weeksData?.weeks) {
    for (const week of weeksData.weeks) {
      for (let i = 0; i < week.tasks.length; i++) {
        taskRows.push({
          id: randomUUID(),
          plan_id: planId,
          week_number: week.week_number,
          task_index: i,
          completed_at_ms: null,
        });
      }
    }
  }

  await db
    .update(six_week_plans)
    .set({
      activated_at_ms: now,
      activation_path: "self_run",
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  if (taskRows.length > 0) {
    await db.insert(six_week_plan_task_progress).values(taskRows);
  }

  await logActivity({
    dealId: plan.deal_id,
    contactId: session.contactId,
    kind: "six_week_plan_self_activated",
    body: "Prospect activated their six-week plan.",
    meta: { plan_id: planId },
  });

  revalidatePath(`/lite/portal`);
  return { ok: true };
}

export async function toggleTaskAction(
  planId: string,
  weekNumber: number,
  taskIndex: number,
): Promise<{ ok: boolean; completedAtMs: number | null }> {
  await requirePortalAuth();

  const [existing] = await db
    .select()
    .from(six_week_plan_task_progress)
    .where(
      and(
        eq(six_week_plan_task_progress.plan_id, planId),
        eq(six_week_plan_task_progress.week_number, weekNumber),
        eq(six_week_plan_task_progress.task_index, taskIndex),
      ),
    )
    .limit(1);

  if (!existing) {
    return { ok: false, completedAtMs: null };
  }

  const newValue = existing.completed_at_ms ? null : Date.now();

  await db
    .update(six_week_plan_task_progress)
    .set({ completed_at_ms: newValue })
    .where(eq(six_week_plan_task_progress.id, existing.id));

  return { ok: true, completedAtMs: newValue };
}

export async function submitRevisionAction(
  planId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requirePortalAuth();
  const minChars = await settingsRegistry.get("plan.revision_note_min_chars");

  if (note.trim().length < minChars) {
    return { ok: false, error: `Please write at least ${minChars} characters.` };
  }

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });

  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.revision_requested_at_ms) {
    return { ok: false, error: "A revision has already been requested." };
  }

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      revision_requested_at_ms: now,
      revision_note: note.trim(),
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId: plan.deal_id,
    contactId: session.contactId,
    kind: "six_week_plan_revision_requested",
    body: "Prospect requested a plan revision.",
    meta: { plan_id: planId, note_preview: note.trim().slice(0, 100) },
  });

  await enqueueTask({
    task_type: "plan_revision_review_queue",
    runAt: Date.now(),
    payload: {
      plan_id: planId,
      deal_id: plan.deal_id,
      note_preview: note.trim().slice(0, 120),
    },
    idempotencyKey: `plan_revision_queue:${planId}`,
  }).catch(() => {});

  revalidatePath(`/lite/portal`);
  return { ok: true };
}

export async function dismissRevisionReplyAction(
  planId: string,
): Promise<{ ok: boolean }> {
  await requirePortalAuth();

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      revision_reply_dismissed_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  revalidatePath(`/lite/portal`);
  return { ok: true };
}
