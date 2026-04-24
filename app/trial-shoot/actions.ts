"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { createDealFromLead } from "@/lib/crm/create-deal-from-lead";
import { logActivity } from "@/lib/activity-log";
import {
  encodePortalSession,
  PORTAL_SESSION_COOKIE,
} from "@/lib/portal/guard";
import { issueMagicLink } from "@/lib/portal/issue-magic-link";
import { sendEmail } from "@/lib/channels/email/send";
import settings from "@/lib/settings";

const FUNNEL_SHAPES = ["solo_founder", "founder_led_team", "multi_stakeholder_company"] as const;
const TRIAL_SHOOT_TIERS = ["session", "production"] as const;

const section1Schema = z.object({
  name: z.string().trim().min(1).max(200),
  businessName: z.string().trim().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().trim().min(6).max(30),
  websiteUrl: z.string().url().max(500).optional(),
  smsOptIn: z.boolean(),
  shape: z.enum(FUNNEL_SHAPES),
  selectedTier: z.enum(TRIAL_SHOOT_TIERS),
  intent: z.string().max(100).optional(),
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
      submitted_website_url: input.websiteUrl ?? null,
      submitted_intent: input.intent ?? null,
      sms_opt_in: input.smsOptIn,
      sms_consent_at_ms: input.smsOptIn ? now : null,
      shape: input.shape,
      selected_tier: input.selectedTier,
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

    // Set portal session cookie so the prospect stays authenticated
    const ttlDays = await settings.get("portal.session_cookie_ttl_days");
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, encodePortalSession({
      contactId: contact.id,
      clientId: null,
      submissionId,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ttlDays * 24 * 60 * 60,
    });

    // Issue magic link + send welcome email in background for future returns
    issueMagicLink({
      contactId: contact.id,
      submissionId,
      issuedFor: "section_1",
    }).then(({ url }) => {
      const callbackUrl = encodeURIComponent(`/lite/intro/${token}`);
      const linkWithCallback = `${url}?callbackUrl=${callbackUrl}`;
      const firstName = input.name.split(" ")[0] || input.name;
      return sendEmail({
        to: input.email,
        subject: "Your SuperBad portal",
        body: `<p>Hey ${firstName},</p>
<p>Your trial shoot portal is live. Bookmark this link — it'll get you back in any time:</p>
<p><a href="${linkWithCallback}">Open your portal →</a></p>
<p>— Andy</p>`,
        classification: "portal_magic_link_recovery",
        purpose: "section_1_welcome_magic_link",
      });
    }).catch(() => {});

    return { ok: true, token };
  } catch (err) {
    console.error("submitSection1Action error:", err);
    return { ok: false, reason: "Something went wrong. Please try again." };
  }
}
