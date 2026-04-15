/**
 * SaaS usage metering + cap enforcement (SB-7).
 *
 * Spec: `docs/specs/saas-subscription-billing.md` §5. Signatures match
 * spec §5.1 — `checkUsageLimit(contactId, productId, dimensionKey)` +
 * `recordUsage(contactId, productId, dimensionKey, opts?)`. Period math
 * derives from `deals.created_at_ms` (the subscription's month
 * anniversary); see `resolveBillingPeriod()` for the clamp rule.
 *
 * Thresholds:
 *   - `saas.usage_warn_threshold_percent` (sticky bar warn cutoff) —
 *     read via `settings.get()` per G4.
 *   - `saas_usage_enforcement_enabled` (kill switch) — when off,
 *     `checkUsageLimit` returns `allowed: true` regardless of tally.
 *
 * Shape decisions (silent reconciles vs `sessions/sb-7-brief.md`):
 *   - Signatures keyed on `(contactId, productId, dimensionKey)` —
 *     matches locked spec §5.1 and the SB-1 `usage_records` index.
 *     Brief's `dealId` variant conflicted with both.
 *   - `amount` + `idempotency_key` + `billing_period_end_ms` added to
 *     SB-1's table via migration 0025 rather than redesigned.
 *   - Period boundary clamps day-of-month when the target month is
 *     shorter than the anchor day (anchor day 31, Feb → 28/29).
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_tier_limits } from "@/lib/db/schema/saas-tier-limits";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { saas_usage_dimensions } from "@/lib/db/schema/saas-usage-dimensions";
import { usage_records } from "@/lib/db/schema/usage-records";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";

// ---- Period math --------------------------------------------------------

export interface BillingPeriod {
  startMs: number;
  endMs: number;
}

/**
 * Anchor-aware monthly billing period.
 *
 * The period is the half-open interval `[startMs, endMs)` where
 * `startMs` is the most recent month-anniversary of `anchorMs` that is
 * `<= nowMs`, and `endMs` is the next. Anchor days past the target
 * month's length clamp to the last day of the month.
 */
export function resolveBillingPeriod(
  anchorMs: number,
  nowMs: number,
): BillingPeriod {
  const anchor = new Date(anchorMs);
  const anchorDay = anchor.getUTCDate();
  const anchorHour = anchor.getUTCHours();
  const anchorMin = anchor.getUTCMinutes();
  const anchorSec = anchor.getUTCSeconds();
  const anchorMs2 = anchor.getUTCMilliseconds();

  const now = new Date(nowMs);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();

  const anniversaryFor = (year: number, month: number): number => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(anchorDay, daysInMonth);
    return Date.UTC(year, month, day, anchorHour, anchorMin, anchorSec, anchorMs2);
  };

  let startMs = anniversaryFor(y, m);
  if (startMs > nowMs) {
    // Roll back one month.
    const prev = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    y = prev.y;
    m = prev.m;
    startMs = anniversaryFor(y, m);
  }

  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  const endMs = anniversaryFor(nextY, nextM);

  return { startMs, endMs };
}

// ---- Core lookups -------------------------------------------------------

interface SubscriberContext {
  contactId: string;
  companyId: string;
  dealId: string;
  tierId: string | null;
  tierRank: number | null;
  tierName: string | null;
  period: BillingPeriod;
}

