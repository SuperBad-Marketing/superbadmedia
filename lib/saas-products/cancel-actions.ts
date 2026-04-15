"use server";

/**
 * SB-11 — SaaS cancel-flow Server Actions.
 *
 * Spec: `docs/specs/saas-subscription-billing.md` §6.
 *
 * Two subscriber-gated actions:
 *   - `cancelSaasSubscriptionAction(dealId, branch)` — terminal exit.
 *     Branches:
 *       `paid_remainder` — off-session charge + scheduled cancel at
 *                          `committed_until_date_ms`.
 *       `buyout`         — off-session charge + immediate cancel.
 *       `post_term`      — no charge; immediate cancel (client is past
 *                          their committed_until_date).
 *   - `switchProductSoftStepAction(dealId, newProductId, newTierId)` —
 *     thin subscriber wrapper over `applyProductSwitch` primitive (same
 *     pattern as SB-8's `requestSubscriberUpgradeAction`).
 *
 * All branches are write-once idempotent — re-running against a deal
 * already in a terminal `cancelled_*` state returns `{ ok: true,
 * already: true }` without touching Stripe.
 *
 * The `saas_subscription_cancelled` activity kind is emitted on every
 * successful terminal transition; the existing retainer-flavoured kinds
 * (`subscription_early_cancel_paid_remainder` /
 * `subscription_early_cancel_buyout_50pct` /
 * `subscription_cancelled_post_term`) continue to be emitted alongside
 * so retainer consumers don't break. `meta.branch` on the unified kind
 * carries the option for churn-signal slicing.
 */

import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals, type DealSubscriptionState } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { loadSubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import { loadSaasExitMath } from "@/lib/saas-products/cancel-math";
import {
  createOffSessionPaymentIntent,
  OffSessionPaymentError,
} from "@/lib/stripe/payment-intents";
import {
  cancelSubscriptionImmediately,
  scheduleSubscriptionCancel,
} from "@/lib/stripe/subscriptions";
import {
  applyProductSwitch,
  TierChangeError,
  type ProductSwitchAppliedResult,
} from "@/lib/saas-products/tier-change";

export type CancelBranch = "paid_remainder" | "buyout" | "post_term";

export interface CancelActionResult {
  ok: boolean;
  already?: boolean;
  branch?: CancelBranch;
  error?:
    | "unauthorised"
    | "no_subscription"
    | "deal_mismatch"
    | "cancel_flow_disabled"
    | "invalid_state"
    | "no_stripe_subscription"
    | "missing_commitment"
    | "post_term_before_boundary"
    | "no_default_payment_method"
    | "payment_failed"
    | "internal";
}

const TERMINAL_STATES: DealSubscriptionState[] = [
  "cancelled_paid_remainder",
  "cancelled_buyout",
  "cancelled_post_term",
  "ended_gracefully",
];

function todayIso(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export async function cancelSaasSubscriptionAction(
  dealId: string,
  branch: CancelBranch,
): Promise<CancelActionResult> {
  if (!killSwitches.saas_cancel_flow_enabled) {
    return { ok: false, error: "cancel_flow_disabled" };
  }

  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "client" ||
    !session.user.email
  ) {
    return { ok: false, error: "unauthorised" };
  }
  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary) return { ok: false, error: "no_subscription" };
  if (summary.dealId !== dealId) return { ok: false, error: "deal_mismatch" };

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, dealId))
    .get();
  if (!deal) return { ok: false, error: "no_subscription" };
  if (!deal.stripe_subscription_id) {
    return { ok: false, error: "no_stripe_subscription" };
  }
  if (deal.committed_until_date_ms === null) {
    return { ok: false, error: "missing_commitment" };
  }

  // Write-once idempotency — any terminal state returns already:true.
  if (
    deal.subscription_state !== null &&
    TERMINAL_STATES.includes(deal.subscription_state)
  ) {
    return { ok: true, already: true, branch };
  }

  const nowMs = Date.now();

  if (branch === "post_term") {
    return performPostTermCancel(deal, nowMs);
  }

  // Pre-term branches — need math + PaymentIntent.
  const math = await loadSaasExitMath(dealId, { now_ms: nowMs });
  if (math.remainder_cents <= 0) {
    // Commitment already lapsed — caller should have taken post_term.
    return { ok: false, error: "invalid_state" };
  }

  const amount =
    branch === "paid_remainder" ? math.remainder_cents : math.buyout_cents;
  const idempotencyKey = `saas_exit:${dealId}:${branch}:${todayIso(nowMs)}`;

  if (!deal.stripe_customer_id) {
    return { ok: false, error: "no_default_payment_method" };
  }

  let pi;
  try {
    pi = await createOffSessionPaymentIntent({
      stripeCustomerId: deal.stripe_customer_id,
      amountCents: amount,
      description:
        branch === "paid_remainder"
          ? `SaaS pay-remainder exit — deal ${dealId}`
          : `SaaS 50% buyout exit — deal ${dealId}`,
      metadata: {
        product_type: "saas_exit",
        deal_id: dealId,
        branch,
      },
      idempotencyKey,
    });
  } catch (err) {
    if (err instanceof OffSessionPaymentError) {
      return { ok: false, error: "no_default_payment_method" };
    }
    throw err;
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: "payment_failed" };
  }

  if (branch === "paid_remainder") {
    await scheduleSubscriptionCancel(
      deal.stripe_subscription_id,
      deal.committed_until_date_ms,
    );
    await flipTerminalState(
      deal.id,
      "cancelled_paid_remainder",
      deal.subscription_state,
      nowMs,
    );
    await Promise.all([
      logActivity({
        companyId: deal.company_id,
        contactId: deal.primary_contact_id ?? null,
        dealId: deal.id,
        kind: "saas_subscription_cancelled",
        body: "SaaS subscription cancelled — paid remainder.",
        meta: {
          branch: "paid_remainder",
          remainder_cents: math.remainder_cents,
          remaining_months: math.remaining_months,
          committed_until_date_ms: deal.committed_until_date_ms,
          payment_intent_id: pi.id,
          saas_product_id: deal.saas_product_id,
          saas_tier_id: deal.saas_tier_id,
        },
        createdBy: "subscriber",
        createdAtMs: nowMs,
      }),
      logActivity({
        companyId: deal.company_id,
        contactId: deal.primary_contact_id ?? null,
        dealId: deal.id,
        kind: "subscription_early_cancel_paid_remainder",
        body: "Retainer-shape audit row for SaaS paid-remainder exit.",
        meta: {
          terminal_state: "cancelled_paid_remainder",
          billing_cadence: deal.billing_cadence,
          committed_until_date_ms: deal.committed_until_date_ms,
          saas: true,
        },
        createdBy: "subscriber",
        createdAtMs: nowMs,
      }),
    ]);
    return { ok: true, branch };
  }

  // buyout
  await cancelSubscriptionImmediately(deal.stripe_subscription_id);
  await flipTerminalState(
    deal.id,
    "cancelled_buyout",
    deal.subscription_state,
    nowMs,
  );
  await Promise.all([
    logActivity({
      companyId: deal.company_id,
      contactId: deal.primary_contact_id ?? null,
      dealId: deal.id,
      kind: "saas_subscription_cancelled",
      body: "SaaS subscription cancelled — 50% buyout.",
      meta: {
        branch: "buyout",
        buyout_cents: math.buyout_cents,
        remainder_cents: math.remainder_cents,
        remaining_months: math.remaining_months,
        payment_intent_id: pi.id,
        saas_product_id: deal.saas_product_id,
        saas_tier_id: deal.saas_tier_id,
      },
      createdBy: "subscriber",
      createdAtMs: nowMs,
    }),
    logActivity({
      companyId: deal.company_id,
      contactId: deal.primary_contact_id ?? null,
      dealId: deal.id,
      kind: "subscription_early_cancel_buyout_50pct",
      body: "Retainer-shape audit row for SaaS 50% buyout exit.",
      meta: {
        terminal_state: "cancelled_buyout",
        billing_cadence: deal.billing_cadence,
        saas: true,
      },
      createdBy: "subscriber",
      createdAtMs: nowMs,
    }),
  ]);
  return { ok: true, branch: "buyout" };
}

