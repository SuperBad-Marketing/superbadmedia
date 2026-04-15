import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { checkBrandVoiceDrift, type DriftCheckResult } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import {
  buildDraftSendEmailPrompt,
  type InvoiceSendEmailInput,
} from "@/lib/ai/prompts/branded-invoicing/draft-send-email";
import { composeInvoiceSendEmail as deterministicSendEmail } from "./compose-emails";
import { paragraphsToInvoiceHtml } from "./email-html";

type DatabaseLike = typeof defaultDb;

export interface ComposedInvoiceEmail {
  subject: string;
  bodyHtml: string;
  bodyParagraphs: string[];
  drift: DriftCheckResult;
  recipientEmail: string;
  recipientName: string;
  invoiceUrl: string;
  /** True when Claude was bypassed (kill switch / parse failure / missing context) and the deterministic variant shipped. */
  fallbackUsed: boolean;
}

const CLIENT_SINGLETON = new Anthropic();
const MAX_OUTPUT_TOKENS = 600;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDueDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function invoiceUrlFor(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";
  return `${base.replace(/\/$/, "")}/lite/invoices/${token}`;
}

function deterministicFallback(
  invoice: InvoiceRow,
  company: CompanyRow,
  invoiceUrl: string,
  recipientEmail: string,
  recipientName: string,
): ComposedInvoiceEmail {
  const parts = deterministicSendEmail({ invoice, company });
  // Deterministic composer emits its own HTML + "View online" anchor. For a
  // consistent bodyParagraphs shape, strip to plain lines from the subject
  // + re-wrap via `paragraphsToInvoiceHtml` so the button label matches.
  const paragraphs = [
    `Hi ${company.name},`,
    `Invoice ${invoice.invoice_number} — ${formatCents(invoice.total_cents_inc_gst)} inc. GST, due ${formatDueDate(invoice.due_at_ms)}.`,
  ];
  return {
    subject: parts.subject,
    bodyParagraphs: paragraphs,
    bodyHtml: paragraphsToInvoiceHtml(paragraphs, invoiceUrl),
    drift: {
      pass: true,
      score: 1.0,
      notes: "deterministic fallback (kill-switch / parse-failure / missing-context)",
    },
    recipientEmail,
    recipientName,
    invoiceUrl,
    fallbackUsed: true,
  };
}

export interface ComposeInvoiceSendEmailInput {
  invoice_id: string;
}

/**
 * Compose the Claude-drafted send email for an invoice per spec §4.6 / §6.1.
 *
 * Kill-switch fallback: when `llm_calls_enabled` is false, returns the
 * deterministic composer output so callers always have something to
 * dispatch. Parse failures + empty contact context also fall back.
 */
export async function composeInvoiceSendEmailAI(
  input: ComposeInvoiceSendEmailInput,
  dbOverride?: DatabaseLike,
): Promise<ComposedInvoiceEmail> {
  const database = dbOverride ?? defaultDb;

  const invoice = (await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get()) as InvoiceRow | undefined;
  if (!invoice) throw new Error(`compose-invoice-send: invoice ${input.invoice_id} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) throw new Error(`compose-invoice-send: company ${invoice.company_id} not found`);

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  const contact: ContactRow | undefined = deal?.primary_contact_id
    ? ((await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) as ContactRow | undefined)
    : undefined;

  const recipientEmail = contact?.email ?? "";
  const recipientName = contact?.name?.split(/\s+/)[0] ?? company.name;
  const invoiceUrl = invoiceUrlFor(invoice.token);

  // Prior payment history — count of paid invoices for this company.
  const paidRows = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.company_id, invoice.company_id),
        eq(invoices.status, "paid"),
      ),
    )
    .all();
  const hasPaymentHistory = paidRows.length > 0;

  const promptInput: InvoiceSendEmailInput = {
    recipientName,
    companyName: company.name,
    invoiceNumber: invoice.invoice_number,
    totalDisplay: `${formatCents(invoice.total_cents_inc_gst)} inc GST`,
    dueDateDisplay: formatDueDate(invoice.due_at_ms),
    cycleIndex: invoice.cycle_index,
    scopeSummary: invoice.scope_summary ?? null,
    invoiceUrl,
    hasPaymentHistory,
  };

  if (!killSwitches.llm_calls_enabled) {
    return deterministicFallback(invoice, company, invoiceUrl, recipientEmail, recipientName);
  }

  const modelId = modelFor("invoice-draft-send-email");
  const promptText = buildDraftSendEmailPrompt(promptInput);

  let subject = "";
  let bodyParagraphs: string[] = [];
  try {
    const response = await CLIENT_SINGLETON.messages.create({
      model: modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: promptText }],
    });
    const raw = response.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    const stripped = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
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
    // network / parse failure → deterministic fallback below
  }

  if (!subject || bodyParagraphs.length === 0) {
    return deterministicFallback(invoice, company, invoiceUrl, recipientEmail, recipientName);
  }

  const fullText = `${subject}\n\n${bodyParagraphs.join("\n\n")}`;
  const profile = await getSuperbadBrandProfile(database);
  const drift = await checkBrandVoiceDrift(fullText, profile);

  return {
    subject,
    bodyParagraphs,
    bodyHtml: paragraphsToInvoiceHtml(bodyParagraphs, invoiceUrl),
    drift,
    recipientEmail,
    recipientName,
    invoiceUrl,
    fallbackUsed: false,
  };
}
