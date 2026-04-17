/**
 * Upsell targeting — two-tier model per spec §4.
 *
 * Evaluates a SaaS subscriber company against Warm and Hot thresholds
 * using Revenue Segmentation data + product engagement signals. Both
 * tiers require a configurable location gate.
 *
 * Engagement signals derived from `activity_log` — login frequency as
 * distinct days with activity, feature usage breadth as distinct
 * feature-area prefixes.
 *
 * All thresholds read from `settings.get()`, never literals.
 *
 * Owner: OS-2. Consumers: Daily Cockpit (Hot alerts), Sales Pipeline
 * (Warm/Hot filter).
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companies,
  REVENUE_RANGES,
  type RevenueRange,
} from "@/lib/db/schema/companies";
import { activity_log } from "@/lib/db/schema/activity-log";
import settingsRegistry from "@/lib/settings";

export type UpsellTier = "hot" | "warm" | "none";

export interface UpsellEvaluation {
  tier: UpsellTier;
  revenueQualified: boolean;
  engagementQualified: boolean;
  goalAligned: boolean;
  locationMatch: boolean;
  loginDays: number;
  featureAreas: number;
}

/**
 * Revenue ranges at or above the configurable floor are "qualified."
 * The floor default is "500k_1m" — meaning 500k_1m, 1m_3m, 3m_plus
 * all pass.
 */
function revenueAtOrAbove(
  value: RevenueRange | null,
  floor: string,
): boolean {
  if (!value) return false;
  const floorIdx = REVENUE_RANGES.indexOf(floor as RevenueRange);
  if (floorIdx === -1) return false;
  const valueIdx = REVENUE_RANGES.indexOf(value);
  return valueIdx >= floorIdx;
}

/**
 * Extract a feature-area prefix from an activity_log.kind value.
 * e.g. "content_generate_draft" → "content", "inbox_message_sent" → "inbox".
 * Returns the first segment before "_".
 */
function featureAreaPrefix(kind: string): string {
  const idx = kind.indexOf("_");
  return idx > 0 ? kind.slice(0, idx) : kind;
}

/**
 * Evaluate upsell tier for a company. Pure read, no side effects.
 *
 * Returns a full evaluation object so the cockpit and pipeline can
 * display context alongside the tier label.
 */
export async function evaluateUpsellTier(
  companyId: string,
): Promise<UpsellEvaluation> {
  // ── 1. Load company Rev Seg data ────────────────────────────────────
  const co = db
    .select({
      revenue_range: companies.revenue_range,
      twelve_month_goal: companies.twelve_month_goal,
      location: companies.location,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!co) {
    return {
      tier: "none",
      revenueQualified: false,
      engagementQualified: false,
      goalAligned: false,
      locationMatch: false,
      loginDays: 0,
      featureAreas: 0,
    };
  }

  // ── 2. Load settings thresholds ─────────────────────────────────────
  const [
    revenueFloor,
    loginDaysThreshold,
    loginWindowDays,
    featureCountThreshold,
    featureWindowDays,
    locationGate,
  ] = await Promise.all([
    settingsRegistry.get("onboarding.upsell_revenue_floor"),
    settingsRegistry.get("onboarding.upsell_engagement_login_days"),
    settingsRegistry.get("onboarding.upsell_engagement_login_window_days"),
    settingsRegistry.get("onboarding.upsell_engagement_feature_count"),
    settingsRegistry.get("onboarding.upsell_engagement_feature_window_days"),
    settingsRegistry.get("onboarding.upsell_location_gate"),
  ]);

  // ── 3. Revenue check ───────────────────────────────────────────────
  const revenueQualified = revenueAtOrAbove(co.revenue_range, revenueFloor);

  // ── 4. Location gate ───────────────────────────────────────────────
  const locationMatch = co.location != null &&
    co.location.toLowerCase().includes(locationGate.toLowerCase());

  // ── 5. Engagement — login frequency ────────────────────────────────
  // Count distinct days with activity in the login window.
  const loginWindowStart = Date.now() - loginWindowDays * 24 * 60 * 60 * 1000;
  const loginDaysResult = db
    .select({
      day_count: sql<number>`COUNT(DISTINCT date(${activity_log.created_at_ms} / 1000, 'unixepoch'))`,
    })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.company_id, companyId),
        gte(activity_log.created_at_ms, loginWindowStart),
      ),
    )
    .get();
  const loginDays = loginDaysResult?.day_count ?? 0;

  // ── 6. Engagement — feature usage breadth ──────────────────────────
  // Count distinct feature-area prefixes in the feature window.
  const featureWindowStart = Date.now() - featureWindowDays * 24 * 60 * 60 * 1000;
  const featureKinds = db
    .select({ kind: activity_log.kind })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.company_id, companyId),
        gte(activity_log.created_at_ms, featureWindowStart),
      ),
    )
    .all();

  const featureAreaSet = new Set(featureKinds.map((r) => featureAreaPrefix(r.kind)));
  const featureAreas = featureAreaSet.size;

  // ── 7. Engagement qualified = high login + broad feature usage ─────
  const highLogin = loginDays >= loginDaysThreshold;
  const broadFeature = featureAreas >= featureCountThreshold;
  const engagementQualified = highLogin && broadFeature;

  // ── 8. Goal alignment ─────────────────────────────────────────────
  const goalAligned =
    co.twelve_month_goal === "scale" || co.twelve_month_goal === "launch_new";

  // ── 9. Apply tier logic ───────────────────────────────────────────
  // Both tiers require location match.
  if (!locationMatch) {
    return {
      tier: "none",
      revenueQualified,
      engagementQualified,
      goalAligned,
      locationMatch,
      loginDays,
      featureAreas,
    };
  }

  // Hot = revenue AND engagement AND goal
  if (revenueQualified && engagementQualified && goalAligned) {
    return {
      tier: "hot",
      revenueQualified,
      engagementQualified,
      goalAligned,
      locationMatch,
      loginDays,
      featureAreas,
    };
  }

  // Warm = revenue OR high-login (login threshold alone, without broad feature)
  const highLoginAlone = loginDays >= loginDaysThreshold;
  if (revenueQualified || highLoginAlone) {
    return {
      tier: "warm",
      revenueQualified,
      engagementQualified,
      goalAligned,
      locationMatch,
      loginDays,
      featureAreas,
    };
  }

  return {
    tier: "none",
    revenueQualified,
    engagementQualified,
    goalAligned,
    locationMatch,
    loginDays,
    featureAreas,
  };
}