async function loadSubscriberContext(
  contactId: string,
  productId: string,
  nowMs: number,
): Promise<SubscriberContext | null> {
  const contact = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();
  if (!contact) return null;

  const deal = await db
    .select({
      id: deals.id,
      company_id: deals.company_id,
      created_at_ms: deals.created_at_ms,
      saas_tier_id: deals.saas_tier_id,
    })
    .from(deals)
    .where(
      and(
        eq(deals.primary_contact_id, contactId),
        eq(deals.saas_product_id, productId),
      ),
    )
    .orderBy(desc(deals.created_at_ms))
    .limit(1)
    .get();
  if (!deal) return null;

  let tierRank: number | null = null;
  let tierName: string | null = null;
  if (deal.saas_tier_id) {
    const tier = await db
      .select({
        rank: saas_tiers.tier_rank,
        name: saas_tiers.name,
      })
      .from(saas_tiers)
      .where(eq(saas_tiers.id, deal.saas_tier_id))
      .get();
    tierRank = tier?.rank ?? null;
    tierName = tier?.name ?? null;
  }

  const period = resolveBillingPeriod(deal.created_at_ms, nowMs);

  return {
    contactId,
    companyId: deal.company_id,
    dealId: deal.id,
    tierId: deal.saas_tier_id,
    tierRank,
    tierName,
    period,
  };
}

async function loadDimensionAndLimit(
  productId: string,
  dimensionKey: string,
  tierId: string | null,
): Promise<{
  dimensionId: string | null;
  displayName: string | null;
  limit: number | null;
}> {
  const dim = await db
    .select({
      id: saas_usage_dimensions.id,
      display_name: saas_usage_dimensions.display_name,
    })
    .from(saas_usage_dimensions)
    .where(
      and(
        eq(saas_usage_dimensions.product_id, productId),
        eq(saas_usage_dimensions.dimension_key, dimensionKey),
      ),
    )
    .get();
  if (!dim) {
    return { dimensionId: null, displayName: null, limit: null };
  }

  let limit: number | null = null;
  if (tierId) {
    const row = await db
      .select({ limit_value: saas_tier_limits.limit_value })
      .from(saas_tier_limits)
      .where(
        and(
          eq(saas_tier_limits.tier_id, tierId),
          eq(saas_tier_limits.dimension_id, dim.id),
        ),
      )
      .get();
    limit = row?.limit_value ?? null;
  }

  return {
    dimensionId: dim.id,
    displayName: dim.display_name,
    limit,
  };
}

async function tallyUsage(
  contactId: string,
  productId: string,
  dimensionKey: string,
  period: BillingPeriod,
): Promise<number> {
  const row = await db
    .select({
      total: sql<number>`COALESCE(SUM(${usage_records.amount}), 0)`,
    })
    .from(usage_records)
    .where(
      and(
        eq(usage_records.contact_id, contactId),
        eq(usage_records.product_id, productId),
        eq(usage_records.dimension_key, dimensionKey),
        gte(usage_records.billing_period_start_ms, period.startMs),
        sql`${usage_records.billing_period_start_ms} < ${period.endMs}`,
      ),
    )
    .get();
  return Number(row?.total ?? 0);
}

// ---- Public API ---------------------------------------------------------

export type UsageStatus = "calm" | "warn" | "at_cap";

export interface NextTierInfo {
  id: string;
  name: string;
  monthlyPriceCentsIncGst: number;
  limit: number | null;
}

export interface CheckUsageLimitResult {
  allowed: boolean;
  reason?: "at_cap" | "enforcement_disabled" | "unknown_subscription";
  used: number;
  limit: number | null;
  percent: number | null;
  status: UsageStatus;
  tierName: string | null;
  nextTier: NextTierInfo | null;
  dimensionKey: string;
  displayName: string | null;
  resetsAtMs: number | null;
  period: BillingPeriod | null;
}

