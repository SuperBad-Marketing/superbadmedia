"use server";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { eq, and } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";

export type PackageData = {
  dealType: "retainer" | "saas" | "project";
  dealTitle: string;
  valueCents: number | null;
  billingCadence: "monthly" | "annual_monthly" | "annual_upfront" | null;
  subscriptionState: string;
  committedUntilMs: number | null;
  pauseUsed: boolean;
  productName: string | null;
  tierName: string | null;
};

export async function fetchPackageData(): Promise<PackageData | null> {
  const session = await getPortalSession();
  if (!session) throw new Error("No portal session");

  const [contact] = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contact?.company_id) return null;

  const [deal] = await db
    .select({
      title: deals.title,
      won_outcome: deals.won_outcome,
      value_cents: deals.value_cents,
      billing_cadence: deals.billing_cadence,
      subscription_state: deals.subscription_state,
      committed_until_date_ms: deals.committed_until_date_ms,
      pause_used_this_commitment: deals.pause_used_this_commitment,
      saas_product_id: deals.saas_product_id,
      saas_tier_id: deals.saas_tier_id,
    })
    .from(deals)
    .where(and(eq(deals.company_id, contact.company_id), eq(deals.stage, "won")))
    .limit(1);

  if (!deal) return null;

  let productName: string | null = null;
  let tierName: string | null = null;

  if (deal.saas_product_id) {
    const [product] = await db
      .select({ name: saas_products.name })
      .from(saas_products)
      .where(eq(saas_products.id, deal.saas_product_id))
      .limit(1);
    productName = product?.name ?? null;
  }

  if (deal.saas_tier_id) {
    const [tier] = await db
      .select({ name: saas_tiers.name })
      .from(saas_tiers)
      .where(eq(saas_tiers.id, deal.saas_tier_id))
      .limit(1);
    tierName = tier?.name ?? null;
  }

  return {
    dealType: deal.won_outcome ?? "retainer",
    dealTitle: deal.title,
    valueCents: deal.value_cents,
    billingCadence: deal.billing_cadence,
    subscriptionState: deal.subscription_state ?? "active_current",
    committedUntilMs: deal.committed_until_date_ms,
    pauseUsed: deal.pause_used_this_commitment,
    productName,
    tierName,
  };
}
