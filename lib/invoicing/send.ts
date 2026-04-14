import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";
import { transitionInvoiceStatus } from "@/lib/invoicing/transitions";
import { composeInvoiceSendEmail } from "@/lib/invoicing/compose-emails";

type DatabaseLike = typeof defaultDb;

export type SendInvoiceResult =
  | { ok: true; invoice: InvoiceRow; recipient: string | null }
  | { ok: false; error: string };

export async function sendInvoice(
  input: { invoice_id: string; nowMs?: number },
  dbOverride?: DatabaseLike,
): Promise<SendInvoiceResult> {
  const database = dbOverride ?? defaultDb;
  const now = input.nowMs ?? Date.now();

  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoice_id))
    .get();
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: `invoice_not_draft:${invoice.status}` };
  }

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get();
  if (!deal || !company) return { ok: false, error: "deal_or_company_missing" };

  const recipient: ContactRow | null = deal.primary_contact_id
    ? (await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  const to = recipient?.email ?? null;

  const parts = composeInvoiceSendEmail({ invoice, company });

  let messageId: string | undefined;
  if (to) {
    const result = await sendEmail({
      to,
      subject: parts.subject,
      body: parts.bodyHtml,
      classification: "invoice_send",
      purpose: `invoicing:send:${invoice.id}`,
    });
    if (!result.sent && !result.skipped) {
      return {
        ok: false,
        error: `send_failed:${result.reason ?? "unknown"}`,
      };
    }
    messageId = result.messageId;
  }

  const updated = await transitionInvoiceStatus(
    {
      invoice_id: invoice.id,
      from: "draft",
      to: "sent",
      patch: messageId ? { thread_message_id: messageId } : undefined,
      nowMs: now,
    },
    database,
  );

  await logActivity({
    companyId: invoice.company_id,
    dealId: invoice.deal_id,
    contactId: recipient?.id ?? null,
    kind: "invoice_sent",
    body: `Invoice ${invoice.invoice_number} sent${to ? ` to ${to}` : " (no recipient on file)"}.`,
    meta: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_cents_inc_gst: invoice.total_cents_inc_gst,
      recipient_email: to,
    },
    createdAtMs: now,
  });

  return { ok: true, invoice: updated, recipient: to };
}

export type { DealRow, CompanyRow };
