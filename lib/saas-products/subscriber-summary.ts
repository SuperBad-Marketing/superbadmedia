/**
 * SaaS subscriber summary — shared loader for `/lite/onboarding` +
 * cross-product checkout guard.
 *
 * Returns the subscriber's latest SaaS deal + product/tier names +
 * subscription state + stripe customer id (for billing-portal links).
 * Returns `null` when the authed user has no SaaS deal on file.
 *
 * Owners: SB-6a (extracted), SB-6b (extended shape + reused in checkout).
 */
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";

export type SubscriberSummary = {
  dealId: string;
  productId: string;
  productSlug: string;
  productName: string;
  tierName: string | null;
  billingCadence: string | null;
  subscriptionState: string | null;
  stripeCustomerId: string | null;
};

export async function loadSubscriberSummary(
  email: string,
): Promise<SubscriberSummary | null> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return null;

  const contact = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email_normalised, emailNorm))
    .get();
  if (!contact) return null;

  const deal = await db
    .select({
      id: deals.id,
      saas_product_id: deals.saas_product_id,
      saas_tier_id: deals.saas_tier_id,
      billing_cadence: deals.billing_cadence,
      subscription_state: deals.subscription_state,
      stripe_customer_id: deals.stripe_customer_id,
    })
    .from(deals)
    .where(eq(deals.primary_contact_id, contact.id))
    .orderBy(desc(deals.created_at_ms))
    .limit(1)
    .get();
  if (!deal?.saas_product_id) return null;

  const product = await db
    .select({ slug: saas_products.slug, name: saas_products.name })
    .from(saas_products)
    .where(eq(saas_products.id, deal.saas_product_id))
    .get();
  const tier = deal.saas_tier_id
    ? await db
        .select({ name: saas_tiers.name })
        .from(saas_tiers)
        .where(eq(saas_tiers.id, deal.saas_tier_id))
        .get()
    : null;

  return {
    dealId: deal.id,
    productId: deal.saas_product_id,
    productSlug: product?.slug ?? "",
    productName: product?.name ?? "SuperBad",
    tierName: tier?.name ?? null,
    billingCadence: deal.billing_cadence,
    subscriptionState: deal.subscription_state,
    stripeCustomerId: deal.stripe_customer_id,
  };
}

export function cadenceLabel(c: string | null): string {
  if (c === "annual_upfront") return "Annual — paid upfront";
  if (c === "annual_monthly") return "Annual — billed monthly";
  if (c === "monthly") return "Monthly";
  return "—";
}
