import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema/invoices";
import { stripe_synced_payments } from "@/lib/db/schema/stripe-synced-payments";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { getStripe } from "@/lib/stripe/client";
import { logActivity } from "@/lib/activity-log";

const MS_PER_DAY = 86_400_000;
const DEFAULT_LOOKBACK_DAYS = 7;

export async function syncStripePayments(
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<{ synced: number; skipped: number }> {
  const stripeConn = await db
    .select()
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "stripe-admin"),
        eq(integration_connections.status, "active"),
      ),
    )
    .limit(1);

  if (stripeConn.length === 0) return { synced: 0, skipped: 0 };

  const stripe = getStripe();
  const nowMs = Date.now();
  const cutoffSec = Math.floor((nowMs - lookbackDays * MS_PER_DAY) / 1000);

  const knownPiIds = new Set<string>();

  const invoiceRows = await db
    .select({ pi: invoices.stripe_payment_intent_id })
    .from(invoices)
    .where(eq(invoices.status, "paid"));
  for (const row of invoiceRows) {
    if (row.pi) knownPiIds.add(row.pi);
  }

  const syncedRows = await db
    .select({ pi: stripe_synced_payments.stripe_payment_intent_id })
    .from(stripe_synced_payments);
  for (const row of syncedRows) {
    knownPiIds.add(row.pi);
  }

  let synced = 0;
  let skipped = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Record<string, unknown> = {
      created: { gte: cutoffSec },
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const charges = await stripe.charges.list(
      params as Parameters<typeof stripe.charges.list>[0],
    );

    for (const charge of charges.data) {
      if (charge.status !== "succeeded") {
        skipped++;
        continue;
      }

      const piId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null;

      if (piId && knownPiIds.has(piId)) {
        skipped++;
        continue;
      }

      if (!piId && charge.id && knownPiIds.has(charge.id)) {
        skipped++;
        continue;
      }

      const idempotencyKey = piId ?? charge.id;
      const amountCents = charge.amount;
      const currency = charge.currency;
      const paidAtMs = charge.created * 1000;
      const paymentDate = new Date(paidAtMs).toISOString().slice(0, 10);
      const gstCents = currency === "aud" ? Math.round(amountCents / 11) : 0;

      const customerId = typeof charge.customer === "string"
        ? charge.customer
        : charge.customer?.id ?? null;

      let customerName: string | null = null;
      let customerEmail: string | null = null;
      if (charge.billing_details) {
        customerName = charge.billing_details.name ?? null;
        customerEmail = charge.billing_details.email ?? null;
      }

      const description =
        charge.description ??
        charge.statement_descriptor ??
        `Stripe payment ${idempotencyKey}`;

      const id = crypto.randomUUID();

      try {
        await db.insert(stripe_synced_payments).values({
          id,
          stripe_payment_intent_id: idempotencyKey,
          stripe_charge_id: charge.id,
          stripe_customer_id: customerId,
          amount_cents: amountCents,
          currency,
          description,
          customer_name: customerName,
          customer_email: customerEmail,
          payment_date: paymentDate,
          paid_at_ms: paidAtMs,
          gst_cents: gstCents,
          linked_invoice_id: null,
          linked_deal_id: null,
          created_at_ms: Date.now(),
          updated_at_ms: Date.now(),
        });

        knownPiIds.add(idempotencyKey);
        synced++;
      } catch {
        skipped++;
      }
    }

    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }
  }

  if (synced > 0) {
    await logActivity({
      kind: "note",
      body: `Stripe payment sync: ${synced} new payment(s) imported.`,
      meta: { synced, skipped, lookback_days: lookbackDays },
    });
  }

  return { synced, skipped };
}
