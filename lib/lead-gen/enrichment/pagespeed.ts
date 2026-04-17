import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const PAGESPEED_API_BASE =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
    };
  };
  error?: { message?: string };
}

/**
 * Enrich with Google PageSpeed Insights performance score (mobile).
 * No API key required — uses the public endpoint.
 * Logs to external_call_log (job: "pagespeed:runPagespeed").
 *
 * @param domain - Normalised domain (e.g. "acme.com.au"). Null → returns {}.
 * @param _businessName - Unused; present for uniform enricher signature.
 */
export async function enrichPageSpeed(
  domain: string | null,
  _businessName: string,
): Promise<Partial<ViabilityProfile>> {
  if (!domain) return {};

  const startMs = Date.now();
  let score: number | null = null;
  let fetchError: string | undefined;

  try {
    const params = new URLSearchParams({
      url: `https://${domain}`,
      strategy: "mobile",
      category: "PERFORMANCE",
    });
    const response = await fetch(`${PAGESPEED_API_BASE}?${params.toString()}`);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `PageSpeed HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as PageSpeedApiResponse;
      if (data.error) {
        fetchError = `PageSpeed API error: ${data.error.message ?? "unknown"}`;
      } else {
        const raw = data.lighthouseResult?.categories?.performance?.score;
        score = raw != null ? Math.round(raw * 100) : null;
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

  if (fetchError) {
    return { fetch_errors: { pagespeed: fetchError } };
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
