import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift, type DriftCheckResult } from "@/lib/ai/drift-check";
import {
  buildDraftReminder3dPrompt,
  type QuoteReminder3dInput,
} from "@/lib/ai/prompts/quote-builder/draft-reminder-3d";
import { getSuperbadBrandProfile } from "./superbad-brand-profile";
import { paragraphsToHtml } from "./compose-send-email";
import type { QuoteContent } from "./content-shape";

type DatabaseLike = typeof defaultDb;

export interface ComposedReminderEmail {
  subject: string;
  bodyHtml: string;
  bodyParagraphs: string[];
  drift: DriftCheckResult;
  recipientEmail: string;
  recipientName: string;
  /** True when LLM was bypassed (kill switch) and a fallback was used. */
  fallbackUsed: boolean;
}

const MAX_OUTPUT_TOKENS = 600;

function fallbackDraft(input: QuoteReminder3dInput): {
  subject: string;
  bodyParagraphs: string[];
} {
  const subject = `${input.companyName} — the quote's still there`;
  const lines = [
    `${input.recipientName}, quick one — your quote's been sitting there for ${input.daysSinceSent} days.`,
    `No pressure. If you want to read it, it's the same link.`,
  ];
  return { subject, bodyParagraphs: lines };
}

export interface ComposeQuoteReminder3dInput {
  quote_id: string;
  /** Override base URL (defaults to NEXT_PUBLIC_APP_URL). */
  appUrlOverride?: string;
}

/**
 * Compose the 3-day unread-quote reminder email per spec §8.3.
 *
 * Mirrors `composeQuoteSendEmail`: reads quote + company + primary contact,
 * builds the Opus prompt, calls the LLM via the model registry, runs the
 * drift check, returns the structured draft. Caller is the scheduled-task
 * handler — no modal, no pre-send review, so the draft goes straight to
 * `sendEmail()`.
 *
 * Kill-switch fallback: when `llm_calls_enabled` is false, returns a
 * deterministic plain-language draft so the handler always has something
 * to dispatch.
 */
export async function composeQuoteReminder3d(
  input: ComposeQuoteReminder3dInput,
  dbOverride?: DatabaseLike,
): Promise<ComposedReminderEmail> {
  const database = dbOverride ?? defaultDb;
  const quote = (await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get()) as QuoteRow | undefined;
  if (!quote) throw new Error(`compose-reminder: quote ${input.quote_id} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) {
    throw new Error(`compose-reminder: company ${quote.company_id} not found`);
  }

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, quote.deal_id))
    .get();
  let contact: ContactRow | undefined;
  if (deal && "primary_contact_id" in deal && deal.primary_contact_id) {
    contact = (await database
      .select()
      .from(contacts)
      .where(eq(contacts.id, deal.primary_contact_id))
      .get()) as ContactRow | undefined;
  }

  const recipientEmail = contact?.email ?? "";
  const recipientName = contact?.name?.split(/\s+/)[0] ?? company.name;
  const content = (quote.content_json ?? null) as QuoteContent | null;

  const baseUrl =
    input.appUrlOverride ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3001";
  const quoteUrl = `${baseUrl.replace(/\/$/, "")}/lite/quotes/${quote.token}`;

  const sentAt = quote.sent_at_ms ?? Date.now();
  const daysSinceSent = Math.max(
    1,
    Math.floor((Date.now() - sentAt) / (1000 * 60 * 60 * 24)),
  );

  const promptInput: QuoteReminder3dInput = {
    recipientName,
    companyName: company.name,
    quoteUrl,
    daysSinceSent,
    contextSnippet: content?.sections.whatYouToldUs.prose?.slice(0, 200) || null,
  };

  if (!killSwitches.llm_calls_enabled) {
    const fb = fallbackDraft(promptInput);
    return {
      subject: fb.subject,
      bodyParagraphs: fb.bodyParagraphs,
      bodyHtml: paragraphsToHtml(fb.bodyParagraphs, quoteUrl),
      drift: {
        pass: true,
        score: 1.0,
        notes: "skipped (kill switch — llm_calls_enabled=false)",
      },
      recipientEmail,
      recipientName,
      fallbackUsed: true,
    };
  }

  const promptText = buildDraftReminder3dPrompt(promptInput);

  const raw = await invokeLlmText({
    job: "quote-builder-draft-reminder-3d",
    prompt: promptText,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  const stripped = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

  let subject = "";
  let bodyParagraphs: string[] = [];
  try {
    const parsed = JSON.parse(stripped) as {
      subject?: unknown;
      bodyParagraphs?: unknown;
    };
    if (typeof parsed.subject === "string") subject = parsed.subject.trim();
    if (Array.isArray(parsed.bodyParagraphs)) {
      bodyParagraphs = parsed.bodyParagraphs
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter(Boolean);
    }
  } catch {
    // parse failure → fall through to fallback below
  }

  if (!subject || bodyParagraphs.length === 0) {
    const fb = fallbackDraft(promptInput);
    subject = fb.subject;
    bodyParagraphs = fb.bodyParagraphs;
  }

  const fullText = `${subject}\n\n${bodyParagraphs.join("\n\n")}`;
  const profile = await getSuperbadBrandProfile(database);
  const drift = await checkBrandVoiceDrift(fullText, profile);

  return {
    subject,
    bodyParagraphs,
    bodyHtml: paragraphsToHtml(bodyParagraphs, quoteUrl),
    drift,
    recipientEmail,
    recipientName,
    fallbackUsed: false,
  };
}
