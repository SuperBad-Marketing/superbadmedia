import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { quotes } from "@/lib/db/schema/quotes";
import { renderToPdf } from "@/lib/pdf/render";
import { buildInvoicePdfHtml, invoicePdfFilename } from "./pdf-template";

type DatabaseLike = typeof defaultDb;

export interface RenderedInvoicePdf {
  buffer: Buffer;
  filename: string;
  invoice: InvoiceRow;
  company: CompanyRow;
}

/**
 * Reproducible invoice-PDF render from an invoice id alone (§4.5: PDF must
 * be regeneratable without ephemeral state). Reads invoice + company +
 * primary contact + optional source quote, builds the HTML, drives
 * Puppeteer, returns the binary. Caching and multi-document bundling (if
 * ever needed for BAS/EOFY) live in `lib/pdf/render.ts`; this helper
 * always renders fresh.
 */
export async function renderInvoicePdf(
  invoiceId: string,
  options: { appUrlOverride?: string } = {},
  dbOverride?: DatabaseLike,
): Promise<RenderedInvoicePdf> {
  const database = dbOverride ?? defaultDb;
  const invoice = await database
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .get();
  if (!invoice) throw new Error(`renderInvoicePdf: invoice ${invoiceId} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) throw new Error(`renderInvoicePdf: company ${invoice.company_id} not found`);

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  let primaryContact: ContactRow | null = null;
  if (deal && "primary_contact_id" in deal && deal.primary_contact_id) {
    primaryContact =
      ((await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) as ContactRow | undefined) ?? null;
  }

  const baseUrl =
    options.appUrlOverride ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3001";
  const trimmedBase = baseUrl.replace(/\/$/, "");
  const invoiceUrl = `${trimmedBase}/lite/invoices/${invoice.token}`;
  const termsUrl = `${trimmedBase}/lite/legal/terms`;

  let quoteUrl: string | null = null;
  if (invoice.quote_id) {
    const sourceQuote = await database
      .select({ token: quotes.token })
      .from(quotes)
      .where(eq(quotes.id, invoice.quote_id))
      .get();
    if (sourceQuote?.token) {
      quoteUrl = `${trimmedBase}/lite/quotes/${sourceQuote.token}`;
    }
  }

  const html = buildInvoicePdfHtml({
    invoice,
    company,
    primaryContact,
    invoiceUrl,
    quoteUrl,
    termsUrl,
  });

  const buffer = await renderToPdf(html);
  return {
    buffer,
    filename: invoicePdfFilename(company, invoice),
    invoice,
    company,
  };
}
