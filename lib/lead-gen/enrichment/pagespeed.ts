/**
 * Google PageSpeed Insights enrichment adapter.
 *
 * Fetches the mobile performance score for a domain via the free
 * PageSpeed Insights API (no key required for basic calls).
 * Logs to external_call_log (job: "pagespeed:runPagespeed").
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
    };
  };
  error?: { message?: string };
}

/**
 * Enrich a candidate with PageSpeed Insights performance score.
 *
 * @param domain - Normalised domain (e.g. "acme.com.au"). Null returns {}.
 * @param businessName - Business name — unused in API call, kept for consistent enricher signature.
 */
export async function enrichPageSpeed(
  domain: string | null,
  businessName: string,
): Promise<Partial<ViabilityProfile>> {
  void businessName;
  if (!domain) return {};

  const startMs = Date.now();
  let score: number | null = null;
  let fetchErrorMsg: string | undefined;

  try {
    const params = new URLSearchParams({
      url: `https://${domain}`,
      strategy: "mobile",
      category: "performance",
    });

    const response = await fetch(`${PAGESPEED_API}?${params.toString()}`);

    if (!response.ok) {
      fetchErrorMsg = `PageSpeed HTTP ${response.status}`;
    } else {
      const data = (await response.json()) as PageSpeedResponse;
      if (data.error?.message) {
        fetchErrorMsg = `PageSpeed error: ${data.error.message}`;
      } else {
        const raw = data.lighthouseResult?.categories?.performance?.score;
        score = typeof raw === "number" ? Math.round(raw * 100) : null;
      }
    }
  } catch (err) {
    fetchErrorMsg = `PageSpeed fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "pagespeed:runPagespeed",
    actor_type: "internal",
    units: JSON.stringify({
      domain,
      duration_ms: Date.now() - startMs,
      ...(fetchErrorMsg ? { error: fetchErrorMsg } : {}),
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchErrorMsg) {
    return { fetch_errors: { pagespeed: fetchErrorMsg } };
  }

  return {
    website: {
      pagespeed_performance_score: score,
      domain_age_years: null,
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
    },
  };
}
