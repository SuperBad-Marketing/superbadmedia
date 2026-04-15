/**
 * SaaS tier change + product switch (SB-8).
 *
 * Spec: `docs/specs/saas-subscription-billing.md` §6 (mutations) + §2
 * (tier/product model). Brief: `sessions/sb-8-brief.md`.
 *
 * Two public primitives:
 *   - `applyTierChange(dealId, newTierId, { mode })` — upgrade (immediate,
 *     pro-rated) or downgrade (deferred to period boundary via
 *     `saas_subscription_tier_downgrade_apply` scheduled task).
 *   - `applyProductSwitch(dealId, { newProductId, newTierId, ... })` —
 *     atomic Stripe item swap; local rows mutated inside the same unit.
 *
 * Pre-flight usage check (downgrade only): if any dimension's current
 * usage exceeds the new tier's limit, the primitive returns
 * `{ blocked: true, ... }` without mutating Stripe or the DB. Admins
 * override via `opts.overrideBlock: true`. Subscribers cannot override
 * — per brief §Reconcile, they upgrade or wait for period end.
 *
 * Silent reconciles vs brief (per `feedback_technical_decisions_claude_calls`):
 *   1. Activity-log kinds reuse existing `saas_subscription_upgraded` /
 *      `_downgraded` / `_product_switched` instead of adding the brief's
 *      `saas_tier_changed` / `saas_product_switched` aliases — the
 *      existing set already covers the semantic space. `saas_tier_downgrade_scheduled`
 *      is genuinely new (no existing kind for "deferred swap queued").
 *   2. Product-switch pre-flight is a no-op. Usage is keyed on
 *      `(contactId, productId, dimensionKey)`; switching products
 *      zeroes the tally by definition (brief §Reconcile), so checking
 *      current-product usage against new-tier limits has no meaning.
 *   3. Downgrade timing follows Stripe's `current_period_end` — our
 *      cron fires at Stripe's boundary, then calls
 *      `swapSubscriptionPrice(mode="deferred")` which sets
 *      `billing_cycle_anchor: "unchanged"` so the boundary stays intact.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals, type DealBillingCadence } from "@/lib/db/schema/deals";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import {
  swapSubscriptionPrice,
  switchSubscriptionProduct,
  readCurrentPeriodEndMs,
  type StripeLike,
} from "@/lib/stripe/subscriptions";
import { loadDashboardUsage } from "@/lib/saas-products/usage";

export type TierChangeMode = "upgrade" | "downgrade";

export interface ApplyTierChangeOpts {
  mode: TierChangeMode;
  overrideBlock?: boolean;
  actor?: "subscriber" | "admin" | "system";
  stripeClient?: StripeLike;
  nowMs?: number;
}

export interface BlockedResult {
  blocked: true;
  reason: "usage_over_new_limit";
  dimensions: Array<{
    dimensionKey: string;
    displayName: string;
    used: number;
    newLimit: number | null;
  }>;
}

export interface TierChangeAppliedResult {
  blocked: false;
  scheduledFor: "immediate" | "end_of_period";
  effectiveAtMs: number;
  fromTierId: string | null;
  toTierId: string;
}

export type ApplyTierChangeResult = BlockedResult | TierChangeAppliedResult;

export interface ApplyProductSwitchOpts {
  newProductId: string;
  newTierId: string;
  newBillingCadence?: DealBillingCadence;
  actor?: "subscriber" | "admin" | "system";
  stripeClient?: StripeLike;
  nowMs?: number;
}

export interface ProductSwitchAppliedResult {
  blocked: false;
  effectiveAtMs: number;
  fromProductId: string | null;
  toProductId: string;
  fromTierId: string | null;
  toTierId: string;
}

const TIER_CHANGE_DISABLED = "tier_change_disabled" as const;
const INVALID_STATE = "invalid_subscription_state" as const;

export class TierChangeError extends Error {
  code:
    | typeof TIER_CHANGE_DISABLED
    | typeof INVALID_STATE
    | "deal_not_found"
    | "no_stripe_subscription"
    | "tier_not_found"
    | "same_tier"
    | "mode_mismatch"
    | "price_missing";
  constructor(
    code: TierChangeError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function priceIdForCadence(
  tier: {
    stripe_monthly_price_id: string | null;
    stripe_annual_price_id: string | null;
    stripe_upfront_price_id: string | null;
  },
  cadence: DealBillingCadence | null,
): string | null {
  switch (cadence) {
    case "monthly":
      return tier.stripe_monthly_price_id;
    case "annual_monthly":
      return tier.stripe_annual_price_id;
    case "annual_upfront":
      return tier.stripe_upfront_price_id;
    default:
      return null;
  }
}

export async function applyTierChange(
  dealId: string,
  newTierId: string,
  opts: ApplyTierChangeOpts,
): Promise<ApplyTierChangeResult> {
  if (!killSwitches.saas_tier_change_enabled) {
    throw new TierChangeError(
      TIER_CHANGE_DISABLED,
      "saas_tier_change_enabled kill switch is off",
    );
  }

  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).get();
  if (!deal) throw new TierChangeError("deal_not_found", `deal ${dealId}`);
  if (!deal.stripe_subscription_id) {
    throw new TierChangeError(
      "no_stripe_subscription",
      `deal ${dealId} has no stripe_subscription_id`,
    );
  }
  if (
    deal.subscription_state !== "active" &&
    deal.subscription_state !== null
  ) {
    // Paused / past_due / cancelled etc. → refuse. Caller shows a copy
    // pointer to the billing portal (brief §Reconcile).
    throw new TierChangeError(
      INVALID_STATE,
      `subscription_state=${deal.subscription_state}`,
    );
  }
  if (!deal.saas_product_id) {
    throw new TierChangeError(
      "deal_not_found",
      `deal ${dealId} is not a SaaS deal`,
    );
  }
  if (deal.saas_tier_id === newTierId) {
    throw new TierChangeError("same_tier", `already on tier ${newTierId}`);
  }

  const newTier = await db
    .select()
    .from(saas_tiers)
    .where(eq(saas_tiers.id, newTierId))
    .get();
  if (!newTier || newTier.product_id !== deal.saas_product_id) {
    throw new TierChangeError("tier_not_found", `tier ${newTierId}`);
  }

  let currentTier: typeof newTier | undefined;
  if (deal.saas_tier_id) {
    currentTier = await db
      .select()
      .from(saas_tiers)
      .where(eq(saas_tiers.id, deal.saas_tier_id))
      .get();
  }

  // Mode/rank sanity — reject upgrades that are actually downgrades and
  // vice versa. Keeps misconfigured admin UIs from silently flipping the
  // pro-ration policy.
  if (currentTier) {
    const goingUp = newTier.tier_rank > currentTier.tier_rank;
    if (opts.mode === "upgrade" && !goingUp) {
      throw new TierChangeError(
        "mode_mismatch",
        `upgrade requested but rank ${newTier.tier_rank} <= ${currentTier.tier_rank}`,
      );
    }
    if (opts.mode === "downgrade" && goingUp) {
      throw new TierChangeError(
        "mode_mismatch",
        `downgrade requested but rank ${newTier.tier_rank} >= ${currentTier.tier_rank}`,
      );
    }
  }

  const newPriceId = priceIdForCadence(newTier, deal.billing_cadence);
  if (!newPriceId) {
    throw new TierChangeError(
      "price_missing",
      `no Stripe Price for cadence=${deal.billing_cadence} on tier ${newTierId}`,
    );
  }

  const nowMs = opts.nowMs ?? Date.now();

  // Pre-flight usage check (downgrade only). Upgrades always pass.
  if (opts.mode === "downgrade" && !opts.overrideBlock) {
    const usage = deal.primary_contact_id
      ? await loadDashboardUsage(
          deal.primary_contact_id,
          deal.saas_product_id,
          { nowMs },
        )
      : null;
    if (usage) {
      // Compute new-tier limits by temporarily pretending the deal is on
      // the new tier. Cheapest correct path: re-load dashboard for the
      // subscriber, map current `used` against the new tier's limits.
      const newLimitsByDim = await loadTierLimits(newTierId);
      const offending = usage.dimensions
        .map((d) => {
          const newLimit = newLimitsByDim.get(d.dimensionKey) ?? null;
          if (newLimit === null) return null;
          if (d.used > newLimit) {
            return {
              dimensionKey: d.dimensionKey,
              displayName: d.displayName,
              used: d.used,
              newLimit,
            };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (offending.length > 0) {
        return {
          blocked: true,
          reason: "usage_over_new_limit",
          dimensions: offending,
        };
      }
    }
  }

  if (opts.mode === "upgrade") {
    await swapSubscriptionPrice({
      subscriptionId: deal.stripe_subscription_id,
      newPriceId,
      mode: "immediate",
      stripeClient: opts.stripeClient,
    });

    await db
      .update(deals)
      .set({
        saas_tier_id: newTierId,
        last_stage_change_at_ms: nowMs,
        updated_at_ms: nowMs,
      })
      .where(eq(deals.id, dealId));

    await logActivity({
      companyId: deal.company_id,
      contactId: deal.primary_contact_id ?? null,
      dealId: deal.id,
      kind: "saas_subscription_upgraded",
      body: `Tier upgraded: ${currentTier?.name ?? "—"} → ${newTier.name}.`,
      meta: {
        from_tier_id: currentTier?.id ?? null,
        to_tier_id: newTier.id,
        product_id: deal.saas_product_id,
        actor: opts.actor ?? "subscriber",
        scheduled_for: "immediate",
      },
      createdBy: opts.actor ?? "subscriber",
      createdAtMs: nowMs,
    });

    return {
      blocked: false,
      scheduledFor: "immediate",
      effectiveAtMs: nowMs,
      fromTierId: currentTier?.id ?? null,
      toTierId: newTier.id,
    };
  }

  // Downgrade: queue the deferred apply at Stripe's current period end.
  const effectiveAtMs = await readCurrentPeriodEndMs(
    deal.stripe_subscription_id,
    opts.stripeClient,
  );

  await enqueueTask({
    task_type: "saas_subscription_tier_downgrade_apply",
    runAt: effectiveAtMs,
    payload: {
      deal_id: deal.id,
      to_tier_id: newTier.id,
      new_price_id: newPriceId,
    },
    idempotencyKey: `saas_tier_downgrade:${deal.id}:${effectiveAtMs}`,
  });

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id ?? null,
    dealId: deal.id,
    kind: "saas_tier_downgrade_scheduled",
    body: `Downgrade queued: ${currentTier?.name ?? "—"} → ${newTier.name} at ${new Date(effectiveAtMs).toISOString()}.`,
    meta: {
      from_tier_id: currentTier?.id ?? null,
      to_tier_id: newTier.id,
      product_id: deal.saas_product_id,
      actor: opts.actor ?? "subscriber",
      effective_at_ms: effectiveAtMs,
    },
    createdBy: opts.actor ?? "subscriber",
    createdAtMs: nowMs,
  });

  return {
    blocked: false,
    scheduledFor: "end_of_period",
    effectiveAtMs,
    fromTierId: currentTier?.id ?? null,
    toTierId: newTier.id,
  };
}

async function loadTierLimits(tierId: string): Promise<Map<string, number>> {
  const { saas_tier_limits } = await import(
    "@/lib/db/schema/saas-tier-limits"
  );
  const { saas_usage_dimensions } = await import(
    "@/lib/db/schema/saas-usage-dimensions"
  );
  const rows = await db
    .select({
      key: saas_usage_dimensions.dimension_key,
      limit: saas_tier_limits.limit_value,
    })
    .from(saas_tier_limits)
    .innerJoin(
      saas_usage_dimensions,
      eq(saas_tier_limits.dimension_id, saas_usage_dimensions.id),
    )
    .where(eq(saas_tier_limits.tier_id, tierId));
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.limit !== null) map.set(r.key, r.limit);
  }
  return map;
}

export async function applyProductSwitch(
  dealId: string,
  opts: ApplyProductSwitchOpts,
): Promise<ProductSwitchAppliedResult> {
  if (!killSwitches.saas_tier_change_enabled) {
    throw new TierChangeError(
      TIER_CHANGE_DISABLED,
      "saas_tier_change_enabled kill switch is off",
    );
  }

  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).get();
  if (!deal) throw new TierChangeError("deal_not_found", `deal ${dealId}`);
  if (!deal.stripe_subscription_id) {
    throw new TierChangeError(
      "no_stripe_subscription",
      `deal ${dealId} has no stripe_subscription_id`,
    );
  }
  if (
    deal.subscription_state !== "active" &&
    deal.subscription_state !== null
  ) {
    throw new TierChangeError(
      INVALID_STATE,
      `subscription_state=${deal.subscription_state}`,
    );
  }

  const newTier = await db
    .select()
    .from(saas_tiers)
    .where(
      and(
        eq(saas_tiers.id, opts.newTierId),
        eq(saas_tiers.product_id, opts.newProductId),
      ),
    )
    .get();
  if (!newTier) {
    throw new TierChangeError(
      "tier_not_found",
      `tier ${opts.newTierId} on product ${opts.newProductId}`,
    );
  }

  const cadence = opts.newBillingCadence ?? deal.billing_cadence;
  const newPriceId = priceIdForCadence(newTier, cadence);
  if (!newPriceId) {
    throw new TierChangeError(
      "price_missing",
      `no Stripe Price for cadence=${cadence} on tier ${opts.newTierId}`,
    );
  }

  const nowMs = opts.nowMs ?? Date.now();

  await switchSubscriptionProduct({
    subscriptionId: deal.stripe_subscription_id,
    newPriceId,
    stripeClient: opts.stripeClient,
  });

  const update: Partial<typeof deals.$inferInsert> = {
    saas_product_id: opts.newProductId,
    saas_tier_id: opts.newTierId,
    last_stage_change_at_ms: nowMs,
    updated_at_ms: nowMs,
  };
  if (opts.newBillingCadence) update.billing_cadence = opts.newBillingCadence;

  await db.update(deals).set(update).where(eq(deals.id, dealId));

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id ?? null,
    dealId: deal.id,
    kind: "saas_subscription_product_switched",
    body: `Product switched to ${opts.newProductId} · ${newTier.name}.`,
    meta: {
      from_product_id: deal.saas_product_id,
      to_product_id: opts.newProductId,
      from_tier_id: deal.saas_tier_id,
      to_tier_id: opts.newTierId,
      billing_cadence: cadence,
      actor: opts.actor ?? "subscriber",
    },
    createdBy: opts.actor ?? "subscriber",
    createdAtMs: nowMs,
  });

  return {
    blocked: false,
    effectiveAtMs: nowMs,
    fromProductId: deal.saas_product_id,
    toProductId: opts.newProductId,
    fromTierId: deal.saas_tier_id,
    toTierId: opts.newTierId,
  };
}

