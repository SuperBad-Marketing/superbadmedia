/**
 * /lite/admin/deals/[id]/quotes/[quote_id]/edit — two-pane draft editor.
 * Spec: docs/specs/quote-builder.md §4.1.
 *
 * admin-polish-5 (Wave 9): §3 entity-detail header + conditional §11
 * banners (expired/superseded/accepted) + strip `min-h-screen bg-background`
 * (admin-chrome-1 owns root). Editor chrome is owned by `QuoteEditor`.
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
import { quotes, type QuoteStatus } from "@/lib/db/schema/quotes";
import { catalogue_items } from "@/lib/db/schema/catalogue-items";
import { quote_templates } from "@/lib/db/schema/quote-templates";
import { QuoteEditor } from "@/components/lite/quote-builder/quote-editor";
import { QuoteStatusBadge } from "@/components/lite/quote-builder/quote-status-badge";
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

const STATUS_MUTTER: Record<QuoteStatus, string | null> = {
  draft: null,
  sent: "sent · waiting for a read.",
  viewed: "they're reading it.",
  accepted: "signed, sealed.",
  expired: "dormant · the window closed.",
  withdrawn: "pulled · nothing more to see.",
  superseded: "there's a newer version now.",
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

  const replacingQuote =
    quote.status === "superseded" && quote.superseded_by_quote_id
      ? await db
          .select({
            id: quotes.id,
            quote_number: quotes.quote_number,
            deal_id: quotes.deal_id,
          })
          .from(quotes)
          .where(eq(quotes.id, quote.superseded_by_quote_id))
          .get()
      : null;

  const content: QuoteContent =
    (quote.content_json as QuoteContent | null) ??
    emptyQuoteContent(defaultExpiryDays);

  const mutter = STATUS_MUTTER[quote.status];
  const lastEditMs =
    quote.sent_at_ms ??
    quote.viewed_at_ms ??
    quote.accepted_at_ms ??
    quote.created_at_ms;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-10">
      {/* ——— §3 entity-detail header ——— */}
      <div className="pb-3">
        <Link
          href={`/lite/admin/pipeline`}
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.8px" }}
        >
          ← Pipeline
        </Link>
      </div>

      <header className="pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          <span>Admin</span>{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span>Deals</span>{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span>{deal.title}</span>{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">Quote</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            {quote.quote_number}
          </h1>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[15px] leading-[1.55] text-[color:var(--color-neutral-400)]">
          {deal.title}
          {primaryContact ? ` · ${primaryContact.name}` : ""}
          {mutter ? (
            <>
              {" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {mutter}
              </em>
            </>
          ) : null}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[color:var(--color-neutral-500)]">
          <MetaItem label="Company" value={company.name} />
          <MetaItem
            label="Billing"
            value={
              company.billing_mode === "manual" ? "Manual" : "Stripe"
            }
          />
          {quote.expires_at_ms ? (
            <MetaItem
              label={quote.status === "expired" ? "Expired" : "Expires"}
              value={formatDate(quote.expires_at_ms)}
            />
          ) : null}
          <MetaItem label="Last edit" value={formatDate(lastEditMs)} />
        </dl>
      </header>

      {/* ——— §11 status banners ——— */}
      {quote.status === "expired" ? (
        <AlertBanner tone="warm">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Expired
          </div>
          <p className="mt-1 text-[14px] text-[color:var(--color-neutral-300)]">
            The window closed on{" "}
            {quote.expires_at_ms ? formatDate(quote.expires_at_ms) : "this quote"}.
            Supersede with a fresh draft if it&apos;s still live.
          </p>
          <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
            dormant · dates don&apos;t negotiate.
          </p>
        </AlertBanner>
      ) : null}

      {quote.status === "superseded" ? (
        <AlertBanner tone="cool">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Superseded
          </div>
          <p className="mt-1 text-[14px] text-[color:var(--color-neutral-300)]">
            This quote was replaced
            {quote.superseded_at_ms ? ` on ${formatDate(quote.superseded_at_ms)}` : ""}.
            {replacingQuote ? (
              <>
                {" "}
                <Link
                  href={`/lite/admin/deals/${replacingQuote.deal_id}/quotes/${replacingQuote.id}/edit`}
                  className="underline underline-offset-4 transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                >
                  Open {replacingQuote.quote_number} →
                </Link>
              </>
            ) : null}
          </p>
          <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-neutral-500)]">
            the newer one is the one that matters.
          </p>
        </AlertBanner>
      ) : null}

      {quote.status === "accepted" ? (
        <AlertBanner tone="good">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-success)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Accepted
          </div>
          <p className="mt-1 text-[14px] text-[color:var(--color-neutral-300)]">
            Signed
            {quote.accepted_at_ms ? ` on ${formatDate(quote.accepted_at_ms)}` : ""}.
            Editing is locked.
          </p>
          <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
            one in the bank.
          </p>
        </AlertBanner>
      ) : null}

      <QuoteEditor
        dealId={deal.id}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        quoteStatus={quote.status}
        billingMode={company.billing_mode ?? "stripe"}
        dealStage={deal.stage}
        company={{
          id: company.id,
          name: company.name,
          gst_applicable: company.gst_applicable,
        }}
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt
        className="font-[family-name:var(--font-label)] text-[9px] uppercase leading-none text-[color:var(--color-neutral-600)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </dt>
      <dd className="text-[color:var(--color-neutral-300)]">{value}</dd>
    </div>
  );
}

function AlertBanner({
  tone,
  children,
}: {
  tone: "warm" | "cool" | "good";
  children: React.ReactNode;
}) {
  const style =
    tone === "warm"
      ? {
          background:
            "linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))",
          border: "1px solid rgba(178, 40, 72, 0.25)",
        }
      : tone === "good"
      ? {
          background:
            "linear-gradient(135deg, rgba(123,174,126,0.18), rgba(244,160,176,0.05))",
          border: "1px solid rgba(123, 174, 126, 0.30)",
        }
      : {
          background: "rgba(15, 15, 14, 0.45)",
          border: "1px solid rgba(253, 245, 230, 0.05)",
        };
  return (
    <div className="mb-5 rounded-[10px] p-4" style={style}>
      {children}
    </div>
  );
}
