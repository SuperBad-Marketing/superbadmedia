"use server";

/**
 * Server Actions for `/get-started/checkout` (SB-5).
 *
 * Single action: `createSaasSubscriptionAction`. Creates Stripe
 * Customer + Subscription (default_incomplete, monthly setup fee via
 * `add_invoice_items`) and writes the local user + company + contact +
 * deal rows inside one transaction. Returns the `clientSecret` so the
 * browser Payment Element can confirm the first invoice's Payment
 * Intent.
 *
 * Spec: docs/specs/saas-subscription-billing.md §3.3, §4.2, §4.5.
 * Predecessor: SB-3 shipped `/get-started/pricing` with live
 * `Get started` CTAs linking here.
 *
 * Rollback (G6): Stripe subscription creation is the outer step. If the
 * local write fails, we cancel the Stripe subscription before returning
 * the error. If Stripe fails, no local rows are written.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema/user";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import type { CommitmentCadence } from "@/lib/content/checkout-page";

const CADENCES = ["monthly", "annual_monthly", "annual_upfront"] as const;

const inputSchema = z.object({
  tierId: z.string().min(1),
  productSlug: z.string().min(1),
  cadence: z.enum(CADENCES),
  email: z.string().email().max(200),
  businessName: z.string().trim().min(1).max(200),
});

export type CreateSaasSubscriptionInput = z.infer<typeof inputSchema>;

export type CreateSaasSubscriptionResult =
  | {
      ok: true;
      clientSecret: string;
      subscriptionId: string;
      dealId: string;
    }
  | { ok: false; reason: string };

function normaliseCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function committedUntilMs(): number {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
}

function priceIdFor(
  tier: { stripe_monthly_price_id: string | null; stripe_annual_price_id: string | null; stripe_upfront_price_id: string | null },
  cadence: CommitmentCadence,
): string | null {
  if (cadence === "monthly") return tier.stripe_monthly_price_id;
  if (cadence === "annual_monthly") return tier.stripe_annual_price_id;
  return tier.stripe_upfront_price_id;
}

export async function createSaasSubscriptionAction(
  rawInput: unknown,
): Promise<CreateSaasSubscriptionResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const input = parsed.data;

  // 1. Resolve tier + product. Reject if not active or Stripe Prices missing.
  const [tier] = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.id, input.tierId))
    .limit(1);
  if (!tier) return { ok: false, reason: "Tier not found." };

  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, tier.product_id))
    .limit(1);
  if (!product) return { ok: false, reason: "Product not found." };
  if (product.slug !== input.productSlug) {
    return { ok: false, reason: "Product / tier mismatch." };
  }
  if (product.status !== "active") {
    return { ok: false, reason: "This tier isn't available." };
  }
  if (!product.stripe_product_id) {
    return { ok: false, reason: "This tier isn't wired up yet." };
  }

  const priceId = priceIdFor(tier, input.cadence);
  if (!priceId) {
    return { ok: false, reason: "This commitment isn't available yet." };
  }

  // 2. Find-or-create local user + company + contact.
  const nowMs = Date.now();
  const emailNorm = normaliseEmail(input.email);
  const companyNorm = normaliseCompanyName(input.businessName);

  const [existingUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, emailNorm))
    .limit(1);

  const userId = existingUser?.id ?? randomUUID();

  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.name_normalised, companyNorm))
    .limit(1);

  const companyId = existingCompany?.id ?? randomUUID();

  const [existingContact] = existingCompany
    ? await db
        .select()
        .from(contacts)
        .where(eq(contacts.email_normalised, emailNorm))
        .limit(1)
    : [];

  const contactId = existingContact?.id ?? randomUUID();

  // Write base rows (user / company / contact) outside the Stripe call
  // so ensureStripeCustomer has a contactId to anchor against. If Stripe
  // then fails, these rows are harmless — the user exists as a prospect
  // without a deal.
  try {
    db.transaction((tx) => {
      if (!existingUser) {
        tx.insert(userTable)
          .values({
            id: userId,
            email: emailNorm,
            name: input.businessName.trim(),
            role: "prospect",
            created_at_ms: nowMs,
          })
          .run();
      }
      if (!existingCompany) {
        tx.insert(companies)
          .values({
            id: companyId,
            name: input.businessName.trim(),
            name_normalised: companyNorm,
            first_seen_at_ms: nowMs,
            created_at_ms: nowMs,
            updated_at_ms: nowMs,
          })
          .run();
      }
      if (!existingContact) {
        tx.insert(contacts)
          .values({
            id: contactId,
            company_id: companyId,
            name: input.businessName.trim(),
            email: emailNorm,
            email_normalised: emailNorm,
            is_primary: true,
            created_at_ms: nowMs,
            updated_at_ms: nowMs,
          })
          .run();
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Couldn't save your details: ${message}` };
  }

  // 3. Ensure Stripe Customer + attach email/name.
  const stripe = getStripe();
  let customerId: string;
  try {
    const result = await ensureStripeCustomer(contactId);
    customerId = result.customerId;
    await stripe.customers.update(customerId, {
      email: emailNorm,
      name: input.businessName.trim(),
    });
    if (!existingContact) {
      await db
        .update(contacts)
        .set({ stripe_customer_id: customerId, updated_at_ms: nowMs })
        .where(eq(contacts.id, contactId));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Stripe customer setup failed: ${message}` };
  }

  // 4. Create Stripe Subscription (default_incomplete).
  const committedUntilDateMs =
    input.cadence === "monthly" ? null : committedUntilMs();

  let subscriptionId: string;
  let clientSecret: string;
  try {
    const subscriptionParams: Parameters<typeof stripe.subscriptions.create>[0] =
      {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          lite_tier_id: tier.id,
          lite_product_id: product.id,
          lite_product_slug: product.slug,
          lite_cadence: input.cadence,
          lite_contact_id: contactId,
          lite_company_id: companyId,
        },
      };

    if (input.cadence === "monthly" && tier.setup_fee_cents_inc_gst > 0) {
      subscriptionParams.add_invoice_items = [
        {
          price_data: {
            currency: "aud",
            product: product.stripe_product_id,
            unit_amount: tier.setup_fee_cents_inc_gst,
          },
          quantity: 1,
        },
      ];
    }

    const sub = await stripe.subscriptions.create(subscriptionParams);
    subscriptionId = sub.id;

    const latestInvoice = sub.latest_invoice;
    const pi =
      latestInvoice &&
      typeof latestInvoice === "object" &&
      "payment_intent" in latestInvoice
        ? latestInvoice.payment_intent
        : null;
    const secret =
      pi && typeof pi === "object" && "client_secret" in pi
        ? (pi.client_secret as string | null)
        : null;
    if (!secret) {
      throw new Error("No client_secret on first invoice.");
    }
    clientSecret = secret;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Stripe subscription failed: ${message}` };
  }

  // 5. Write the deal row + activity log. Local-write failure = cancel
  //    the Stripe subscription we just created and bail (G6).
  const dealId = randomUUID();
  try {
    db.transaction((tx) => {
      tx.insert(deals)
        .values({
          id: dealId,
          company_id: companyId,
          primary_contact_id: contactId,
          title: `${product.name} — ${tier.name} (${input.cadence})`,
          stage: "won",
          value_cents: tier.monthly_price_cents_inc_gst,
          value_estimated: false,
          won_outcome: "saas",
          next_action_text: null,
          last_stage_change_at_ms: nowMs,
          source: "get-started-checkout",
          subscription_state: "active",
          committed_until_date_ms: committedUntilDateMs,
          pause_used_this_commitment: false,
          billing_cadence: input.cadence,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          saas_product_id: product.id,
          saas_tier_id: tier.id,
          created_at_ms: nowMs,
          updated_at_ms: nowMs,
        })
        .run();

      tx.insert(activity_log)
        .values({
          id: randomUUID(),
          company_id: companyId,
          contact_id: contactId,
          deal_id: dealId,
          kind: "saas_subscription_created",
          body: `SaaS subscription created: ${product.name} / ${tier.name} (${input.cadence}).`,
          meta: {
            product_id: product.id,
            product_slug: product.slug,
            tier_id: tier.id,
            cadence: input.cadence,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            monthly_price_cents: tier.monthly_price_cents_inc_gst,
            setup_fee_cents:
              input.cadence === "monthly" ? tier.setup_fee_cents_inc_gst : 0,
          },
          created_at_ms: nowMs,
          created_by: userId,
        })
        .run();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch {
      // Swallow: local write already failed; we surface the local error.
    }
    return {
      ok: false,
      reason: `Couldn't finalise the subscription: ${message}`,
    };
  }

  return { ok: true, clientSecret, subscriptionId, dealId };
}
