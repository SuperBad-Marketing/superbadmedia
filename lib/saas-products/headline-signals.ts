/**
 * SaaS admin cockpit headline signals (SB-10).
 *
 * Spec: `docs/specs/saas-subscription-billing.md` §8.1 (product admin index
 * summary cards) + §8.3 (product detail Overview) + §13.8 (Daily Cockpit
 * HealthBanner contract).
 *
 * Exposes three read-only primitives:
 *   - `getSaasHeadlineSignals({ userId?, windowDays? })` — platform-wide
 *     signals powering `/lite/admin/products` headlines strip.
 *   - `getSaasHeadlineSignalsForProduct(productId, { windowDays? })` —
 *     per-product slice powering `/lite/admin/products/[id]` Overview.
 *   - `getSaasHealthBanners(userId)` — Daily Cockpit source contract stub
 *     (shape per `docs/specs/daily-cockpit.md` §6 HealthBanner) emitting
 *     warning on past-due, critical on 7-day data-loss warnings sent.
 *
 * Silent reconciles (per `feedback_technical_decisions_claude_calls`):
 *   1. MRR reads `saas_tiers.monthly_price_cents_inc_gst` for every
 *      billing cadence — the only price column on the tier row and already
 *      monthly-normalised inc-GST. Brief named `stripe_*_price_amount_cents`
 *      columns that don't exist; no divide-by-12 needed.
 *   2. `saas_subscription_cancelled` activity-log kind isn't registered.
 *      Churn falls back to counting `deals` where `subscription_state`
 *      entered a terminal state (`cancelled_paid_remainder`,
 *      `cancelled_buyout`, `cancelled_post_term`, `ended_gracefully`)
 *      within the window, using `updated_at_ms` as a proxy for cancel
 *      time. Precision upgrade tracked in PATCHES_OWED.
 *   3. HealthBanner severity reads `'warning' | 'critical'` per the
 *      canonical Daily Cockpit spec shape; brief said amber/red.
 *   4. MRR delta flat-band dropped — binary up/down colouring only.
 *      Avoids shipping a third near-zero setting for a polish-only band.
 *   5. Kill switch `saas_headlines_enabled` gates the *surface + banner*,
 *      not the primitive read. A debug route or cost observability job
 *      can still read numbers while the admin strip is hidden.
 *   6. 7-day lockout + data-loss windows reuse `saas.data_loss_warning_days`
 *      — same concept (cycle failure horizon), no new literal.
 */
import "server-only";

import { and, eq, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  deals,
  type DealSubscriptionState,
} from "@/lib/db/schema/deals";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { activity_log } from "@/lib/db/schema/activity-log";
import { loadDashboardUsage } from "@/lib/saas-products/usage";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";

export interface SaasHeadlineSignals {
  activeSubscribers: number;
  mrrCents: number;
  newThisWindow: number;
  churnThisWindow: number;
  mrrDeltaCents: number;
  mrrDeltaPct: number | null;
  pastDueCount: number;
  lockoutCount7d: number;
  nearCapCount: number;
  dataLossWarningsSent7d: number;
  windowDays: number;
  windowStartMs: number;
  generatedAtMs: number;
}

/**
 * Daily Cockpit HealthBanner shape — matches
 * `docs/specs/daily-cockpit.md` §6.3. Defined locally until the Daily
 * Cockpit wave opens; that wave will either import from here or migrate
 * the type to a shared module.
 */
export interface HealthBanner {
  id: string;
  severity: "warning" | "critical";
  summary: string;
  href: string;
  source: string;
  first_fired_at: number;
}

const MRR_STATES: DealSubscriptionState[] = ["active", "past_due"];
const CANCELLED_STATES: DealSubscriptionState[] = [
  "cancelled_paid_remainder",
  "cancelled_buyout",
  "cancelled_post_term",
  "ended_gracefully",
];

