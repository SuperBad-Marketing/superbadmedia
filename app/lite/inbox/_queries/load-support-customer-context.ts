import "server-only";
import { and, desc, eq, gte, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals, type DealSubscriptionState, type DealBillingCadence } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { usage_records } from "@/lib/db/schema/usage-records";
import { activity_log, type ActivityLogKind } from "@/lib/db/schema/activity-log";

/**
 * Customer Context panel loader for the support@ ticket overlay
 * (spec §4.3). Composes subscription + usage + activity reads for the
 * contact so the panel can render "who they are, where they are."
 *
 * Brief §4 called for reads against `saas_subscriptions`, but that table
 * doesn't exist — subscription state lives on `deals` (SB-1 owner) +
 * `saas_tiers`. Usage stats live on `usage_records`. Recent activity
 * comes off `activity_log` filtered on `contact_id`.
 *
 * The helper is read-only + cheap: 4 small queries joined in JS. The
 * panel stays collapsed by default, so this runs only when the admin
 * actually opens the panel (lazy via a server action down the road —
 * for UI-10 it runs on page render, which is fine with a single live
 * subscriber).
 */
export interface SupportCustomerContext {
  /**
   * Subscription summary. `null` = the contact has no live SaaS deal
   * (may still be a retainer client — in that case `retainerActive` is
   * true). Panel renders "Not a subscriber" when both are null/false.
   */
  subscription: {
    deal_id: string;
    product_name: string;
    tier_name: string;
    tier_rank: number;
    subscription_state: DealSubscriptionState;
    billing_cadence: DealBillingCadence | null;
    monthly_price_cents_inc_gst: number;
  } | null;
  retainerActive: boolean;
  payments: {
    last_payment_at_ms: number | null;
    payment_failure_count: number;
  };
  usage: {
    thisPeriodTotal: number;
    thisPeriodStartMs: number | null;
    dimensions: Array<{ dimension_key: string; amount: number }>;
  };
  recentActivity: Array<{
    id: string;
    kind: ActivityLogKind;
    body: string;
    created_at_ms: number;
  }>;
}

const PAYMENT_ACTIVITY_KINDS: readonly ActivityLogKind[] = [
  "payment_received",
  "invoice_paid_online",
  "invoice_marked_paid",
];

export async function loadSupportCustomerContext(
  contactId: string,
): Promise<SupportCustomerContext> {
  const [dealRows, paymentActivity, recentActivity] = await Promise.all([
    db
      .select({
        id: deals.id,
        subscription_state: deals.subscription_state,
        billing_cadence: deals.billing_cadence,
        payment_failure_count: deals.payment_failure_count,
        saas_product_id: deals.saas_product_id,
        saas_tier_id: deals.saas_tier_id,
        won_outcome: deals.won_outcome,
      })
      .from(deals)
      .where(eq(deals.primary_contact_id, contactId)),
    db
      .select({
        created_at_ms: activity_log.created_at_ms,
        kind: activity_log.kind,
      })
      .from(activity_log)
      .where(eq(activity_log.contact_id, contactId))
      .orderBy(desc(activity_log.created_at_ms))
      .limit(50),
    db
      .select({
        id: activity_log.id,
        kind: activity_log.kind,
        body: activity_log.body,
        created_at_ms: activity_log.created_at_ms,
      })
      .from(activity_log)
      .where(eq(activity_log.contact_id, contactId))
      .orderBy(desc(activity_log.created_at_ms))
      .limit(5),
  ]);

  const liveSubscriberStates = new Set<DealSubscriptionState>([
    "active",
    "past_due",
    "paused",
    "pending_early_exit",
  ]);
  const activeDeal = dealRows.find(
    (d) =>
      d.subscription_state &&
      liveSubscriberStates.has(d.subscription_state) &&
      d.saas_tier_id &&
      d.saas_product_id,
  );

  let subscription: SupportCustomerContext["subscription"] = null;
  let usage: SupportCustomerContext["usage"] = {
    thisPeriodTotal: 0,
    thisPeriodStartMs: null,
    dimensions: [],
  };

  if (activeDeal?.saas_tier_id && activeDeal.saas_product_id) {
    const [tierRow] = await db
      .select({
        id: saas_tiers.id,
        name: saas_tiers.name,
        tier_rank: saas_tiers.tier_rank,
        monthly_price_cents_inc_gst: saas_tiers.monthly_price_cents_inc_gst,
        product_name: saas_products.name,
      })
      .from(saas_tiers)
      .innerJoin(saas_products, eq(saas_tiers.product_id, saas_products.id))
      .where(eq(saas_tiers.id, activeDeal.saas_tier_id))
      .limit(1);

    if (tierRow) {
      subscription = {
        deal_id: activeDeal.id,
        product_name: tierRow.product_name,
        tier_name: tierRow.name,
        tier_rank: tierRow.tier_rank,
        subscription_state: activeDeal.subscription_state!,
        billing_cadence: activeDeal.billing_cadence,
        monthly_price_cents_inc_gst: tierRow.monthly_price_cents_inc_gst,
      };
    }

    const thisPeriodStartMs = currentPeriodStartMs(Date.now());
    const usageRows = await db
      .select({
        dimension_key: usage_records.dimension_key,
        total: sum(usage_records.amount).as("total"),
      })
      .from(usage_records)
      .where(
        and(
          eq(usage_records.contact_id, contactId),
          eq(usage_records.product_id, activeDeal.saas_product_id),
          gte(usage_records.billing_period_start_ms, thisPeriodStartMs),
        ),
      )
      .groupBy(usage_records.dimension_key);

    const dimensions = usageRows.map((r) => ({
      dimension_key: r.dimension_key,
      amount: Number(r.total ?? 0),
    }));
    usage = {
      thisPeriodTotal: dimensions.reduce((acc, d) => acc + d.amount, 0),
      thisPeriodStartMs,
      dimensions,
    };
  }

  const retainerActive = dealRows.some(
    (d) => d.won_outcome === "retainer" && d.subscription_state === "active",
  );

  const paymentActivityKindSet = new Set<string>(PAYMENT_ACTIVITY_KINDS);
  const lastPaymentEntry = paymentActivity.find((row) =>
    paymentActivityKindSet.has(row.kind),
  );

  return {
    subscription,
    retainerActive,
    payments: {
      last_payment_at_ms: lastPaymentEntry?.created_at_ms ?? null,
      payment_failure_count: activeDeal?.payment_failure_count ?? 0,
    },
    usage,
    recentActivity,
  };
}

/**
 * Approximates the current billing period start as "first of the month
 * (local)". The real period anchor lives on the deal's Stripe
 * subscription; UI-10 surfaces the simpler calendar-month cut since the
 * panel is informational, not transactional. Stripe-anchored periods
 * come via SB-7's own UI when it lands.
 */
function currentPeriodStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
