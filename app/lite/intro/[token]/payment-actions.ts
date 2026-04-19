"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_payments } from "@/lib/db/schema/intro-funnel-payments";
import { intro_funnel_config } from "@/lib/db/schema/intro-funnel-config";
import { deals } from "@/lib/db/schema/deals";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { getStripe } from "@/lib/stripe/client";
import { logActivity } from "@/lib/activity-log";

const createPaymentIntentSchema = z.object({
  submissionId: z.string().min(1),
});

export type CreatePaymentIntentResult =
  | { ok: true; clientSecret: string; amountCents: number }
  | { ok: false; reason: string };

export async function createPaymentIntentAction(
  input: z.infer<typeof createPaymentIntentSchema>,
): Promise<CreatePaymentIntentResult> {
  const parsed = createPaymentIntentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "Invalid input." };

  const rows = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, parsed.data.submissionId))
    .limit(1);
  if (rows.length === 0) return { ok: false, reason: "Submission not found." };

  const submission = rows[0];

  if (submission.funnel_state !== "questionnaire_complete") {
    return { ok: false, reason: "Questionnaire not complete." };
  }

  // Check for existing pending payment
  const existingPayments = await db
    .select()
    .from(intro_funnel_payments)
    .where(eq(intro_funnel_payments.submission_id, submission.id))
    .limit(1);
  if (existingPayments.length > 0 && existingPayments[0].status === "pending") {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(
      existingPayments[0].stripe_payment_intent_id,
    );
    if (pi.client_secret && pi.status !== "canceled") {
      return {
        ok: true,
        clientSecret: pi.client_secret,
        amountCents: existingPayments[0].amount_cents,
      };
    }
  }

  // Load price from config
  const configRows = await db
    .select()
    .from(intro_funnel_config)
    .limit(1);
  const priceCents = configRows[0]?.price_cents ?? 29700;
  const currency = configRows[0]?.currency ?? "aud";

  // Ensure Stripe customer
  const { customerId } = await ensureStripeCustomer(submission.contact_id);

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    customer: customerId,
    amount: priceCents,
    currency,
    metadata: {
      submission_id: submission.id,
      deal_id: submission.deal_id,
      contact_id: submission.contact_id,
      source: "intro_funnel_trial_shoot",
    },
  });

  if (!paymentIntent.client_secret) {
    return { ok: false, reason: "Failed to create payment." };
  }

  const now = Date.now();
  await db.insert(intro_funnel_payments).values({
    id: randomUUID(),
    submission_id: submission.id,
    deal_id: submission.deal_id,
    stripe_payment_intent_id: paymentIntent.id,
    stripe_customer_id: customerId,
    amount_cents: priceCents,
    currency,
    status: "pending",
    created_at_ms: now,
  });

  // Update deal with stripe_customer_id
  await db
    .update(deals)
    .set({ stripe_customer_id: customerId, updated_at_ms: now })
    .where(eq(deals.id, submission.deal_id));

  return {
    ok: true,
    clientSecret: paymentIntent.client_secret,
    amountCents: priceCents,
  };
}

const confirmPaymentSchema = z.object({
  submissionId: z.string().min(1),
  paymentIntentId: z.string().min(1),
});

export async function confirmPaymentAction(
  input: z.infer<typeof confirmPaymentSchema>,
): Promise<{ ok: boolean }> {
  const parsed = confirmPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const now = Date.now();
  const rows = await db
    .select()
    .from(intro_funnel_payments)
    .where(eq(intro_funnel_payments.stripe_payment_intent_id, parsed.data.paymentIntentId))
    .limit(1);
  if (rows.length === 0) return { ok: false };

  const payment = rows[0];

  await db
    .update(intro_funnel_payments)
    .set({ status: "succeeded", paid_at_ms: now })
    .where(eq(intro_funnel_payments.id, payment.id));

  await db
    .update(intro_funnel_submissions)
    .set({
      funnel_state: "paid",
      abandon_sequence_state: "not_applicable",
      last_activity_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(intro_funnel_submissions.id, payment.submission_id));

  await db
    .update(deals)
    .set({ funnel_state: "paid", updated_at_ms: now })
    .where(eq(deals.id, payment.deal_id));

  const submissionRows = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, payment.submission_id))
    .limit(1);

  if (submissionRows.length > 0) {
    await logActivity({
      dealId: payment.deal_id,
      contactId: submissionRows[0].contact_id,
      kind: "intro_funnel_paid",
      body: `Trial shoot payment received — $${(payment.amount_cents / 100).toFixed(2)}`,
      meta: {
        amount_cents: payment.amount_cents,
        stripe_payment_intent_id: parsed.data.paymentIntentId,
      },
    });
  }

  return { ok: true };
}
