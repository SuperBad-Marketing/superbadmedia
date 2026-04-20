import "server-only";
import { eq, and, isNull, isNotNull, ne, lte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { renderPlanPdf } from "./render-plan-pdf";
import settings from "@/lib/settings";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface EligiblePlan {
  plan: typeof six_week_plans.$inferSelect;
  deal: typeof deals.$inferSelect;
  contactEmail: string;
  contactName: string;
  businessName: string;
}

async function findEligiblePlans(
  targetDayOffset: number,
): Promise<EligiblePlan[]> {
  const now = Date.now();

  const plans = await db
    .select()
    .from(six_week_plans)
    .where(
      and(
        inArray(six_week_plans.status, ["approved", "released"]),
        isNull(six_week_plans.portal_archived_at_ms),
      ),
    );

  const results: EligiblePlan[] = [];

  for (const plan of plans) {
    const deal = await db.query.deals.findFirst({
      where: eq(deals.id, plan.deal_id),
    });
    if (!deal) continue;

    // Condition 1: deal NOT in `won` status
    if (deal.stage === "won") continue;

    // Condition 2: portal NOT already archived
    if (plan.portal_archived_at_ms) continue;

    // Condition 3: Andy NOT manually extended the portal
    if (plan.portal_extended_until_ms && plan.portal_extended_until_ms > now) {
      continue;
    }

    // Calculate shoot completion date from company
    const company = deal.company_id
      ? await db.query.companies.findFirst({
          where: eq(companies.id, deal.company_id),
        })
      : null;

    const shootCompletedAtMs = company?.trial_shoot_completed_at_ms;
    if (!shootCompletedAtMs) continue;

    const daysSinceShoot = (now - shootCompletedAtMs) / MS_PER_DAY;
    if (daysSinceShoot < targetDayOffset) continue;

    // Resolve contact email
    if (!deal.primary_contact_id) continue;
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, deal.primary_contact_id),
    });
    if (!contact?.email) continue;

    results.push({
      plan,
      deal,
      contactEmail: contact.email,
      contactName: contact.name ?? "there",
      businessName: company?.name ?? deal.title,
    });
  }

  return results;
}

export async function runExpiryEmailSweep(): Promise<number> {
  const accessDays = await settings.get("plan.portal_access_days_post_shoot");
  const emailDaysBefore = await settings.get(
    "plan.expiry_email_days_before_archive",
  );
  const emailDayOffset = accessDays - emailDaysBefore;

  const eligible = await findEligiblePlans(emailDayOffset);
  let sent = 0;

  for (const { plan, deal, contactEmail, contactName, businessName } of eligible) {
    if (plan.portal_expiry_email_sent_at_ms) continue;

    const pdf = await renderPlanPdf(plan.id, undefined, { skipCache: true });
    if (!pdf) continue;

    const mailtoSubject = encodeURIComponent(
      `Coming back about my plan — ${businessName}`,
    );
    const mailtoHref = `mailto:andy@superbadmedia.com.au?subject=${mailtoSubject}`;

    const body = `<p>It's been a few weeks since your shoot, and you've had the plan for a while now. Hopefully some of it's landed — even one or two of those early weeks can shift things.</p>
<p>Your portal goes quiet in about a week. The plan's yours either way — attached as a PDF, same version that's on the portal now.</p>
<p>If anything here lands differently now that you've had it for a few weeks, you know where to find me.</p>
<p><a href="${mailtoHref}">andy@superbadmedia.com.au</a></p>
<p>Andy<br/>SuperBad Marketing</p>`;

    const result = await sendEmail({
      to: contactEmail,
      subject: "Your plan — keeping a copy",
      body,
      classification: "six_week_plan_expiry_email",
      purpose: "Day-53 non-converter wind-down email with PDF attachment",
      replyTo: "andy@superbadmedia.com.au",
      attachments: [{ filename: pdf.filename, content: pdf.buffer }],
    });

    if (result.sent) {
      await db
        .update(six_week_plans)
        .set({
          portal_expiry_email_sent_at_ms: Date.now(),
          updated_at_ms: Date.now(),
        })
        .where(eq(six_week_plans.id, plan.id));

      await logActivity({
        companyId: deal.company_id,
        contactId: deal.primary_contact_id,
        dealId: deal.id,
        kind: "six_week_plan_expiry_email_sent",
        body: "Non-converter wind-down email sent with PDF plan attached.",
        meta: { plan_id: plan.id, deal_id: deal.id },
      });

      sent++;
    }
  }

  return sent;
}

export async function runPortalArchiveSweep(): Promise<number> {
  const accessDays = await settings.get("plan.portal_access_days_post_shoot");
  const eligible = await findEligiblePlans(accessDays);
  let archived = 0;

  for (const { plan, deal } of eligible) {
    if (plan.portal_archived_at_ms) continue;

    const now = Date.now();
    await db
      .update(six_week_plans)
      .set({
        portal_archived_at_ms: now,
        status: "archived",
        updated_at_ms: now,
      })
      .where(eq(six_week_plans.id, plan.id));

    await logActivity({
      companyId: deal.company_id,
      contactId: deal.primary_contact_id,
      dealId: deal.id,
      kind: "six_week_plan_portal_archived_non_converter",
      body: "Non-converter portal archived after 60-day access window.",
      meta: { plan_id: plan.id, deal_id: deal.id },
    });

    archived++;
  }

  return archived;
}
