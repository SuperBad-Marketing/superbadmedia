import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { renderToPdf } from "@/lib/pdf/render";
import { buildQuotePdfHtml, quotePdfFilename } from "./pdf-template";
import type { QuoteContent } from "./content-shape";

type DatabaseLike = typeof defaultDb;

export interface RenderedQuotePdf {
  buffer: Buffer;
  filename: string;
  quote: QuoteRow;
  company: CompanyRow;
}

/**
 * Reproducible quote-PDF render from a quote id alone (§4.4: PDF must be
 * regeneratable without ephemeral state). Reads quote + company + primary
 * contact, builds the §4.4 HTML, drives Puppeteer, returns the binary.
 *
 * Caching against `quotes.pdf_cache_key` belongs to the scheduled-task
 * handler (`quote_pdf_render`) — this helper always renders fresh. The
 * route handler at `app/lite/quotes/[token]/pdf/route.ts` calls in
 * directly for inline streaming.
 */
export async function renderQuotePdf(
  quoteId: string,
  options: { appUrlOverride?: string } = {},
  dbOverride?: DatabaseLike,
): Promise<RenderedQuotePdf> {
  const database = dbOverride ?? defaultDb;
  const quote = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .get();
  if (!quote) throw new Error(`renderQuotePdf: quote ${quoteId} not found`);

  const company = (await database
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get()) as CompanyRow | undefined;
  if (!company) throw new Error(`renderQuotePdf: company ${quote.company_id} not found`);

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, quote.deal_id))
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

  const content = (quote.content_json ?? null) as QuoteContent | null;
  if (!content) throw new Error(`renderQuotePdf: quote ${quoteId} has no content_json`);

  const baseUrl =
    options.appUrlOverride ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3001";
  const trimmedBase = baseUrl.replace(/\/$/, "");
  const quoteUrl = `${trimmedBase}/lite/quotes/${quote.token}`;
  const termsUrl = `${trimmedBase}/lite/legal/terms`;

  const scopeSummary = (() => {
    const items = content.sections.whatWellDo.line_items
      .map((l) => l.snapshot.name)
      .filter(Boolean);
    if (items.length === 0) return null;
    const joined = items.slice(0, 4).join(", ");
    return joined.length > 140 ? `${joined.slice(0, 137)}…` : joined;
  })();

  const html = buildQuotePdfHtml({
    quote,
    company,
    primaryContact,
    content,
    quoteUrl,
    termsUrl,
    scopeSummary,
    coverLine: null,
  });

  const buffer = await renderToPdf(html);
  return {
    buffer,
    filename: quotePdfFilename(company, quote),
    quote,
    company,
  };
}
