/**
 * Observatory contribution to the Daily Cockpit `getHealthBanners()` contract.
 * Returns banners for open cost anomalies, monthly threshold crossings,
 * projection threshold crossings, tier-health alerts, and unknown-job traps.
 *
 * Spec: `docs/specs/cost-usage-observatory.md` §6.
 * Owner: COB-9 (Wave 21). Consumer: DC-5 (Wave 22).
 */
import { and, eq, isNull, sql, desc, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { cost_anomalies, type CostAnomalyTier } from "@/lib/db/schema/cost-anomalies";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";
import type { HealthBanner } from "@/lib/tasks/cockpit";
import { getTierHealth } from "./queries/tier-health";
import { isJobRegistered } from "./job-registry";

function tierToSeverity(tier: CostAnomalyTier): "warning" | "critical" {
  return tier === "severe" ? "critical" : "warning";
}

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function getObservatoryHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  if (!killSwitches.observatory_detectors_enabled) return [];

  const banners: HealthBanner[] = [];

  // 1. Open cost anomalies (unresolved, not suppressed)
  const openAnomalies = await db
    .select()
    .from(cost_anomalies)
    .where(
      and(
        isNull(cost_anomalies.resolved_at_ms),
      ),
    )
    .orderBy(desc(cost_anomalies.last_fired_at_ms))
    .all();

  for (const a of openAnomalies) {
    const suppressed =
      a.acknowledged_until_ms != null && a.acknowledged_until_ms > nowMs;
    if (suppressed) continue;

    const observed = formatAud(a.observed_value);
    const band = a.expected_band as Record<string, unknown>;
    const bandLabel =
      typeof band?.daily_ceiling_aud === "number"
        ? formatAud(band.daily_ceiling_aud)
        : typeof band?.per_call_ceiling_aud === "number"
          ? formatAud(band.per_call_ceiling_aud)
          : "expected";

    let summary: string;
    if (a.tier === "severe") {
      if (a.detector === "rate") {
        summary = `Rate limit triggered. ${a.job}: ${a.fire_count} fires. Possible loop.`;
      } else {
        summary = `Hard ceiling breached. ${a.job}: $${observed} vs $${bandLabel} ceiling.`;
      }
    } else if (a.tier === "mid") {
      const multiplier =
        band && typeof band.daily_ceiling_aud === "number" && band.daily_ceiling_aud > 0
          ? Math.round(a.observed_value / (band.daily_ceiling_aud as number))
          : null;
      summary = multiplier
        ? `${a.job} spent $${observed} in the last 24 hours. Usual band is $${bandLabel}. ${multiplier}x over.`
        : `${a.job} spent $${observed} in the last 24 hours. Usual band is $${bandLabel}.`;
    } else {
      summary = `${a.job} had a big day. $${observed} against $${bandLabel}-ish normal. Worth a look.`;
    }

    banners.push({
      id: `cost_anomaly:${a.id}`,
      severity: tierToSeverity(a.tier),
      summary,
      href: `/lite/observatory/anomalies/${a.id}`,
      source: "cost-usage-observatory",
    });
  }

  // 2. Monthly threshold crossing
  const now = new Date(nowMs);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const mtdResult = await db
    .select({
      total: sql<number>`coalesce(sum(${external_call_log.estimated_cost_aud}), 0)`,
    })
    .from(external_call_log)
    .where(sql`${external_call_log.created_at_ms} >= ${monthStart}`)
    .get();

  const mtd = mtdResult?.total ?? 0;

  const threshold1 = await settings.get("observatory.monthly_threshold_1_aud");
  const threshold2 = await settings.get("observatory.monthly_threshold_2_aud");
  const threshold3 = await settings.get("observatory.monthly_threshold_3_aud");

  const thresholds = [threshold1, threshold2, threshold3].filter(
    (t): t is number => t != null && t > 0,
  );

  for (const threshold of thresholds) {
    if (mtd >= threshold) {
      banners.push({
        id: `monthly_threshold:${threshold}`,
        severity: threshold === thresholds[thresholds.length - 1] ? "critical" : "warning",
        summary: `Monthly spend crossed $${formatAud(threshold)}. Currently at $${formatAud(mtd)}. You set this flag.`,
        href: "/lite/observatory",
        source: "cost-usage-observatory",
      });
    }
  }

  // 3. Projection threshold crossing
  const projectionEnabled = await settings.get("observatory.projection_alert_enabled");
  if (projectionEnabled !== false && thresholds.length > 0) {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    if (dayOfMonth >= 3) {
      const projected = (mtd / dayOfMonth) * daysInMonth;

      for (const threshold of thresholds) {
        if (projected >= threshold && mtd < threshold) {
          banners.push({
            id: `projection_threshold:${threshold}`,
            severity: "warning",
            summary: `At current pace you'll land around $${formatAud(projected)} this month. You set a flag at $${formatAud(threshold)}.`,
            href: "/lite/observatory",
            source: "cost-usage-observatory",
          });
        }
      }
    }
  }

  // 4. Tier-health banners (red tiers)
  try {
    const tiers = await getTierHealth();
    for (const tier of tiers) {
      if (tier.health === "red" && tier.subscriber_count > 0) {
        banners.push({
          id: `tier_health:${tier.tier_id}`,
          severity: "warning",
          summary: `${tier.tier_name} tier has ${tier.percent_underwater}% of subscribers underwater this month. The tier design may need restructuring.`,
          href: "/lite/observatory",
          source: "cost-usage-observatory",
        });
      }
    }
  } catch {
    // tier-health query failure should not block other banners
  }

  // 5. Unknown job detection
  const recentJobs = await db
    .select({ job: external_call_log.job })
    .from(external_call_log)
    .where(gte(external_call_log.created_at_ms, nowMs - 24 * 60 * 60 * 1000))
    .groupBy(external_call_log.job)
    .all();

  for (const row of recentJobs) {
    if (!isJobRegistered(row.job)) {
      banners.push({
        id: `unknown_job:${row.job}`,
        severity: "warning",
        summary: `Unknown job "${row.job}" appeared in the last 24 hours. It's not in the registry.`,
        href: "/lite/observatory/settings",
        source: "cost-usage-observatory",
      });
    }
  }

  return banners;
}
