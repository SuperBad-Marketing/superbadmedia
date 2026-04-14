import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import {
  emptyQuoteContent,
  type QuoteContent,
} from "@/lib/quote-builder/content-shape";

export type PublicQuoteBundle = {
  quote: QuoteRow;
  company: CompanyRow;
  primaryContact: ContactRow | null;
  content: QuoteContent;
  /** If superseded, the token of the superseder so the card can link forward. */
  supersededByToken: string | null;
};

/**
 * Token-gated load for the client web page (`/lite/quotes/[token]`) and
 * the PDF route's redirect-card variants. Returns `null` when the token
 * doesn't resolve — the caller renders 404. Drafts also return `null`
 * so they don't surface a public URL before the Send action runs.
 */
export async function loadPublicQuoteByToken(
  token: string,
): Promise<PublicQuoteBundle | null> {
  const quote = await db
    .select()
    .from(quotes)
    .where(eq(quotes.token, token))
    .get();
  if (!quote) return null;
  if (quote.status === "draft") return null;

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, quote.deal_id))
    .get();
  // Deal cascade-deletes quote, so a missing deal here is a true 404.
  if (!deal) return null;

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get();
  if (!company) return null;

  const primaryContact = deal.primary_contact_id
    ? (await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  const content =
    (quote.content_json as QuoteContent | null) ?? emptyQuoteContent(14);

  let supersededByToken: string | null = null;
  if (quote.superseded_by_quote_id) {
    const next = await db
      .select({ token: quotes.token })
      .from(quotes)
      .where(eq(quotes.id, quote.superseded_by_quote_id))
      .get();
    supersededByToken = next?.token ?? null;
  }

  return { quote, company, primaryContact, content, supersededByToken };
}