interface LoadedDealRow {
  id: string;
  primary_contact_id: string | null;
  saas_product_id: string | null;
  subscription_state: DealSubscriptionState | null;
  created_at_ms: number;
  updated_at_ms: number;
  monthly_price_cents_inc_gst: number | null;
}

async function loadSaasDeals(
  productId: string | null,
): Promise<LoadedDealRow[]> {
  const whereClause = productId
    ? eq(deals.saas_product_id, productId)
    : isNotNull(deals.saas_product_id);

  return db
    .select({
      id: deals.id,
      primary_contact_id: deals.primary_contact_id,
      saas_product_id: deals.saas_product_id,
      subscription_state: deals.subscription_state,
      created_at_ms: deals.created_at_ms,
      updated_at_ms: deals.updated_at_ms,
      monthly_price_cents_inc_gst: saas_tiers.monthly_price_cents_inc_gst,
    })
    .from(deals)
    .leftJoin(saas_tiers, eq(deals.saas_tier_id, saas_tiers.id))
    .where(whereClause);
}

async function countActivityKindSince(
  kind: "saas_payment_failed_lockout" | "saas_data_loss_warning_sent",
  sinceMs: number,
  productId: string | null,
): Promise<number> {
  // Activity log rows don't carry `saas_product_id` directly; when
  // filtering to a product we join through the deal. Platform-wide counts
  // skip the join.
  if (productId) {
    const row = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(activity_log)
      .innerJoin(deals, eq(activity_log.deal_id, deals.id))
      .where(
        and(
          eq(activity_log.kind, kind),
          gte(activity_log.created_at_ms, sinceMs),
          eq(deals.saas_product_id, productId),
        ),
      )
      .get();
    return Number(row?.n ?? 0);
  }

  const row = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.kind, kind),
        gte(activity_log.created_at_ms, sinceMs),
      ),
    )
    .get();
  return Number(row?.n ?? 0);
}

function computeMrr(rows: LoadedDealRow[]): number {
  let total = 0;
  for (const r of rows) {
    if (
      r.subscription_state !== null &&
      MRR_STATES.includes(r.subscription_state) &&
      r.monthly_price_cents_inc_gst !== null
    ) {
      total += r.monthly_price_cents_inc_gst;
    }
  }
  return total;
}

function computePriorMrr(
  rows: LoadedDealRow[],
  windowStartMs: number,
): number {
  // MRR as-of windowStartMs: deals that existed before the window and
  // either (a) are still in an MRR-counting state today, or (b) left the
  // MRR-counting set *inside* the window (their price was active at
  // windowStartMs but is no longer). Reads `updated_at_ms` as the proxy
  // for cancel time — see silent reconcile #2.
  let total = 0;
  for (const r of rows) {
    if (r.created_at_ms > windowStartMs) continue;
    if (r.monthly_price_cents_inc_gst === null) continue;
    const state = r.subscription_state;
    if (state === null) continue;
    const stillCounting = MRR_STATES.includes(state);
    const cancelledInWindow =
      CANCELLED_STATES.includes(state) && r.updated_at_ms >= windowStartMs;
    if (stillCounting || cancelledInWindow) {
      total += r.monthly_price_cents_inc_gst;
    }
  }
  return total;
}

async function computeNearCapCount(
  rows: LoadedDealRow[],
  threshold: number,
  nowMs: number,
): Promise<number> {
  let count = 0;
  for (const r of rows) {
    if (r.subscription_state !== "active") continue;
    if (!r.primary_contact_id || !r.saas_product_id) continue;
    const snap = await loadDashboardUsage(
      r.primary_contact_id,
      r.saas_product_id,
      { nowMs },
    );
    if (!snap) continue;
    const hit = snap.dimensions.some(
      (d) =>
        d.limit !== null &&
        d.limit > 0 &&
        d.used / d.limit >= threshold,
    );
    if (hit) count += 1;
  }
  return count;
}

interface ComputeOptions {
  windowDays?: number;
  nowMs?: number;
}

