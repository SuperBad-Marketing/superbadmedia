import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { checkBrandVoiceDrift, type DriftCheckResult } from "@/lib/ai/drift-check";
import {
  buildDraftSendEmailPrompt,
  type QuoteSendEmailInput,
} from "@/lib/ai/prompts/quote-builder/draft-send-email";
import { getSuperbadBrandProfile } from "./superbad-brand-profile";
import type { QuoteContent } from "./content-shape";

type DatabaseLike = typeof defaultDb;

export interface ComposedQuoteEmail {
  subject: string;
  bodyHtml: string;
  bodyParagraphs: string[];
  drift: DriftCheckResult;
  /** Recipient + reply-to surfaced for the modal. */
  recipientEmail: string;
  recipientName: string;
  /** True when LLM was bypassed (kill switch) and a fallback was used. */
  fallbackUsed: boolean;
}

const CLIENT_SINGLETON = new Anthropic();
const MAX_OUTPUT_TOKENS = 800;

function formatTotal(content: QuoteContent, quote: QuoteRow): string {
  const retainer = quote.retainer_monthly_cents_inc_gst ?? 0;
  const oneOff = quote.one_off_cents_inc_gst ?? 0;
  const moneyAud = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-AU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  if (quote.structure === "retainer") return `${moneyAud(retainer)} / month inc GST`;
  if (quote.structure === "project") return `${moneyAud(oneOff)} inc GST`;
  return `${moneyAud(retainer)} / month + ${moneyAud(oneOff)} one-off, inc GST`;
}

function termLine(quote: QuoteRow): string | null {
  if (quote.structure === "project") return null;
  return quote.term_length_months
    ? `${quote.term_length_months}-month honour-based commitment`
    : null;
}

function deriveScopeSummary(content: QuoteContent): string {
  const items = content.sections.whatWellDo.line_items
    .map((l) => l.snapshot.name)
    .filter(Boolean)
    .slice(0, 3);
  if (items.length === 0) return "the work we discussed.";
  return items.join(", ");
}

export function paragraphsToHtml(paragraphs: string[], quoteUrl: string): string {
  const escapedParagraphs = paragraphs
    .map(
      (p) => `<p style="margin: 0 0 16px; line-height: 1.55;">${escapeHtml(p)}</p>`,
    )
    .join("\n");
  return `<div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1a1a1a; max-width: 560px;">
${escapedParagraphs}
<p style="margin: 24px 0;"><a href="${escapeAttr(quoteUrl)}" style="display: inline-block; padding: 12px 20px; background: #c8312b; color: #fff5e6; text-decoration: none; border-radius: 4px; font-weight: 600;">Read your quote →</a></p>
<p style="margin: 0; line-height: 1.55;">Andy</p>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function fallbackDraft(input: QuoteSendEmailInput): {
  subject: string;
  bodyParagraphs: string[];
} {
  if (input.supersedesQuoteNumber) {
    const subject = `${input.companyName} — updated quote`;
    const lines = [
      `${input.recipientName}, the updated version — this replaces ${input.supersedesQuoteNumber}.`,
      `Headline: ${input.totalDisplay}${input.termLine ? `, ${input.termLine}` : ""}.`,
      `Read it, sit with it, accept it or come back with questions.`,
    ];
    return { subject, bodyParagraphs: lines };
  }
  const subject = `${input.companyName} — quote ready`;
  const lines = [
    `${input.recipientName}, the quote's ready when you are.`,
    `Headline: ${input.totalDisplay}${input.termLine ? `, ${input.termLine}` : ""}.`,
    input.contextSnippet
      ? `It picks up where we left off — ${input.contextSnippet.slice(0, 140)}.`
      : `It maps to what we talked about.`,
    `Read it, sit with it, accept it or come back with questions.`,
  ];
  return { subject, bodyParagraphs: lines };
}

export interface ComposeQuoteSendEmailInput {
  quote_id: string;
  /** Override base URL (defaults to NEXT_PUBLIC_APP_URL). */
  appUrlOverride?: string;
}

/**
 * Compose the email Andy sends a client when their draft quote ships.
 *
 * Reads quote + company + primary contact + deal context, builds the
 * Opus prompt, calls the LLM via the model registry, runs a drift check
 * against SuperBad's brand DNA profile, and returns the structured
 * draft. Caller (Send modal) presents this for review + edit before
 * dispatch — drift score informs the modal indicator (green/amber).
 *
 * Kill-switch fallback: when `llm_calls_enabled` is false, returns a
 * deterministic plain-language draft so the modal is never empty.
 */
export async function composeQuoteSendEmail(
  input: ComposeQuoteSendEmailInput,
  dbOverride?: DatabaseLike,
): Promise<ComposedQuoteEmail> {
  const database = dbOverride ?? defaultDb;
  const quote = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get();
  if (!quote) throw new Error(`compose: quote ${input.quote_id} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) throw new Error(`compose: company ${quote.company_id} not found`);

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
  if (!content) throw new Error(`compose: quote ${input.quote_id} has no content_json`);

  // Supersede-fork: surface the superseded quote number so the prompt
  // can acknowledge the replacement (spec §Q20). Silent when not set.
  let supersedesQuoteNumber: string | null = null;
  if (quote.supersedes_quote_id) {
    const source = await database
      .select({ quote_number: quotes.quote_number })
      .from(quotes)
      .where(eq(quotes.id, quote.supersedes_quote_id))
      .get();
    supersedesQuoteNumber = source?.quote_number ?? null;
  }

  const baseUrl =
    input.appUrlOverride ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3001";
  const quoteUrl = `${baseUrl.replace(/\/$/, "")}/lite/quotes/${quote.token}`;

  const promptInput: QuoteSendEmailInput = {
    recipientName,
    companyName: company.name,
    structure: quote.structure,
    totalDisplay: formatTotal(content, quote),
    termLine: termLine(quote),
    scopeSummary: deriveScopeSummary(content),
    quoteUrl,
    contextSnippet: content.sections.whatYouToldUs.prose?.slice(0, 200) || null,
    supersedesQuoteNumber,
  };

  if (!killSwitches.llm_calls_enabled) {
    const fb = fallbackDraft(promptInput);
    return {
      subject: fb.subject,
      bodyParagraphs: fb.bodyParagraphs,
      bodyHtml: paragraphsToHtml(fb.bodyParagraphs, quoteUrl),
      drift: { pass: true, score: 1.0, notes: "skipped (kill switch — llm_calls_enabled=false)" },
      recipientEmail,
      recipientName,
      fallbackUsed: true,
    };
  }

  const modelId = modelFor("quote-builder-draft-send-email");
  const promptText = buildDraftSendEmailPrompt(promptInput);

  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: "user", content: promptText }],
  });
  const raw = response.content.find((b) => b.type === "text")?.text?.trim() ?? "";
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
