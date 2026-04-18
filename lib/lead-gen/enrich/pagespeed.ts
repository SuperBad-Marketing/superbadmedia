/**
 * PageSpeed Insights enrichment — website technical quality signal.
 *
 * Queries Google PageSpeed Insights API (free, API-key-gated, generous limits).
 * Returns performance score 0–100 as a crude proxy for agency-vs-DIY website.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "../types";

const PAGESPEED_API_BASE =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score: number | null };
    };
  };
  error?: { message: string };
}

export interface PageSpeedResult {
  performance_score: number | null;
  error?: string;
}

/**
 * Fetch PageSpeed performance score for a domain.
 *
 * @param domain Bare domain (no protocol). We query the HTTPS version.
 * @returns Performance score (0–100) or null on failure.
 */
export async function fetchPageSpeed(domain: string): Promise<PageSpeedResult> {
  const apiKey = await getCredential("google-pagespeed");
  if (!apiKey) {
    return {
      performance_score: null,
      error: "PageSpeed API key not found — complete the setup wizard first.",
    };
  }

  const start = Date.now();
  const url = `https://${domain}`;

  const params = new URLSearchParams({
    url,
    key: apiKey,
    category: "performance",
    strategy: "mobile",
  });

  try {
    const response = await fetch(`${PAGESPEED_API_BASE}?${params.toString()}`);
    const duration = Date.now() - start;

    if (!response.ok) {
      await logCall(duration);
      return {
        performance_score: null,
        error: `PageSpeed API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as PageSpeedResponse;
    await logCall(duration);

    if (data.error) {
      return {
        performance_score: null,
        error: `PageSpeed API error: ${data.error.message}`,
      };
    }

    const rawScore =
      data.lighthouseResult?.categories?.performance?.score ?? null;
    const score = rawScore !== null ? Math.round(rawScore * 100) : null;

    return { performance_score: score };
  } catch (err) {
    const duration = Date.now() - start;
    await logCall(duration);
    return {
      performance_score: null,
      error: `PageSpeed fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Merge PageSpeed result into a partial ViabilityProfile.
 */
export function applyPageSpeedToProfile(
  profile: Partial<ViabilityProfile>,
  result: PageSpeedResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    website: {
      domain_age_years: profile.website?.domain_age_years ?? null,
      pagespeed_performance_score: result.performance_score,
      has_about_page: profile.website?.has_about_page ?? false,
      has_pricing_page: profile.website?.has_pricing_page ?? false,
      team_size_signal: profile.website?.team_size_signal ?? "unknown",
      stated_pricing_tier: profile.website?.stated_pricing_tier ?? "unknown",
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, pagespeed: result.error }
      : profile.fetch_errors,
  };
}

async function logCall(durationMs: number): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job: "google.pagespeed.run",
      actor_type: "internal",
      units: JSON.stringify({ analyses: 1 }),
      estimated_cost_aud: 0,
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