export async function checkUsageLimit(
  contactId: string,
  productId: string,
  dimensionKey: string,
  opts: { nowMs?: number } = {},
): Promise<CheckUsageLimitResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const ctx = await loadSubscriberContext(contactId, productId, nowMs);

  if (!ctx) {
    return {
      allowed: false,
      reason: "unknown_subscription",
      used: 0,
      limit: null,
      percent: null,
      status: "calm",
      tierName: null,
      nextTier: null,
      dimensionKey,
      displayName: null,
      resetsAtMs: null,
      period: null,
    };
  }

  const { limit, displayName } = await loadDimensionAndLimit(
    productId,
    dimensionKey,
    ctx.tierId,
  );
  const used = await tallyUsage(
    ctx.contactId,
    productId,
    dimensionKey,
    ctx.period,
  );

  const warnPercent = await settings.get("saas.usage_warn_threshold_percent");
  const percent = limit === null || limit === 0 ? null : (used / limit) * 100;
  const status: UsageStatus =
    limit === null
      ? "calm"
      : used >= limit
        ? "at_cap"
        : percent !== null && percent >= warnPercent
          ? "warn"
          : "calm";

  const enforcement = killSwitches.saas_usage_enforcement_enabled;
  const overCap = limit !== null && used >= limit;
  const allowed = overCap ? !enforcement : true;

  const nextTier = await loadNextTier(
    productId,
    ctx.tierRank,
    dimensionKey,
  );

  return {
    allowed,
    reason: !allowed ? "at_cap" : overCap ? "enforcement_disabled" : undefined,
    used,
    limit,
    percent,
    status,
    tierName: ctx.tierName,
    nextTier,
    dimensionKey,
    displayName,
    resetsAtMs: ctx.period.endMs,
    period: ctx.period,
  };
}

async function loadNextTier(
  productId: string,
  currentRank: number | null,
  dimensionKey: string,
): Promise<NextTierInfo | null> {
  if (currentRank === null) return null;

  const higher = await db
    .select({
      id: saas_tiers.id,
      name: saas_tiers.name,
      monthly: saas_tiers.monthly_price_cents_inc_gst,
      rank: saas_tiers.tier_rank,
    })
    .from(saas_tiers)
    .where(
      and(
        eq(saas_tiers.product_id, productId),
        sql`${saas_tiers.tier_rank} > ${currentRank}`,
      ),
    )
    .orderBy(asc(saas_tiers.tier_rank))
    .limit(1)
    .get();
  if (!higher) return null;

  const dim = await db
    .select({ id: saas_usage_dimensions.id })
    .from(saas_usage_dimensions)
    .where(
      and(
        eq(saas_usage_dimensions.product_id, productId),
        eq(saas_usage_dimensions.dimension_key, dimensionKey),
      ),
    )
    .get();
  let nextLimit: number | null = null;
  if (dim) {
    const row = await db
      .select({ limit_value: saas_tier_limits.limit_value })
      .from(saas_tier_limits)
      .where(
        and(
          eq(saas_tier_limits.tier_id, higher.id),
          eq(saas_tier_limits.dimension_id, dim.id),
        ),
      )
      .get();
    nextLimit = row?.limit_value ?? null;
  }

  return {
    id: higher.id,
    name: higher.name,
    monthlyPriceCentsIncGst: higher.monthly,
    limit: nextLimit,
  };
}

export interface RecordUsageResult {
  recorded: boolean;
  reason?: "duplicate" | "unknown_subscription" | "unknown_dimension";
  recordId: string | null;
}

export async function recordUsage(
  contactId: string,
  productId: string,
  dimensionKey: string,
  opts: { amount?: number; idempotencyKey?: string; nowMs?: number } = {},
): Promise<RecordUsageResult> {
  const amount = opts.amount ?? 1;
  if (amount <= 0) {
    throw new Error(`recordUsage: amount must be positive (got ${amount})`);
  }
  const nowMs = opts.nowMs ?? Date.now();

  const ctx = await loadSubscriberContext(contactId, productId, nowMs);
  if (!ctx) {
    return {
      recorded: false,
      reason: "unknown_subscription",
      recordId: null,
    };
  }

  const dim = await db
    .select({ id: saas_usage_dimensions.id })
    .from(saas_usage_dimensions)
    .where(
      and(
        eq(saas_usage_dimensions.product_id, productId),
        eq(saas_usage_dimensions.dimension_key, dimensionKey),
      ),
    )
    .get();
  if (!dim) {
    return {
      recorded: false,
      reason: "unknown_dimension",
      recordId: null,
    };
  }

  const id = randomUUID();
  try {
    await db.insert(usage_records).values({
      id,
      contact_id: ctx.contactId,
      company_id: ctx.companyId,
      product_id: productId,
      dimension_key: dimensionKey,
      amount,
      idempotency_key: opts.idempotencyKey ?? null,
      billing_period_start_ms: ctx.period.startMs,
      billing_period_end_ms: ctx.period.endMs,
      recorded_at_ms: nowMs,
    });
    return { recorded: true, recordId: id };
  } catch (err) {
    // Unique-index collision on idempotency_key ⇒ treat as no-op success.
    const message = err instanceof Error ? err.message : String(err);
    if (
      opts.idempotencyKey &&
      /UNIQUE|idempotency_key/i.test(message)
    ) {
      return { recorded: false, reason: "duplicate", recordId: null };
    }
    throw err;
  }
}

