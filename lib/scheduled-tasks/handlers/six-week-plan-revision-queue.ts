import { z } from "zod";
import { eq } from "drizzle-orm";
import { killSwitches } from "@/lib/kill-switches";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { sendEmail } from "@/lib/channels/email/send";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";

const PayloadSchema = z.object({
  plan_id: z.string().min(1),
  deal_id: z.string().min(1),
  note_preview: z.string().optional(),
});

export const handlePlanRevisionReviewQueue: TaskHandler = async (task) => {
  if (!killSwitches.plan_automations_enabled) return;

  const parsed = PayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `plan_revision_review_queue: invalid payload (${parsed.error.message})`,
    );
  }

  const { plan_id, deal_id, note_preview } = parsed.data;

  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, plan_id),
  });
  if (!plan) {
    console.warn(`plan_revision_review_queue: plan ${plan_id} not found`);
    return;
  }

  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, deal_id),
  });

  const contact = deal?.primary_contact_id
    ? await db.query.contacts.findFirst({
        where: eq(contacts.id, deal.primary_contact_id),
      })
    : null;

  const company = deal?.company_id
    ? await db.query.companies.findFirst({
        where: eq(companies.id, deal.company_id),
      })
    : null;

  const prospectName = contact?.name ?? "A prospect";
  const businessName = company?.name ?? deal?.title ?? "their business";
  const preview = note_preview ?? plan.revision_note?.slice(0, 120) ?? "";

  const adminEmail = process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const reviewUrl = `${baseUrl}/lite/six-week-plans/${plan_id}/revision-review`;

  await sendEmail({
    to: adminEmail,
    subject: `Plan revision request — ${prospectName} (${businessName})`,
    body: [
      `${prospectName} from ${businessName} wants a revision on their six-week plan.`,
      "",
      `Their note: "${preview}"`,
      "",
      `Review it here: ${reviewUrl}`,
    ].join("\n"),
    classification: "transactional",
    purpose: "Admin notification: plan revision requested",
  });
};

export const SIX_WEEK_PLAN_REVISION_QUEUE_HANDLERS: HandlerMap = {
  plan_revision_review_queue: handlePlanRevisionReviewQueue,
};
