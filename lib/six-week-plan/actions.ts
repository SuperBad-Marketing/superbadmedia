"use server";

import { randomUUID } from "node:crypto";
import { eq, and, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { active_strategies } from "@/lib/db/schema/active-strategies";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { sendEmail } from "@/lib/channels/email/send";
import { generateWeeksFromStrategy } from "./generate";
import settingsRegistry from "@/lib/settings";
import { getAppUrl } from "@/lib/env/app-url";
import { auth } from "@/lib/auth/session";
import { issueMagicLink } from "@/lib/portal/issue-magic-link";

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

  const isRevisionRegen =
    !!plan.revision_requested_at_ms && !plan.revision_resolution;

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      status: "approved",
      approved_at_ms: now,
      reviewed_by: userId,
      updated_at_ms: now,
      ...(isRevisionRegen
        ? {
            revision_resolution: "regenerated" as const,
            revision_reply_sent_at_ms: now,
          }
        : {}),
    })
    .where(eq(six_week_plans.id, planId));

  await logActivity({
    dealId: plan.deal_id,
    kind: "six_week_plan_approved",
    body: "Six-week plan approved and ready for release.",
    meta: { plan_id: planId },
  });

  if (isRevisionRegen) {
    await logActivity({
      dealId: plan.deal_id,
      kind: "six_week_plan_revision_regenerated",
      body: "Plan revised after prospect's revision note.",
      meta: { plan_id: planId },
    });

    sendRevisionRegeneratedEmail(plan.deal_id, planId).catch(() => {});
  }

  await maybeSyncActiveStrategy(planId);

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

async function sendRevisionRegeneratedEmail(
  dealId: string,
  planId: string,
): Promise<void> {
  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, dealId),
  });
  if (!deal?.primary_contact_id) return;

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, deal.primary_contact_id),
  });
  if (!contact?.email) return;

  const planPath = "/lite/portal/plan";

  const { url: magicLinkUrl } = await issueMagicLink({
    contactId: contact.id,
    issuedFor: "six_week_plan_revision_regenerated",
  });

  const portalLink = `${magicLinkUrl}?callbackUrl=${encodeURIComponent(planPath)}`;

  await sendEmail({
    to: contact.email,
    subject: "Your plan's been updated",
    body: [
      "We took your note on board and reworked the plan.",
      "It's live on your portal now — worth a fresh read through from the top,",
      "not just the parts you flagged.",
      "",
      `Read updated plan: ${portalLink}`,
      "",
      "Andy",
      "SuperBad Marketing",
    ].join("\n"),
    classification: "six_week_plan_revision_regenerated",
    purpose: "Notify prospect their plan was revised after their revision note",
    replyTo: "andy@superbadmedia.com.au",
  });
}

async function maybeSyncActiveStrategy(planId: string): Promise<void> {
  const strategy = await db.query.active_strategies.findFirst({
    where: eq(active_strategies.source_id, planId),
  });
  if (!strategy || strategy.status !== "pending_refresh_review") return;

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return;

  const weeksData = plan.weeks_json as Record<string, unknown> | null;
  const strategyData = plan.strategy_json as Record<string, unknown> | null;

  const payload = {
    intro: (weeksData as { plan_intro?: string })?.plan_intro ?? "",
    weeks_json: (weeksData as { weeks?: unknown[] })?.weeks ?? [],
    chosen_primitives:
      (strategyData as { chosen_primitives?: unknown[] })?.chosen_primitives ??
      [],
    theme_arc: (strategyData as { theme_arc?: string })?.theme_arc ?? "",
  };

  const now = Date.now();
  await db
    .update(active_strategies)
    .set({ payload_json: payload, updated_at_ms: now })
    .where(eq(active_strategies.id, strategy.id));

  await logActivity({
    companyId: strategy.client_id,
    kind: "active_strategy_updated",
    body: "Active strategy payload synced after plan regeneration approval.",
    meta: {
      active_strategy_id: strategy.id,
      plan_id: planId,
      trigger: "post_regen_approval",
    },
  });
}
