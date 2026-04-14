/**
 * POST /api/quotes/[token]/payment-intent
 *
 * Public (no auth) — clients land on `/lite/quotes/[token]` anonymously.
 * Tick-time call from the Quote Web Experience: create or recover a
 * Payment Intent for the canonical `total_cents_inc_gst`, AUD, metadata
 * = { product_type: "quote", quote_id, deal_id, company_id }. Returns
 * clientSecret for the Payment Element to confirm against.
 *
 * Spec: docs/specs/quote-builder.md §7.1 + §7.3 (dynamic-amount PI).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { loadPublicQuoteByToken } from "@/lib/quote-builder/load-public-quote";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;
  const bundle = await loadPublicQuoteByToken(token);
  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { quote, company } = bundle;

  if (company.billing_mode !== "stripe") {
    return NextResponse.json(
      { error: "manual_billed_quote" },
      { status: 400 },
    );
  }
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return NextResponse.json(
      { error: `quote_not_live:${quote.status}` },
      { status: 400 },
    );
  }
  if (quote.expires_at_ms && quote.expires_at_ms < Date.now()) {
    return NextResponse.json({ error: "quote_expired" }, { status: 400 });
  }

  const stripe = getStripe();

  // Reuse existing PI if we've already created one for this quote.
  if (quote.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(
        quote.stripe_payment_intent_id,
      );
      if (
        existing.status !== "succeeded" &&
        existing.status !== "canceled" &&
        existing.amount === quote.total_cents_inc_gst &&
        existing.client_secret
      ) {
        return NextResponse.json({ clientSecret: existing.client_secret });
      }
    } catch {
      // Fall through and create a fresh PI.
    }
  }

  // Resolve customer by primary contact. If no primary contact / no
  // email, fall back to a company-scoped synthetic key so PIs still
  // proceed (subscription creation for retainer will fail later if
  // there's genuinely no customer — that's a spec-level problem, not
  // a PI-route problem).
  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, quote.deal_id))
    .get();
  if (!deal) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  const contactRow = deal.primary_contact_id
    ? await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()
    : null;

  const contactIdForStripe = contactRow?.id ?? `company:${company.id}`;
  const ensured = await ensureStripeCustomer(contactIdForStripe);

  // Attach email / name to the Stripe customer if we have them and
  // this was a fresh create — helps receipts look professional.
  if (ensured.created && contactRow?.email) {
    try {
      await stripe.customers.update(ensured.customerId, {
        email: contactRow.email,
        name: company.name,
      });
    } catch {
      // non-fatal
    }
  }

  const pi = await stripe.paymentIntents.create(
    {
      amount: quote.total_cents_inc_gst,
      currency: "aud",
      customer: ensured.customerId,
      // Allow Apple / Google Pay + cards; Stripe picks based on locale.
      automatic_payment_methods: { enabled: true },
      metadata: {
        product_type: "quote",
        quote_id: quote.id,
        deal_id: quote.deal_id,
        company_id: quote.company_id,
        structure: quote.structure,
      },
    },
    { idempotencyKey: `quote_pi:${quote.id}` },
  );

  // Denormalise PI + customer back to the DB for webhook lookup.
  await db
    .update(quotes)
    .set({ stripe_payment_intent_id: pi.id })
    .where(eq(quotes.id, quote.id));
  await db
    .update(deals)
    .set({ stripe_customer_id: ensured.customerId })
    .where(eq(deals.id, deal.id));

  return NextResponse.json({ clientSecret: pi.client_secret });
}
