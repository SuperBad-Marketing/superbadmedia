/**
 * SB-7 — `saas_subscription_usage_reset` handler.
 *
 * Fires at each deal's billing-period anniversary. Responsibilities:
 *   1. Compute the freshly-opened period from the deal's anchor +
 *      `Date.now()`. Log a `saas_usage_period_rollover` activity so the
 *      admin trail surfaces the boundary.
 *   2. Enqueue the next rollover at the next period end. Self-chaining
 *      means one seed row per deal is enough forever; the worker loop
 *      keeps it alive.
 *
 * Usage records are NOT mutated — per spec §5.4, tallies are filtered
 * by `billing_period_start_ms` at read time, so the rollover is
 * implicit. This handler exists for observability + re-enqueue
 * (satisfies brief AC #5 + BUILD_PLAN.md cron table).
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { resolveBillingPeriod } from "@/lib/saas-products/usage";

interface UsageResetPayload {
  deal_id: string;
}

export async function handleSaasSubscriptionUsageReset(
  task: ScheduledTaskRow,
): Promise<void> {
  const payload = task.payload as UsageResetPayload | null;
  if (!payload?.deal_id) {
    throw new Error(
      `saas_subscription_usage_reset: missing deal_id on task ${task.id}`,
    );
  }

  const deal = await db
    .select({
      id: deals.id,
      company_id: deals.company_id,
      primary_contact_id: deals.primary_contact_id,
      created_at_ms: deals.created_at_ms,
      saas_product_id: deals.saas_product_id,
      subscription_state: deals.subscription_state,
    })
    .from(deals)
    .where(eq(deals.id, payload.deal_id))
    .get();

  if (!deal || !deal.saas_product_id) {
    // Deal vanished or is no longer a SaaS deal — terminal no-op.
    return;
  }

  const nowMs = Date.now();
  const period = resolveBillingPeriod(deal.created_at_ms, nowMs);

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id ?? null,
    dealId: deal.id,
    kind: "saas_usage_period_rollover",
    body: "Usage period rolled over.",
    meta: {
      period_start_ms: period.startMs,
      period_end_ms: period.endMs,
      product_id: deal.saas_product_id,
    },
  });

  // Self-chain: enqueue next rollover. Idempotent on deal_id + endMs so
  // duplicate fires (stale-reclaim path) don't double-schedule.
  if (isLiveSubscription(deal.subscription_state)) {
    await enqueueTask({
      task_type: "saas_subscription_usage_reset",
      runAt: period.endMs,
      payload: { deal_id: deal.id },
      idempotencyKey: `saas_usage_reset:${deal.id}:${period.endMs}`,
    });
  }
}

function isLiveSubscription(state: string | null): boolean {
  if (!state) return false;
  return state === "active" || state === "past_due" || state === "paused";
}

export const SAAS_SUBSCRIPTION_HANDLERS = {
  saas_subscription_usage_reset: handleSaasSubscriptionUsageReset,
} as const;
