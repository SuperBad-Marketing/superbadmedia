/**
 * /lite/quotes/[token] — client-facing quote page per spec §4.3.
 *
 * QB-4a slice: full scroll-snap experience for `sent` / `viewed`,
 * status-card variants for `expired` / `withdrawn` / `superseded` /
 * `accepted`. View tracking runs on first fetch from `sent`. Accept
 * action is stubbed — Payment Element + Stripe wiring is QB-4c.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { loadPublicQuoteByToken } from "@/lib/quote-builder/load-public-quote";
import { markQuoteViewed } from "@/lib/quote-builder/view-tracking";
import { QuoteWebExperience } from "@/components/lite/quote-builder/quote-web-experience";
import {
  QuoteStatusCard,
  type QuoteStatusCardVariant,
} from "@/components/lite/quote-builder/quote-status-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const bundle = await loadPublicQuoteByToken(token);
  if (!bundle) {
    return { title: "SuperBad", robots: { index: false, follow: false } };
  }
  return {
    title: `Quote ${bundle.quote.quote_number} — SuperBad`,
    description: `Quote for ${bundle.company.name}`,
    robots: { index: false, follow: false },
  };
}

const STATUS_TO_CARD: Partial<Record<string, QuoteStatusCardVariant>> = {
  expired: "expired",
  withdrawn: "withdrawn",
  superseded: "superseded",
};

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await loadPublicQuoteByToken(token);
  if (!bundle) notFound();

  const { quote, company, primaryContact, content, supersededByToken } = bundle;

  // Server-side expiry guard: a `sent`/`viewed` quote past its
  // `expires_at_ms` should render the expired card even before the
  // worker flips the status. The worker will catch up; this is the
  // user-facing safety net.
  const isStaleExpired =
    (quote.status === "sent" || quote.status === "viewed") &&
    quote.expires_at_ms != null &&
    quote.expires_at_ms < Date.now();

  if (isStaleExpired) {
    return <QuoteStatusCard variant="expired" />;
  }

  const cardVariant = STATUS_TO_CARD[quote.status];
  if (cardVariant) {
    return (
      <QuoteStatusCard
        variant={cardVariant}
        supersededByToken={supersededByToken}
      />
    );
  }

  if (quote.status === "accepted") {
    return (
      <QuoteStatusCard
        variant="accepted"
        acceptedAtMs={quote.accepted_at_ms}
      />
    );
  }

  // sent | viewed → render the live experience. Run view tracking
  // before rendering so the deal cockpit picks up the badge on the
  // same tick. `markQuoteViewed` is a no-op if already viewed.
  await markQuoteViewed({
    id: quote.id,
    status: quote.status,
    company_id: quote.company_id,
    deal_id: quote.deal_id,
  });

  const primaryContactFirstName =
    primaryContact?.name?.split(/\s+/)[0] ?? null;

  return (
    <QuoteWebExperience
      token={quote.token}
      status={quote.status}
      quoteNumber={quote.quote_number}
      companyName={company.name}
      primaryContactFirstName={primaryContactFirstName}
      content={content}
      termLengthMonths={quote.term_length_months}
      retainerMonthlyCents={quote.retainer_monthly_cents_inc_gst}
      oneOffCents={quote.one_off_cents_inc_gst}
      totalCents={quote.total_cents_inc_gst}
      expiresAtMs={quote.expires_at_ms}
      paymentMode={company.billing_mode}
    />
  );
}
