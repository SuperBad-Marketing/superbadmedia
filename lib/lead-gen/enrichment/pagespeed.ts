/**
 * PageSpeed enrichment — Google PageSpeed Insights API v5.
 * Populates website.pagespeed_performance_score.
 * No API key required (unauthenticated = lower quota; pass key for higher quota).
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const PAGESPEED_BASE = "https://www.googleapis.com/pagespeedonline/v5";

export async function enrichPageSpeed(
  domain: string | null,
  _businessName: string,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const startMs = Date.now();
  const params = new URLSearchParams({
    url: `https://${domain}`,
    strategy: "mobile",
    category: "performance",
  });

  let score: number | null = null;
  let fetchError: string | undefined;

  try {
    const response = await fetch(`${PAGESPEED_BASE}/runPagespeed?${params}`);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `PageSpeed HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as {
        lighthouseResult?: { categories?: { performance?: { score?: number } } };
        error?: { message?: string };
      };
      if (data.error?.message) {
        fetchError = `PageSpeed API error: ${data.error.message}`;
      } else {
        const raw = data.lighthouseResult?.categories?.performance?.score;
        score = typeof raw === "number" ? Math.round(raw * 100) : null;
      }
    }
  } catch (err) {
    fetchError = `PageSpeed fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "pagespeed:runPagespeed",
    actor_type: "internal",
    units: JSON.stringify({ domain, duration_ms: Date.now() - startMs }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) return { fetch_errors: { pagespeed: fetchError } };

  return {
    website: {
      domain_age_years: null,
      pagespeed_performance_score: score,
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
    },
  };
}