async function computeSignals(
  productId: string | null,
  opts: ComputeOptions = {},
): Promise<SaasHeadlineSignals> {
  const nowMs = opts.nowMs ?? Date.now();
  const windowDays =
    opts.windowDays ?? (await settings.get("saas.headline_window_days"));
  const threshold = await settings.get("saas.near_cap_threshold");
  const dataLossWindowDays = await settings.get("saas.data_loss_warning_days");
  const windowStartMs = nowMs - windowDays * 86_400_000;
  const lockoutWindowStartMs = nowMs - dataLossWindowDays * 86_400_000;

  const rows = await loadSaasDeals(productId);

  let activeSubscribers = 0;
  let newThisWindow = 0;
  let churnThisWindow = 0;
  let pastDueCount = 0;

  for (const r of rows) {
    const state = r.subscription_state;
    if (state !== null && MRR_STATES.includes(state)) activeSubscribers += 1;
    if (state === "past_due") pastDueCount += 1;
    if (state !== null && r.created_at_ms >= windowStartMs) {
      newThisWindow += 1;
    }
    if (
      state !== null &&
      CANCELLED_STATES.includes(state) &&
      r.updated_at_ms >= windowStartMs
    ) {
      churnThisWindow += 1;
    }
  }

  const mrrCents = computeMrr(rows);
  const priorMrr = computePriorMrr(rows, windowStartMs);
  const mrrDeltaCents = mrrCents - priorMrr;
  const mrrDeltaPct = priorMrr > 0 ? mrrDeltaCents / priorMrr : null;

  const [lockoutCount7d, dataLossWarningsSent7d, nearCapCount] =
    await Promise.all([
      countActivityKindSince(
        "saas_payment_failed_lockout",
        lockoutWindowStartMs,
        productId,
      ),
      countActivityKindSince(
        "saas_data_loss_warning_sent",
        lockoutWindowStartMs,
        productId,
      ),
      computeNearCapCount(rows, threshold, nowMs),
    ]);

  return {
    activeSubscribers,
    mrrCents,
    newThisWindow,
    churnThisWindow,
    mrrDeltaCents,
    mrrDeltaPct,
    pastDueCount,
    lockoutCount7d,
    nearCapCount,
    dataLossWarningsSent7d,
    windowDays,
    windowStartMs,
    generatedAtMs: nowMs,
  };
}

export async function getSaasHeadlineSignals(
  opts: { userId?: string; windowDays?: number; nowMs?: number } = {},
): Promise<SaasHeadlineSignals> {
  return computeSignals(null, opts);
}

export async function getSaasHeadlineSignalsForProduct(
  productId: string,
  opts: { windowDays?: number; nowMs?: number } = {},
): Promise<SaasHeadlineSignals> {
  return computeSignals(productId, opts);
}

export async function getSaasHealthBanners(
  _userId: string,
): Promise<HealthBanner[]> {
  if (!killSwitches.saas_headlines_enabled) return [];

  const signals = await computeSignals(null);
  const banners: HealthBanner[] = [];

  if (signals.dataLossWarningsSent7d > 0) {
    banners.push({
      id: "saas_data_loss_risk",
      severity: "critical",
      summary:
        signals.dataLossWarningsSent7d === 1
          ? "1 subscriber 7 days into payment failure — data loss risk."
          : `${signals.dataLossWarningsSent7d} subscribers 7 days into payment failure — data loss risk.`,
      href: "/lite/admin/products",
      source: "saas_subscription_billing",
      first_fired_at: signals.generatedAtMs,
    });
  }

  if (signals.pastDueCount > 0) {
    banners.push({
      id: "saas_past_due",
      severity: "warning",
      summary:
        signals.pastDueCount === 1
          ? "1 subscriber past-due."
          : `${signals.pastDueCount} subscribers past-due.`,
      href: "/lite/admin/products",
      source: "saas_subscription_billing",
      first_fired_at: signals.generatedAtMs,
    });
  }

  return banners;
}
