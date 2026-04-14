import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceLineItem, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { quotes } from "@/lib/db/schema/quotes";

type DatabaseLike = typeof defaultDb;

export interface InvoiceDetail {
  invoice: InvoiceRow;
  company: CompanyRow;
  contactName: string | null;
  contactEmail: string | null;
  lineItems: InvoiceLineItem[];
  sourceQuote: { id: string; token: string; quote_number: string } | null;
  supersededByInvoice:
    | { id: string; invoice_number: string; token: string }
    | null;
  supersedesInvoice:
    | { id: string; invoice_number: string; token: string }
    | null;
}

function parseLineItems(raw: unknown): InvoiceLineItem[] {
  if (Array.isArray(raw)) return raw as InvoiceLineItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as InvoiceLineItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function loadInvoiceDetail(
  invoiceId: string,
  dbOverride?: DatabaseLike,
): Promise<InvoiceDetail | null> {
  const database = dbOverride ?? defaultDb;

  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .get();
  if (!invoice) return null;

  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get();
  if (!company) return null;

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  const contact = deal?.primary_contact_id
    ? (await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  let sourceQuote: InvoiceDetail["sourceQuote"] = null;
  if (invoice.quote_id) {
    const q = await database
      .select({
        id: quotes.id,
        token: quotes.token,
        quote_number: quotes.quote_number,
      })
      .from(quotes)
      .where(eq(quotes.id, invoice.quote_id))
      .get();
    if (q) sourceQuote = q;
  }

  // "Replaced by" — inverse lookup on supersedes_invoice_id.
  const replacedBy = await database
    .select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      token: invoices.token,
    })
    .from(invoices)
    .where(eq(invoices.supersedes_invoice_id, invoice.id))
    .limit(1)
    .get();

  let supersedesInvoice: InvoiceDetail["supersedesInvoice"] = null;
  if (invoice.supersedes_invoice_id) {
    const prior = await database
      .select({
        id: invoices.id,
        invoice_number: invoices.invoice_number,
        token: invoices.token,
      })
      .from(invoices)
      .where(eq(invoices.id, invoice.supersedes_invoice_id))
      .get();
    if (prior) supersedesInvoice = prior;
  }

  return {
    invoice,
    company,
    contactName: contact?.name ?? null,
    contactEmail: contact?.email ?? null,
    lineItems: parseLineItems(invoice.line_items_json),
    sourceQuote,
    supersededByInvoice: replacedBy ?? null,
    supersedesInvoice,
  };
}
