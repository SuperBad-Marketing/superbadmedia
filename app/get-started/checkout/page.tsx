/**
 * `/get-started/checkout` — public subscribe surface.
 *
 * Accepts `?tier={tierId}&product={slug}`. Resolves to a live tier
 * (active product + all three Stripe Prices populated) or redirects to
 * `/get-started/pricing`. Renders three commitment radio cards, an
 * identity block (email + business name), a "Continue to payment" step,
 * then the Stripe Payment Element with voice suppressed.
 *
 * Spec: docs/specs/saas-subscription-billing.md §3.3, §4.1, §4.2, §4.5.
 * Owner: SB-5.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  CHECKOUT_PAGE_METADATA,
  CHECKOUT_HEADER_COPY,
} from "@/lib/content/checkout-page";
import { FOOTER_COPY } from "@/lib/content/pricing-page";
import {
  loadFullSuiteTopTierMonthlyCents,
  loadTierForCheckout,
} from "@/lib/saas-products/queries";
import { auth } from "@/lib/auth/session";
import { deals } from "@/lib/db/schema/deals";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { contacts as contactsTable } from "@/lib/db/schema/contacts";

import { CheckoutClient } from "./clients/checkout-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: CHECKOUT_PAGE_METADATA.title,
  description: CHECKOUT_PAGE_METADATA.description,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  tier?: string | string[];
  product?: string | string[];
}>;

function pickParam(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function authedSubscriberHasExistingSaas(
  userEmail: string | null | undefined,
): Promise<boolean> {
  if (!userEmail) return false;
  const emailNorm = userEmail.trim().toLowerCase();
  const [contact] = await db
    .select({ company_id: contactsTable.company_id })
    .from(contactsTable)
    .where(eq(contactsTable.email_normalised, emailNorm))
    .limit(1);
  if (!contact) return false;
  const existing = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(eq(deals.company_id, contact.company_id), eq(deals.won_outcome, "saas")),
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Cross-product revisit guard — returns true when the authed subscriber
 * already has a live subscription (active / past_due / paused) for
 * `productId`. Redirect → /lite/onboarding so they manage the existing
 * subscription rather than double-subscribing. Different product is
 * still allowed.
 *
 * SB-6b.
 */
async function authedSubscriberHasLiveSubscriptionFor(
  userEmail: string | null | undefined,
  productId: string,
): Promise<boolean> {
  if (!userEmail) return false;
  const emailNorm = userEmail.trim().toLowerCase();
  const [contact] = await db
    .select({ id: contactsTable.id })
    .from(contactsTable)
    .where(eq(contactsTable.email_normalised, emailNorm))
    .limit(1);
  if (!contact) return false;
  const rows = await db
    .select({
      id: deals.id,
      subscription_state: deals.subscription_state,
    })
    .from(deals)
    .where(
      and(
        eq(deals.primary_contact_id, contact.id),
        eq(deals.saas_product_id, productId),
      ),
    );
  return rows.some((r) =>
    r.subscription_state === "active" ||
    r.subscription_state === "past_due" ||
    r.subscription_state === "paused",
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tierId = pickParam(sp.tier);
  const productSlug = pickParam(sp.product);

  if (!tierId || !productSlug) {
    redirect("/get-started/pricing");
  }

  const load = await loadTierForCheckout(tierId, productSlug);
  if (!load) {
    redirect("/get-started/pricing");
  }

  const session = await auth();

  // SB-6b cross-product revisit guard — authed client already subscribed to
  // this exact product (live state) goes to their dashboard instead of
  // double-subscribing. Different product falls through to the nudge below.
  if (session?.user?.role === "client" && session.user.email) {
    const alreadySubscribed = await authedSubscriberHasLiveSubscriptionFor(
      session.user.email,
      load.product.id,
    );
    if (alreadySubscribed) {
      redirect("/lite/onboarding");
    }
  }

  const showFullSuiteNudge =
    session?.user?.role === "client" &&
    load.product.slug !== "full-suite" &&
    (await authedSubscriberHasExistingSaas(session.user.email));

  const fullSuiteMonthlyCents = showFullSuiteNudge
    ? await loadFullSuiteTopTierMonthlyCents()
    : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 md:px-6 md:py-16">
      <header className="mb-8" data-testid="checkout-header">
        <p className="text-foreground/50 mb-2 text-xs uppercase tracking-[0.22em]">
          {CHECKOUT_HEADER_COPY.eyebrow}
        </p>
        <h1
          className="font-heading text-3xl font-semibold tracking-tight md:text-4xl"
          data-testid="checkout-product-name"
        >
          {load.product.name}
        </h1>
        <p
          className="text-foreground/70 mt-1 text-base md:text-lg"
          data-testid="checkout-tier-name"
        >
          {load.tier.name}
        </p>
      </header>

      <CheckoutClient
        productId={load.product.id}
        productSlug={load.product.slug}
        tierId={load.tier.id}
        tierName={load.tier.name}
        monthlyPriceCents={load.tier.monthly_price_cents_inc_gst}
        setupFeeCents={load.tier.setup_fee_cents_inc_gst}
        fullSuiteMonthlyCents={fullSuiteMonthlyCents}
      />

      <p className="text-foreground/50 mt-10 text-xs">
        {FOOTER_COPY.questionsPrefix}
        <a
          href={`mailto:${FOOTER_COPY.supportEmail}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {FOOTER_COPY.supportEmail}
        </a>
      </p>
    </div>
  );
}