// ---- Dashboard snapshot -------------------------------------------------

export interface DimensionSnapshot {
  dimensionKey: string;
  displayName: string;
  displayOrder: number;
  used: number;
  limit: number | null;
  percent: number | null;
  status: UsageStatus;
  resetsAtMs: number;
}

export interface DashboardUsageSnapshot {
  period: BillingPeriod;
  dimensions: DimensionSnapshot[];
  anyAtCap: boolean;
  tierName: string | null;
  nextTier: NextTierInfo | null;
  warnThresholdPercent: number;
}

export async function loadDashboardUsage(
  contactId: string,
  productId: string,
  opts: { nowMs?: number } = {},
): Promise<DashboardUsageSnapshot | null> {
  const nowMs = opts.nowMs ?? Date.now();
  const ctx = await loadSubscriberContext(contactId, productId, nowMs);
  if (!ctx) return null;

  const warnPercent = await settings.get("saas.usage_warn_threshold_percent");

  const dims = await db
    .select({
      id: saas_usage_dimensions.id,
      key: saas_usage_dimensions.dimension_key,
      name: saas_usage_dimensions.display_name,
      order: saas_usage_dimensions.display_order,
    })
    .from(saas_usage_dimensions)
    .where(eq(saas_usage_dimensions.product_id, productId))
    .orderBy(asc(saas_usage_dimensions.display_order));

  const dimensions: DimensionSnapshot[] = [];
  let anyAtCap = false;
  let firstAtCapDimKey: string | null = null;

  for (const d of dims) {
    let limit: number | null = null;
    if (ctx.tierId) {
      const row = await db
        .select({ limit_value: saas_tier_limits.limit_value })
        .from(saas_tier_limits)
        .where(
          and(
            eq(saas_tier_limits.tier_id, ctx.tierId),
            eq(saas_tier_limits.dimension_id, d.id),
          ),
        )
        .get();
      limit = row?.limit_value ?? null;
    }
    const used = await tallyUsage(ctx.contactId, productId, d.key, ctx.period);
    const percent = limit === null || limit === 0 ? null : (used / limit) * 100;
    const status: UsageStatus =
      limit === null
        ? "calm"
        : used >= limit
          ? "at_cap"
          : percent !== null && percent >= warnPercent
            ? "warn"
            : "calm";
    if (status === "at_cap") {
      anyAtCap = true;
      if (!firstAtCapDimKey) firstAtCapDimKey = d.key;
    }
    dimensions.push({
      dimensionKey: d.key,
      displayName: d.name,
      displayOrder: d.order,
      used,
      limit,
      percent,
      status,
      resetsAtMs: ctx.period.endMs,
    });
  }

  const nextTier = firstAtCapDimKey
    ? await loadNextTier(productId, ctx.tierRank, firstAtCapDimKey)
    : null;

  return {
    period: ctx.period,
    dimensions,
    anyAtCap,
    tierName: ctx.tierName,
    nextTier,
    warnThresholdPercent: warnPercent,
  };
}
