/**
 * /lite/admin/deals/[id]/quotes/[quote_id]/edit — two-pane draft editor.
 * Spec: docs/specs/quote-builder.md §4.1. QB-2a ships left pane + static
 * preview; full motion/debounced preview + Templates/Catalogue CRUD
 * land in QB-2b.
 */
import { redirect, notFound } from "next/navigation";
import { and, eq, isNull, asc } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { quotes } from "@/lib/db/schema/quotes";
import { catalogue_items } from "@/lib/db/schema/catalogue-items";
import { quote_templates } from "@/lib/db/schema/quote-templates";
import { QuoteEditor } from "@/components/lite/quote-builder/quote-editor";
import {
  emptyQuoteContent,
  type QuoteContent,
} from "@/lib/quote-builder/content-shape";
import settings from "@/lib/settings";

export const metadata: Metadata = {
  title: "SuperBad — Quote draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string; quote_id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }
  const { id: dealId, quote_id: quoteId } = await params;

  const quote = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .get();
  if (!quote || quote.deal_id !== dealId) notFound();

  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).get();
  if (!deal) notFound();

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, deal.company_id))
    .get();
  if (!company) notFound();

  const primaryContact = deal.primary_contact_id
    ? (await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  const catalogueRows = await db
    .select()
    .from(catalogue_items)
    .where(isNull(catalogue_items.deleted_at_ms))
    .orderBy(asc(catalogue_items.category), asc(catalogue_items.name));

  const defaultExpiryDays = await settings.get("quote.default_expiry_days");

  const templates = await db
    .select({
      id: quote_templates.id,
      name: quote_templates.name,
      structure: quote_templates.structure,
      term_length_months: quote_templates.term_length_months,
    })
    .from(quote_templates)
    .where(isNull(quote_templates.deleted_at_ms))
    .orderBy(asc(quote_templates.structure), asc(quote_templates.name));

  const content: QuoteContent =
    (quote.content_json as QuoteContent | null) ??
    emptyQuoteContent(defaultExpiryDays);

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] bg-background px-4 py-4">
      <nav className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <Link
          href="/lite/admin/pipeline"
          className="hover:text-foreground"
        >
          ← Pipeline
        </Link>
        <div>
          {quote.quote_number} · {quote.status}
        </div>
      </nav>
      <QuoteEditor
        dealId={deal.id}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        billingMode={company.billing_mode ?? "stripe"}
        dealStage={deal.stage}
        company={{ id: company.id, name: company.name, gst_applicable: company.gst_applicable }}
        primaryContact={
          primaryContact
            ? { id: primaryContact.id, name: primaryContact.name }
            : null
        }
        initialContent={content}
        catalogue={catalogueRows.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          unit: c.unit,
          base_price_cents_inc_gst: c.base_price_cents_inc_gst,
          tier_rank: c.tier_rank,
          description: c.description,
        }))}
        defaultExpiryDays={defaultExpiryDays}
        templates={templates}
      />
    </div>
  );
}
