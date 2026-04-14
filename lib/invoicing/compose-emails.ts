import type { InvoiceRow } from "@/lib/db/schema/invoices";
import type { CompanyRow } from "@/lib/db/schema/companies";

/**
 * BI-1 — deterministic invoice email composition. Claude-drafted +
 * drift-checked variants land in BI-2 (`lib/ai/prompts/branded-invoicing/`
 * + Opus wiring). For now the copy is short, house-voiced, and tested.
 *
 * Every composer returns subject + HTML body. The "View online" link is
 * the primary client action — PDF attachment lands in BI-1b.
 */
export interface InvoiceEmailParts {
  subject: string;
  bodyHtml: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function viewOnlineUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";
  return `${base}/lite/invoices/${token}`;
}

function formatDueDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

export function composeInvoiceSendEmail(args: {
  invoice: InvoiceRow;
  company: CompanyRow;
}): InvoiceEmailParts {
  const { invoice, company } = args;
  const subject = `Invoice ${invoice.invoice_number} from SuperBad`;
  const bodyHtml = `
    <p>Hi ${company.name},</p>
    <p>Invoice <strong>${invoice.invoice_number}</strong> — ${formatCents(invoice.total_cents_inc_gst)} inc. GST, due ${formatDueDate(invoice.due_at_ms)}.</p>
    <p><a href="${viewOnlineUrl(invoice.token)}">View online →</a></p>
    <p>— Andy</p>
  `.trim();
  return { subject, bodyHtml };
}

export function composeInvoiceReminderEmail(args: {
  invoice: InvoiceRow;
  company: CompanyRow;
  reminderCount: number;
  daysOverdue: number;
}): InvoiceEmailParts {
  const { invoice, company, reminderCount, daysOverdue } = args;
  const firstReminder = reminderCount === 0;
  const subject = firstReminder
    ? `Quick one on ${invoice.invoice_number}`
    : `Following up on ${invoice.invoice_number}`;
  const lead = firstReminder
    ? `Quick nudge — invoice <strong>${invoice.invoice_number}</strong> (${formatCents(invoice.total_cents_inc_gst)}) is a few days past its due date.`
    : `Still chasing invoice <strong>${invoice.invoice_number}</strong> — ${daysOverdue} days overdue.`;
  const bodyHtml = `
    <p>Hi ${company.name},</p>
    <p>${lead}</p>
    <p><a href="${viewOnlineUrl(invoice.token)}">View online →</a></p>
    <p>— Andy</p>
  `.trim();
  return { subject, bodyHtml };
}

export function composeInvoiceSupersedeEmail(args: {
  newInvoice: InvoiceRow;
  previousInvoiceNumber: string;
  company: CompanyRow;
}): InvoiceEmailParts {
  const { newInvoice, previousInvoiceNumber, company } = args;
  const subject = `Updated invoice from SuperBad`;
  const bodyHtml = `
    <p>Hi ${company.name},</p>
    <p>Updated invoice — ${previousInvoiceNumber} has been replaced by <strong>${newInvoice.invoice_number}</strong> (${formatCents(newInvoice.total_cents_inc_gst)}).</p>
    <p><a href="${viewOnlineUrl(newInvoice.token)}">View updated invoice →</a></p>
    <p>— Andy</p>
  `.trim();
  return { subject, bodyHtml };
}
