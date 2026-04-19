"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { createDealFromLead } from "@/lib/crm/create-deal-from-lead";
import { logActivity } from "@/lib/activity-log";

const FUNNEL_SHAPES = ["solo_founder", "founder_led_team", "multi_stakeholder_company"] as const;

const section1Schema = z.object({
  name: z.string().trim().min(1).max(200),
  businessName: z.string().trim().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().trim().min(6).max(30),
  smsOptIn: z.boolean(),
  shape: z.enum(FUNNEL_SHAPES),
});

export type Section1Input = z.infer<typeof section1Schema>;

export type Section1Result =
  | { ok: true; token: string }
  | { ok: false; reason: string };

export async function submitSection1Action(
  raw: Section1Input,
): Promise<Section1Result> {
  const parsed = section1Schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "Invalid form data." };
  }
  const input = parsed.data;
  const now = Date.now();
  const token = randomUUID().replace(/-/g, "").slice(0, 16);

  try {
    const { company, contact, deal } = await createDealFromLead(
      {
        company: {
          name: input.businessName,
          shape: input.shape,
        },
        contact: {
          name: input.name,
          email: input.email,
          phone: input.phone,
        },
        source: "intro_funnel_contact_submitted",
      },
    );

    // Write canonical shape if null
    if (!company.shape) {
      await db
        .update(companies)
        .set({ shape: input.shape, updated_at_ms: now })
        .where(eq(companies.id, company.id));
    } else if (company.shape !== input.shape) {
      await logActivity({
        companyId: company.id,
        contactId: contact.id,
        dealId: deal.id,
        kind: "shape_mismatch_flagged",
        body: `Section 1 shape "${input.shape}" differs from canonical "${company.shape}"`,
        meta: {
          company_shape: company.shape,
          section_1_shape: input.shape,
        },
      });
    }

    // Set SMS opt-in on contact
    if (input.smsOptIn) {
      await db
        .update(contacts)
        .set({
          sms_opt_in: true,
          sms_consent_at_ms: now,
          updated_at_ms: now,
        })
        .where(eq(contacts.id, contact.id));
    }

    // Link funnel submission to deal
    const submissionId = randomUUID();
    await db.insert(intro_funnel_submissions).values({
      id: submissionId,
      token,
      deal_id: deal.id,
      contact_id: contact.id,
      submitted_name: input.name,
      submitted_business_name: input.businessName,
      submitted_email: input.email,
      submitted_phone: input.phone,
      sms_opt_in: input.smsOptIn,
      sms_consent_at_ms: input.smsOptIn ? now : null,
      shape: input.shape,
      funnel_state: "contact_submitted",
      questionnaire_sections_completed: 0,
      abandon_sequence_state: "pending",
      last_activity_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
    });

    // Mirror funnel_submission_id + funnel_state onto deal
    await db
      .update(deals)
      .set({
        funnel_submission_id: submissionId,
        funnel_state: "contact_submitted",
        updated_at_ms: now,
      })
      .where(eq(deals.id, deal.id));

    await logActivity({
      companyId: company.id,
      contactId: contact.id,
      dealId: deal.id,
      kind: "intro_funnel_started",
      body: `${input.name} started the trial shoot funnel`,
      meta: { shape: input.shape, token },
    });

    return { ok: true, token };
  } catch (err) {
    console.error("submitSection1Action error:", err);
    return { ok: false, reason: "Something went wrong. Please try again." };
  }
}
