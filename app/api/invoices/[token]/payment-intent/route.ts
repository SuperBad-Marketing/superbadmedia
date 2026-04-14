/**
 * POST /api/invoices/[token]/payment-intent
 *
 * Public (no auth) — clients land on `/lite/invoices/[token]`
 * anonymously via the email link. Creates or recovers a PaymentIntent
 * for `invoices.total_cents_inc_gst` AUD with
 * `metadata.product_type = "invoice"`. Returns the clientSecret for the
 * Payment Element to confirm against.
 *
 * Spec: docs/specs/branded-invoicing.md §7.1.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema/invoices";
import { deals } from "@/lib/db/schema/deals";
import { loadPublicInvoiceByToken } from "@/lib/invoicing/load-public-invoice";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;
  const bundle = await loadPublicInvoiceByToken(token);
  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { invoice, company, deal, primaryContact } = bundle;

  if (invoice.status !== "sent" && invoice.status !== "overdue") {
    return NextResponse.json(
      { error: `invoice_not_payable:${invoice.status}` },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  // Reuse an existing PI if we've already created one and it's still
  // usable (same amount, not succeeded/canceled).
  if (invoice.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(
        invoice.stripe_payment_intent_id,
      );
      if (
        existing.status !== "succeeded" &&
        existing.status !== "canceled" &&
        existing.amount === invoice.total_cents_inc_gst &&
        existing.client_secret
      ) {
        return NextResponse.json({ clientSecret: existing.client_secret });
      }
    } catch {
      // Fall through and create a fresh PI.
    }
  }

  const contactIdForStripe = primaryContact?.id ?? `company:${company.id}`;
  const ensured = await ensureStripeCustomer(contactIdForStripe);

  if (ensured.created && primaryContact?.email) {
    try {
      await stripe.customers.update(ensured.customerId, {
        email: primaryContact.email,
        name: company.name,
      });
    } catch {
      // non-fatal
    }
  }

  const pi = await stripe.paymentIntents.create(
    {
      amount: invoice.total_cents_inc_gst,
      currency: "aud",
      customer: ensured.customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        product_type: "invoice",
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        deal_id: invoice.deal_id,
        company_id: invoice.company_id,
      },
    },
    { idempotencyKey: `invoice_pi:${invoice.id}` },
  );

  await db
    .update(invoices)
    .set({ stripe_payment_intent_id: pi.id, updated_at_ms: Date.now() })
    .where(eq(invoices.id, invoice.id));
  if (!deal.stripe_customer_id) {
    await db
      .update(deals)
      .set({ stripe_customer_id: ensured.customerId })
      .where(eq(deals.id, deal.id));
  }

  return NextResponse.json({ clientSecret: pi.client_secret });
}
