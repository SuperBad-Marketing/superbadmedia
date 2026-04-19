import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { portal_chat_messages } from "@/lib/db/schema/portal-chat-messages";
import { eq, and } from "drizzle-orm";
import {
  createDealFromLead,
  type CreateDealFromLeadResult,
} from "@/lib/crm/create-deal-from-lead";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";
import settingsRegistry from "@/lib/settings";

export interface SubmitReferralInput {
  referrerContactId: string;
  referredName: string;
  referredEmail: string;
  note?: string;
}

export interface SubmitReferralResult {
  deal: CreateDealFromLeadResult;
  followUpDraft: string | null;
}

export async function submitReferral(
  input: SubmitReferralInput,
): Promise<SubmitReferralResult> {
  const [referrerContact] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      company_id: contacts.company_id,
    })
    .from(contacts)
    .where(eq(contacts.id, input.referrerContactId))
    .limit(1);

  if (!referrerContact) {
    throw new Error("submitReferral: referrer contact not found");
  }

  const [referrerCompany] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, referrerContact.company_id))
    .limit(1);

  if (!referrerCompany) {
    throw new Error("submitReferral: referrer company not found");
  }

  const domain = input.referredEmail.split("@")[1] ?? null;
  const companyName =
    domain && !isGenericDomain(domain)
      ? domainToCompanyName(domain)
      : `${input.referredName}'s company`;

  const dealResult = createDealFromLead({
    company: { name: companyName, domain },
    contact: {
      name: input.referredName,
      email: input.referredEmail,
      notes: input.note || null,
    },
    source: "referral",
    title: `Referral from ${referrerCompany.name} — ${input.referredName}`,
  });

  await db
    .update(deals)
    .set({
      referral_from_company_id: referrerCompany.id,
      referral_from_contact_id: referrerContact.id,
      updated_at_ms: Date.now(),
    })
    .where(eq(deals.id, dealResult.deal.id))
    .run();

  await Promise.all([
    logActivity({
      companyId: referrerCompany.id,
      contactId: referrerContact.id,
      kind: "referral_submitted",
      body: `Referred ${input.referredName} (${input.referredEmail}).`,
      meta: {
        referred_name: input.referredName,
        referred_email: input.referredEmail,
        deal_id: dealResult.deal.id,
      },
    }),
    logActivity({
      companyId: dealResult.company.id,
      contactId: dealResult.contact.id,
      dealId: dealResult.deal.id,
      kind: "referral_received",
      body: `Referred by ${referrerContact.name} at ${referrerCompany.name}.`,
      meta: {
        referrer_contact_id: referrerContact.id,
        referrer_company_id: referrerCompany.id,
      },
    }),
  ]);

  await db.insert(portal_chat_messages).values({
    contact_id: referrerContact.id,
    role: "assistant",
    content: "Thanks — we'll reach out to them.",
    created_at_ms: Date.now(),
  });

  let followUpDraft: string | null = null;
  if (killSwitches.llm_calls_enabled) {
    try {
      followUpDraft = await generateReferralFollowUp({
        referrerName: referrerContact.name,
        referrerCompanyName: referrerCompany.name,
        referredName: input.referredName,
        referredEmail: input.referredEmail,
        note: input.note ?? null,
      });
    } catch {
      console.error("[referral] Follow-up draft generation failed");
    }
  }

  return { deal: dealResult, followUpDraft };
}

const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "protonmail.com",
  "me.com",
  "mail.com",
  "fastmail.com",
]);

function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain.toLowerCase());
}

function domainToCompanyName(domain: string): string {
  return domain
    .replace(/\.(com|com\.au|net|org|io|co|au|nz)(\..+)?$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface GenerateFollowUpInput {
  referrerName: string;
  referrerCompanyName: string;
  referredName: string;
  referredEmail: string;
  note: string | null;
}

async function generateReferralFollowUp(
  input: GenerateFollowUpInput,
): Promise<string> {
  const noteSection = input.note
    ? `\nCONTEXT FROM THE REFERRER:\n"${input.note}"\nWeave this naturally into the email — it's genuine insight, not a sales note.`
    : "";

  const prompt = `Write a short warm follow-up email from Andy at SuperBad Marketing to ${input.referredName} (${input.referredEmail}).

${input.referrerName} at ${input.referrerCompanyName} referred them. The opening line MUST reference the referrer by name as social proof: "${input.referrerName} at ${input.referrerCompanyName} thought you might find this useful."
${noteSection}

RULES:
- Andy's voice: dry, direct, zero jargon. Short sentences.
- No hard sell. No pitch deck language. No "synergy" or "leverage".
- Keep it under 120 words.
- End with an open question that invites a reply, not a CTA button.
- Do not use emoji.
- Plain text only — no markdown formatting.

Respond with ONLY the email body text. No subject line, no greeting prefix (start directly after "Hi [name],"), no sign-off — Andy adds those himself.`;

  return invokeLlmText({
    job: "referral-follow-up-draft",
    prompt,
    maxTokens: 400,
  });
}

export async function shouldShowMilestonePrompt(
  contactId: string,
): Promise<boolean> {
  const [contact] = await db
    .select({ last_referral_prompt_at_ms: contacts.last_referral_prompt_at_ms })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) return false;

  const cooldownDays = await settingsRegistry.get(
    "referral.milestone_prompt_cooldown_days",
  );
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  if (
    contact.last_referral_prompt_at_ms != null &&
    Date.now() - contact.last_referral_prompt_at_ms < cooldownMs
  ) {
    return false;
  }

  return true;
}

export async function recordMilestonePromptShown(
  contactId: string,
): Promise<void> {
  await db
    .update(contacts)
    .set({ last_referral_prompt_at_ms: Date.now() })
    .where(eq(contacts.id, contactId))
    .run();
}

export async function dismissMilestonePrompt(
  contactId: string,
): Promise<void> {
  await db
    .update(contacts)
    .set({ last_referral_prompt_at_ms: Date.now() })
    .where(eq(contacts.id, contactId))
    .run();
}
