"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { sendEmail } from "@/lib/channels/email/send";
import { auth } from "@/lib/auth/session";
import { invokeLlmTextWithMeta } from "@/lib/ai/invoke";
import { buildRevisionReplyPrompt } from "@/lib/ai/prompts/six-week-plan/revision-reply";
import type { WeeksOutput } from "@/lib/ai/prompts/six-week-plan/weeks";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function regenerateWithRevisionNote(
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };
  if (!plan.revision_note) return { ok: false, error: "No revision note." };

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
    kind: "six_week_plan_superseded_by_revision",
    body: "Plan regenerated from prospect revision note.",
    meta: { plan_id: planId, note_preview: plan.revision_note.slice(0, 100) },
  });

  await enqueueTask({
    task_type: "six_week_plan_generate",
    runAt: Date.now(),
    payload: {
      plan_id: planId,
      deal_id: plan.deal_id,
      regen_note: `PROSPECT REVISION REQUEST: ${plan.revision_note}`,
    },
    idempotencyKey: `swp_revision_regen:${planId}:${now}`,
  });

  revalidatePath(`/lite/six-week-plans/${planId}/revision-review`);
  return { ok: true };
}

export async function draftRevisionReply(
  planId: string,
): Promise<{ ok: boolean; draft?: string; error?: string }> {
  await requireAdmin();

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };
  if (!plan.revision_note) return { ok: false, error: "No revision note." };

  const weeksData = plan.weeks_json as unknown as WeeksOutput | null;
  if (!weeksData) return { ok: false, error: "Plan has no weeks data." };

  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, plan.deal_id),
  });
  const company = deal?.company_id
    ? await db.query.companies.findFirst({
        where: eq(companies.id, deal.company_id),
      })
    : null;
  const contact = deal?.primary_contact_id
    ? await db.query.contacts.findFirst({
        where: eq(contacts.id, deal.primary_contact_id),
      })
    : null;

  const prompt = buildRevisionReplyPrompt({
    prospectName: contact?.name ?? "the prospect",
    businessName: company?.name ?? deal?.title ?? "their business",
    revisionNote: plan.revision_note,
    planJson: weeksData,
  });

  const result = await invokeLlmTextWithMeta({
    job: "six-week-plan-revision-reply",
    prompt,
    maxTokens: 1024,
  });

  return { ok: true, draft: result.text };
}

export async function sendRevisionReply(
  planId: string,
  replyBody: string,
  source: "llm_drafted" | "hand_written",
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return { ok: false, error: "Plan not found." };

  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, plan.deal_id),
  });
  if (!deal?.primary_contact_id)
    return { ok: false, error: "No contact on deal." };

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, deal.primary_contact_id),
  });
  if (!contact?.email) return { ok: false, error: "Contact has no email." };

  const resolution =
    source === "llm_drafted" ? "explained" : "hand_rejected";

  const now = Date.now();
  await db
    .update(six_week_plans)
    .set({
      revision_resolution: resolution,
      revision_reply_sent_at_ms: now,
      revision_reply_body: replyBody.trim(),
      updated_at_ms: now,
    })
    .where(eq(six_week_plans.id, planId));

  await sendEmail({
    to: contact.email,
    subject: "Re: your revision note",
    body: `${replyBody.trim()}\n\n—\nAndy\nSuperBad Marketing`,
    classification: "six_week_plan_revision_explained",
    purpose: "Reply to prospect's plan revision note",
    replyTo: "andy@superbadmedia.com.au",
  });

  await logActivity({
    dealId: plan.deal_id,
    contactId: contact.id,
    kind: "six_week_plan_revision_explained",
    body: "Andy replied to prospect's revision note.",
    meta: { plan_id: planId, source },
  });

  revalidatePath(`/lite/six-week-plans/${planId}/revision-review`);
  return { ok: true };
}
