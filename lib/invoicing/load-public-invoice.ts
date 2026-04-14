import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import { quotes } from "@/lib/db/schema/quotes";

export type PublicInvoiceBundle = {
  invoice: InvoiceRow;
  company: CompanyRow;
  deal: DealRow;
  primaryContact: ContactRow | null;
  /** Token for the source quote, if any. */
  sourceQuoteToken: string | null;
  /** If this invoice was superseded by a newer one, the newer invoice's token. */
  supersededByToken: string | null;
};

/**
 * Token-gated load for the client web page (`/lite/invoices/[token]`)
 * and the `/api/invoices/[token]/payment-intent` route. Returns `null`
 * when the token doesn't resolve — callers render 404. Drafts also
 * return `null` so admin-only drafts never surface publicly.
 */
export async function loadPublicInvoiceByToken(
  token: string,
): Promise<PublicInvoiceBundle | null> {
  const invoice = await db
    .select()
    .from(invoices)
    .where(eq(invoices.token, token))
    .get();
  if (!invoice) return null;
  if (invoice.status === "draft") return null;

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get();
  if (!company) return null;

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  if (!deal) return null;

  const primaryContact = deal.primary_contact_id
    ? (await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  let sourceQuoteToken: string | null = null;
  if (invoice.quote_id) {
    const q = await db
      .select({ token: quotes.token })
      .from(quotes)
      .where(eq(quotes.id, invoice.quote_id))
      .get();
    sourceQuoteToken = q?.token ?? null;
  }

  let supersededByToken: string | null = null;
  if (invoice.status === "void") {
    const next = await db
      .select({ token: invoices.token })
      .from(invoices)
      .where(eq(invoices.supersedes_invoice_id, invoice.id))
      .get();
    supersededByToken = next?.token ?? null;
  }

  return {
    invoice,
    company,
    deal,
    primaryContact,
    sourceQuoteToken,
    supersededByToken,
  };
}
