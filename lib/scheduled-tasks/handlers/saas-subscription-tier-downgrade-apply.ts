/**
 * SB-8 — `saas_subscription_tier_downgrade_apply` handler.
 *
 * Fires at the subscription's current-period boundary (queued by
 * `applyTierChange(...,{mode:"downgrade"})`). Responsibilities:
 *   1. Re-check the deal still exists, is on a Stripe subscription, and
 *      is still `active`. Paused / past_due / cancelled deals no-op.
 *   2. Call `swapSubscriptionPrice(mode="deferred")` which sets
 *      `billing_cycle_anchor: "unchanged"` + `proration_behavior: "none"`
 *      so Stripe swaps the Price without resetting the cycle.
 *   3. Flip `deals.saas_tier_id` locally + log `saas_subscription_downgraded`.
 *
 * Idempotency: the enqueue key is `saas_tier_downgrade:{dealId}:{endMs}`
 * so duplicate fires (stale-reclaim) won't double-schedule. Within the
 * handler, re-running is safe because the Stripe update on the same
 * price is a no-op and the local tier update is already correct.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { logActivity } from "@/lib/activity-log";
import { swapSubscriptionPrice } from "@/lib/stripe/subscriptions";

interface TierDowngradeApplyPayload {
  deal_id: string;
  to_tier_id: string;
  new_price_id: string;
}

export async function handleSaasSubscriptionTierDowngradeApply(
  task: ScheduledTaskRow,
): Promise<void> {
  const payload = task.payload as TierDowngradeApplyPayload | null;
  if (!payload?.deal_id || !payload.to_tier_id || !payload.new_price_id) {
    throw new Error(
      `saas_subscription_tier_downgrade_apply: malformed payload on task ${task.id}`,
    );
  }

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, payload.deal_id))
    .get();
  if (!deal || !deal.stripe_subscription_id) return;
  if (deal.subscription_state && deal.subscription_state !== "active") return;
  if (deal.saas_tier_id === payload.to_tier_id) return;

  const newTier = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.id, payload.to_tier_id))
    .get();
  if (!newTier) return;

  await swapSubscriptionPrice({
    subscriptionId: deal.stripe_subscription_id,
    newPriceId: payload.new_price_id,
    mode: "deferred",
  });

  const nowMs = Date.now();
  const fromTierId = deal.saas_tier_id;

  await db
    .update(deals)
    .set({
      saas_tier_id: payload.to_tier_id,
      last_stage_change_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .where(eq(deals.id, deal.id));

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id ?? null,
    dealId: deal.id,
    kind: "saas_subscription_downgraded",
    body: `Downgrade applied at period boundary: → ${newTier.name}.`,
    meta: {
      from_tier_id: fromTierId,
      to_tier_id: payload.to_tier_id,
      product_id: deal.saas_product_id,
      actor: "system",
      scheduled_for: "end_of_period",
    },
    createdBy: "system",
    createdAtMs: nowMs,
  });
}

export const SAAS_TIER_CHANGE_HANDLERS = {
  saas_subscription_tier_downgrade_apply:
    handleSaasSubscriptionTierDowngradeApply,
} as const;
