/**
 * Builds the Haiku prompt for the `inbox-classify-inbound-route` classifier.
 *
 * Input context: message body/subject/from, existing contacts, Brand DNA
 * summary, recent corrections as few-shot examples.
 *
 * Output contract: JSON matching `RouterOutputSchema` in `router.ts`.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { classification_corrections } from "@/lib/db/schema/classification-corrections";
import { messages } from "@/lib/db/schema/messages";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import type { NormalizedMessage } from "./normalize";

export interface RouterPromptContext {
  message: NormalizedMessage;
  contactRows: Array<{
    id: string;
    name: string;
    email: string | null;
    email_normalised: string | null;
    company_name: string | null;
    relationship_type: string | null;
    inbox_alt_emails: string[] | null;
  }>;
  brandSummary: string;
  corrections: Array<{
    from_address: string;
    subject: string | null;
    original: string;
    corrected: string;
  }>;
}

const MAX_CORRECTIONS = 10;
const MAX_CONTACTS = 100;

export async function loadRouterPromptContext(
  msg: NormalizedMessage,
): Promise<RouterPromptContext> {
  const [contactRows, correctionRows, brandProfile] = await Promise.all([
    loadRecentContacts(),
    loadRecentCorrections(),
    getSuperbadBrandProfile(),
  ]);

  const brandSummary = [
    `Voice: ${brandProfile.voiceDescription}`,
    `Tone: ${brandProfile.toneMarkers.join(", ")}`,
    brandProfile.avoidWords?.length
      ? `Avoids: ${brandProfile.avoidWords.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { message: msg, contactRows, brandSummary, corrections: correctionRows };
}

async function loadRecentContacts(): Promise<RouterPromptContext["contactRows"]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      email_normalised: contacts.email_normalised,
      relationship_type: contacts.relationship_type,
      inbox_alt_emails: contacts.inbox_alt_emails,
      company_id: contacts.company_id,
    })
    .from(contacts)
    .limit(MAX_CONTACTS);

  // Attach company name inline for the prompt (avoid N+1 — denormalise
  // cheaply since we only need it for prompt context, not storage)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    email_normalised: r.email_normalised,
    company_name: null, // company join deferred — contact email matching is the primary signal
    relationship_type: r.relationship_type,
    inbox_alt_emails: r.inbox_alt_emails as string[] | null,
  }));
}

async function loadRecentCorrections(): Promise<
  RouterPromptContext["corrections"]
> {
  const rows = await db
    .select({
      original: classification_corrections.original_classification,
      corrected: classification_corrections.corrected_classification,
      message_id: classification_corrections.message_id,
    })
    .from(classification_corrections)
    .where(eq(classification_corrections.classifier, "router"))
    .orderBy(desc(classification_corrections.created_at_ms))
    .limit(MAX_CORRECTIONS);

  if (rows.length === 0) return [];

  // Fetch the associated messages for context (from_address + subject)
  const enriched: RouterPromptContext["corrections"] = [];
  for (const row of rows) {
    const [msg] = await db
      .select({ from_address: messages.from_address, subject: messages.subject })
      .from(messages)
      .where(eq(messages.id, row.message_id))
      .limit(1);
    enriched.push({
      from_address: msg?.from_address ?? "unknown",
      subject: msg?.subject ?? null,
      original: row.original,
      corrected: row.corrected,
    });
  }

  return enriched;
}

export function buildRouterPrompt(ctx: RouterPromptContext): string {
  const contactsBlock =
    ctx.contactRows.length > 0
      ? ctx.contactRows
          .map(
            (c) =>
              `- ${c.name} <${c.email ?? "no-email"}>${c.inbox_alt_emails?.length ? ` (alt: ${c.inbox_alt_emails.join(", ")})` : ""}${c.relationship_type ? ` [${c.relationship_type}]` : ""} id=${c.id}`,
          )
          .join("\n")
      : "(no contacts yet)";

  const correctionsBlock =
    ctx.corrections.length > 0
      ? ctx.corrections
          .map(
            (c) =>
              `- From: ${c.from_address} | Subject: "${c.subject ?? "(none)"}" | Was: ${c.original} → Should be: ${c.corrected}`,
          )
          .join("\n")
      : "";

  const correctionsSection = correctionsBlock
    ? `\nPREVIOUS CORRECTIONS (learn from these — if a similar sender/pattern appears, follow the corrected classification):\n${correctionsBlock}\n`
    : "";

  return `You are an inbound email router for SuperBad Marketing, an Australian marketing agency. Classify this incoming email to decide what to do with it.

BRAND CONTEXT:
${ctx.brandSummary}

KNOWN CONTACTS:
${contactsBlock}
${correctionsSection}
INCOMING EMAIL:
From: ${ctx.message.from_address}
Subject: ${ctx.message.subject ?? "(no subject)"}
Body (first 2000 chars):
${(ctx.message.body_text ?? "").slice(0, 2000)}

TASK: Classify this email into exactly one category and resolve the contact.

Categories:
- match_existing: The sender matches a known contact (by email, alt email, or clear identity match). Return their contact_id.
- new_lead: The sender is a potential business lead or client enquiry. Create a new contact with relationship_type "lead".
- non_client: The sender is not a lead — they are a supplier, personal contact, or other non-client. Create a new contact with the appropriate relationship_type (one of: non_client, supplier, personal).
- spam: Unsolicited commercial email, phishing, or automated junk. Will be silently archived.

For match_existing: if the from_address is different from the contact's primary email, note it as a detected alt email.
For new_lead / non_client: infer first_name, last_name, and a short tag describing the enquiry type (e.g. "inbound-photography-enquiry", "accountant", "personal-friend").

Respond with a JSON object ONLY — no prose, no markdown fences:
{
  "classification": "match_existing" | "new_lead" | "non_client" | "spam",
  "contact_id": "<existing contact id or null>",
  "new_contact_fields": { "first_name": "...", "last_name": "...", "email": "...", "company_name": "...", "relationship_type": "lead" | "non_client" | "supplier" | "personal", "tag": "..." } | null,
  "detected_alt_email": "<email address if match_existing and from a different address than primary, else null>",
  "reason": "One-line explanation of why this classification was chosen"
}`;
}