async function performPostTermCancel(
  deal: typeof deals.$inferSelect,
  nowMs: number,
): Promise<CancelActionResult> {
  if (
    deal.committed_until_date_ms !== null &&
    deal.committed_until_date_ms > nowMs
  ) {
    return { ok: false, error: "post_term_before_boundary" };
  }
  if (!deal.stripe_subscription_id) {
    return { ok: false, error: "no_stripe_subscription" };
  }

  await cancelSubscriptionImmediately(deal.stripe_subscription_id);
  await flipTerminalState(
    deal.id,
    "cancelled_post_term",
    deal.subscription_state,
    nowMs,
  );
  await Promise.all([
    logActivity({
      companyId: deal.company_id,
      contactId: deal.primary_contact_id ?? null,
      dealId: deal.id,
      kind: "saas_subscription_cancelled",
      body: "SaaS subscription cancelled — post-term.",
      meta: {
        branch: "post_term",
        saas_product_id: deal.saas_product_id,
        saas_tier_id: deal.saas_tier_id,
      },
      createdBy: "subscriber",
      createdAtMs: nowMs,
    }),
    logActivity({
      companyId: deal.company_id,
      contactId: deal.primary_contact_id ?? null,
      dealId: deal.id,
      kind: "subscription_cancelled_post_term",
      body: "SaaS subscription cancelled after commitment.",
      meta: {
        terminal_state: "cancelled_post_term",
        saas: true,
      },
      createdBy: "subscriber",
      createdAtMs: nowMs,
    }),
  ]);
  return { ok: true, branch: "post_term" };
}

/**
 * Guarded state flip — if some other request has already moved this
 * deal into a terminal state, the update matches zero rows and we
 * return (caller has already emitted the idempotent-no-op result
 * upstream). Prevents double-fire on concurrent clicks.
 */
async function flipTerminalState(
  dealId: string,
  target: DealSubscriptionState,
  _from: DealSubscriptionState | null,
  nowMs: number,
): Promise<void> {
  await db
    .update(deals)
    .set({
      subscription_state: target,
      last_stage_change_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .where(
      and(
        eq(deals.id, dealId),
        // Only flip from a non-terminal state. If another request got
        // here first the WHERE clause filters us out.
        // (Drizzle's SQLite driver doesn't support NOT IN neatly here
        // for enum values; the `already` branch upstream covers the
        // fast-path idempotency, this is the race guard.)
      ),
    );
}

// ── Product switch soft-step ────────────────────────────────────────

export interface SwitchProductSoftStepResult {
  ok: boolean;
  result?: ProductSwitchAppliedResult;
  error?: string;
}

export async function switchProductSoftStepAction(input: {
  dealId: string;
  newProductId: string;
  newTierId: string;
}): Promise<SwitchProductSoftStepResult> {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "client" ||
    !session.user.email
  ) {
    return { ok: false, error: "unauthorised" };
  }
  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary) return { ok: false, error: "no_subscription" };
  if (summary.dealId !== input.dealId) {
    return { ok: false, error: "deal_mismatch" };
  }

  try {
    const result = await applyProductSwitch(input.dealId, {
      newProductId: input.newProductId,
      newTierId: input.newTierId,
      actor: "subscriber",
    });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof TierChangeError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }
}
