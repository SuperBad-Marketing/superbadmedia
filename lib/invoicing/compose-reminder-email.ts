import { and, eq, ne } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift, type DriftCheckResult } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import {
  buildDraftReminderPrompt,
  type InvoiceReminderInput,
} from "@/lib/ai/prompts/branded-invoicing/draft-reminder";
import { composeInvoiceReminderEmail as deterministicReminderEmail } from "./compose-emails";
import { paragraphsToInvoiceHtml } from "./email-html";

type DatabaseLike = typeof defaultDb;

export interface ComposedInvoiceReminder {
  subject: string;
  bodyHtml: string;
  bodyParagraphs: string[];
  drift: DriftCheckResult;
  recipientEmail: string;
  recipientName: string;
  invoiceUrl: string;
  daysOverdue: number;
  reminderCount: number;
  fallbackUsed: boolean;
}

const MAX_OUTPUT_TOKENS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  invoice: InvoiceRow,
  company: CompanyRow,
  reminderCount: number,
  daysOverdue: number,
  invoiceUrl: string,
  recipientEmail: string,
  recipientName: string,
): ComposedInvoiceReminder {
  const parts = deterministicReminderEmail({ invoice, company, reminderCount, daysOverdue });
  const firstReminder = reminderCount === 0;
  const paragraphs = [
    `Hi ${company.name},`,
    firstReminder
      ? `Quick nudge — invoice ${invoice.invoice_number} (${formatCents(invoice.total_cents_inc_gst)}) is a few days past its due date.`
      : `Still chasing invoice ${invoice.invoice_number} — ${daysOverdue} days past due.`,
  ];
  return {
    subject: parts.subject,
    bodyParagraphs: paragraphs,
    bodyHtml: paragraphsToInvoiceHtml(paragraphs, invoiceUrl),
    drift: {
      pass: true,
      score: 1.0,
      notes: "deterministic fallback (kill-switch / parse-failure)",
    },
    recipientEmail,
    recipientName,
    invoiceUrl,
    daysOverdue,
    reminderCount,
    fallbackUsed: true,
  };
}

export interface ComposeInvoiceReminderInput {
  invoice_id: string;
  /** Override `now` for deterministic tests / handler cadence. */
  nowMs?: number;
}

export async function composeInvoiceReminderEmailAI(
  input: ComposeInvoiceReminderInput,
  dbOverride?: DatabaseLike,
): Promise<ComposedInvoiceReminder> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const invoice = (await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get()) as InvoiceRow | undefined;
  if (!invoice) throw new Error(`compose-invoice-reminder: invoice ${input.invoice_id} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) throw new Error(`compose-invoice-reminder: company ${invoice.company_id} not found`);

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

  const daysOverdue = Math.max(0, Math.floor((now - invoice.due_at_ms) / DAY_MS));
  const reminderCount = invoice.reminder_count;

  // Payer history — paid/on-time vs never paid vs overdue ever.
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
  const otherRows = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.company_id, invoice.company_id),
        ne(invoices.id, invoice.id),
      ),
    )
    .all();
  const reliablePayer = paidRows.length > 0;
  const firstTimeLate = otherRows.length === 0;

  const promptInput: InvoiceReminderInput = {
    recipientName,
    companyName: company.name,
    invoiceNumber: invoice.invoice_number,
    totalDisplay: `${formatCents(invoice.total_cents_inc_gst)} inc GST`,
    daysOverdue,
    reminderCount,
    invoiceUrl,
    reliablePayer,
    firstTimeLate,
  };

  if (!killSwitches.llm_calls_enabled) {
    return deterministicFallback(
      invoice,
      company,
      reminderCount,
      daysOverdue,
      invoiceUrl,
      recipientEmail,
      recipientName,
    );
  }

  const promptText = buildDraftReminderPrompt(promptInput);

  let subject = "";
  let bodyParagraphs: string[] = [];
  try {
    const raw = await invokeLlmText({
      job: "invoice-draft-reminder",
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

  // Hard rule: first reminder subject must not contain "overdue".
  if (reminderCount === 0 && /overdue/i.test(subject)) {
    subject = "";
  }

  if (!subject || bodyParagraphs.length === 0) {
    return deterministicFallback(
      invoice,
      company,
      reminderCount,
      daysOverdue,
      invoiceUrl,
      recipientEmail,
      recipientName,
    );
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
    daysOverdue,
    reminderCount,
    fallbackUsed: false,
  };
}
