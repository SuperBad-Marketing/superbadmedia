import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildDraftSupersedeNotificationPrompt,
  type InvoiceSupersedeInput,
} from "@/lib/ai/prompts/branded-invoicing/draft-supersede-notification";
import { composeInvoiceSupersedeEmail as deterministicSupersedeEmail } from "./compose-emails";
import { paragraphsToInvoiceHtml } from "./email-html";

type DatabaseLike = typeof defaultDb;

export interface ComposedInvoiceSupersedeEmail {
  subject: string;
  bodyHtml: string;
  bodyParagraphs: string[];
  recipientEmail: string;
  recipientName: string;
  newInvoiceUrl: string;
  /** True when Claude was bypassed (kill-switch / parse failure). */
  fallbackUsed: boolean;
}

const MAX_OUTPUT_TOKENS = 300;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceUrlFor(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";
  return `${base.replace(/\/$/, "")}/lite/invoices/${token}`;
}

function deterministicFallback(
  newInvoice: InvoiceRow,
  previousInvoiceNumber: string,
  company: CompanyRow,
  newInvoiceUrl: string,
  recipientEmail: string,
  recipientName: string,
): ComposedInvoiceSupersedeEmail {
  const parts = deterministicSupersedeEmail({
    newInvoice,
    previousInvoiceNumber,
    company,
  });
  const paragraphs = [
    `Hi ${company.name}, updated invoice — ${previousInvoiceNumber} has been replaced by ${newInvoice.invoice_number} (${formatCents(newInvoice.total_cents_inc_gst)}).`,
  ];
  return {
    subject: parts.subject,
    bodyParagraphs: paragraphs,
    bodyHtml: paragraphsToInvoiceHtml(paragraphs, newInvoiceUrl),
    recipientEmail,
    recipientName,
    newInvoiceUrl,
    fallbackUsed: true,
  };
}

export interface ComposeSupersedeEmailInput {
  new_invoice_id: string;
  previous_invoice_number: string;
}

/**
 * Supersede notification — Haiku-tier, no drift-check per spec §6.3. Short,
 * functional. Deterministic fallback on kill-switch or parse failure.
 */
export async function composeInvoiceSupersedeEmailAI(
  input: ComposeSupersedeEmailInput,
  dbOverride?: DatabaseLike,
): Promise<ComposedInvoiceSupersedeEmail> {
  const database = dbOverride ?? defaultDb;

  const newInvoice = (await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.new_invoice_id))
    .get()) as InvoiceRow | undefined;
  if (!newInvoice) throw new Error(`compose-supersede: invoice ${input.new_invoice_id} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, newInvoice.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) throw new Error(`compose-supersede: company ${newInvoice.company_id} not found`);

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, newInvoice.deal_id))
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
  const newInvoiceUrl = invoiceUrlFor(newInvoice.token);

  if (!killSwitches.llm_calls_enabled) {
    return deterministicFallback(
      newInvoice,
      input.previous_invoice_number,
      company,
      newInvoiceUrl,
      recipientEmail,
      recipientName,
    );
  }

  const promptInput: InvoiceSupersedeInput = {
    recipientName,
    companyName: company.name,
    previousInvoiceNumber: input.previous_invoice_number,
    newInvoiceNumber: newInvoice.invoice_number,
    newTotalDisplay: `${formatCents(newInvoice.total_cents_inc_gst)} inc GST`,
    newInvoiceUrl,
  };

  const promptText = buildDraftSupersedeNotificationPrompt(promptInput);

  let subject = "";
  let bodyParagraphs: string[] = [];
  try {
    const raw = await invokeLlmText({
      job: "invoice-draft-supersede-notification",
      prompt: promptText,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
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
    // parse / network failure → fallback
  }

  if (!subject || bodyParagraphs.length === 0) {
    return deterministicFallback(
      newInvoice,
      input.previous_invoice_number,
      company,
      newInvoiceUrl,
      recipientEmail,
      recipientName,
    );
  }

  return {
    subject,
    bodyParagraphs,
    bodyHtml: paragraphsToInvoiceHtml(bodyParagraphs, newInvoiceUrl),
    recipientEmail,
    recipientName,
    newInvoiceUrl,
    fallbackUsed: false,
  };
}
