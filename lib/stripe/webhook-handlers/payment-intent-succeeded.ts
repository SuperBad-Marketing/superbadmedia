import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { finaliseDealAsWon } from "@/lib/crm/finalise-deal";
import { logActivity } from "@/lib/activity-log";
import { enqueueStripeSettleEmail } from "@/lib/quote-builder/accept";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandlePISucceededOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

/**
 * `payment_intent.succeeded` —
 *   - `metadata.product_type = "quote"` (QB-4c): create Stripe Subscription
 *     for retainer/mixed, stamp `stripe_subscription_id`, transition
 *     deal → won, enqueue settle email.
 *   - Any other `product_type` (Checkout Session flows): covered by
 *     `checkout.session.completed` already — skipped for idempotency.
 */
export async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  opts: HandlePISucceededOpts,
): Promise<DispatchOutcome> {
  const productType = pi.metadata?.product_type;
  if (productType !== "quote") {
    return { result: "skipped", error: "covered_by_checkout_session" };
  }

  const quoteId = pi.metadata?.quote_id;
  const dealId = pi.metadata?.deal_id;
  if (!quoteId || !dealId) {
    return { result: "error", error: "missing_metadata.quote_or_deal_id" };
  }

  const database = opts.dbArg ?? defaultDb;

  const quote = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .get();
  if (!quote) {
    return { result: "error", error: `quote_not_found:${quoteId}` };
  }

  // Quote must already be `accepted` (acceptQuoteAction runs before the
  // Payment Element confirms). If not, something skipped ahead — record
  // + continue; the proof-of-acceptance gate is the client surface, not
  // the webhook.
  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.id, dealId))
    .get();
  if (!deal) {
    return { result: "error", error: `deal_not_found:${dealId}` };
  }
  const company = await database
    .select()
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get();
  const primaryContact = deal.primary_contact_id
    ? (await database
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) ?? null
    : null;

  const nowMs = opts.nowMs ?? Date.now();
  const amount = pi.amount ?? quote.total_cents_inc_gst;

  // Log settle.
  await logActivity({
    companyId: quote.company_id,
    dealId: quote.deal_id,
    kind: "quote_settled",
    body: `Payment received for ${quote.quote_number}.`,
    meta: {
      quote_id: quote.id,
      stripe_payment_intent_id: pi.id,
      amount_total: amount,
      currency: pi.currency,
      event_id: opts.eventId,
    },
  });

  // Deal → won. Map structure to DEAL_WON_OUTCOMES.
  const won_outcome =
    quote.structure === "retainer"
      ? "retainer"
      : "project"; // project + mixed both stamp as `project` for the outcome column
  if (deal.stage !== "won") {
    try {
      finaliseDealAsWon(
        deal.id,
        { won_outcome, value_cents: amount },
        {
          by: "stripe_webhook",
          meta: {
            source: "quote_payment_intent_succeeded",
            quote_id: quote.id,
            event_id: opts.eventId,
          },
          nowMs,
        },
        database,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logActivity({
        companyId: quote.company_id,
        dealId: quote.deal_id,
        kind: "note",
        body: `quote_settled: finaliseDealAsWon skipped — ${message}`,
        meta: { quote_id: quote.id, kind: "quote_settle_won_skipped" },
      });
    }
  }

  // Create Stripe Subscription for retainer / mixed.
  if (
    (quote.structure === "retainer" || quote.structure === "mixed") &&
    !quote.stripe_subscription_id &&
    pi.customer &&
    quote.retainer_monthly_cents_inc_gst &&
    quote.retainer_monthly_cents_inc_gst > 0
  ) {
    try {
      const { getStripe } = await import("@/lib/stripe/client");
      const stripe = getStripe();
      const customerId =
        typeof pi.customer === "string" ? pi.customer : pi.customer.id;

      // Plain rolling subscription — commitment enforced at the UX layer
      // via the cancel flow (§7.1). Product is created per-quote so we
      // don't maintain a separate Stripe Product catalogue.
      const product = await stripe.products.create({
        name: `SuperBad retainer — ${company?.name ?? quote.company_id}`,
        metadata: { quote_id: quote.id, deal_id: quote.deal_id },
      });
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price_data: {
              currency: "aud",
              product: product.id,
              recurring: { interval: "month" },
              unit_amount: quote.retainer_monthly_cents_inc_gst,
            },
          },
        ],
        metadata: {
          quote_id: quote.id,
          deal_id: quote.deal_id,
          committed_until_date: quote.committed_until_date_ms
            ? new Date(quote.committed_until_date_ms).toISOString()
            : "",
        },
      });

      await database
        .update(quotes)
        .set({ stripe_subscription_id: sub.id })
        .where(eq(quotes.id, quote.id));
      await database
        .update(deals)
        .set({
          stripe_subscription_id: sub.id,
          subscription_state: "active",
          committed_until_date_ms: quote.committed_until_date_ms ?? null,
        })
        .where(eq(deals.id, deal.id));

      await logActivity({
        companyId: quote.company_id,
        dealId: quote.deal_id,
        kind: "note",
        body: `Retainer subscription created (${sub.id}).`,
        meta: {
          kind: "subscription_started",
          quote_id: quote.id,
          stripe_subscription_id: sub.id,
          event_id: opts.eventId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logActivity({
        companyId: quote.company_id,
        dealId: quote.deal_id,
        kind: "note",
        body: `Subscription create failed for quote ${quote.quote_number}: ${message}`,
        meta: { quote_id: quote.id, kind: "quote_subscription_create_failed" },
      });
    }
  }

  // Settle email (transactional, idempotent).
  if (company) {
    await enqueueStripeSettleEmail({ quote, company, primaryContact });
  }

  return { result: "ok" };
}
