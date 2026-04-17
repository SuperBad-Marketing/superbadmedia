/**
 * Google Ads Transparency Center discovery adapter (via SerpAPI).
 *
 * Queries SerpAPI's google_ads_transparency_center engine to find businesses
 * running Google Ads in the given location. Returns candidates with the
 * `google_ads` portion of ViabilityProfile populated.
 *
 * Catches the "runs Google ads but not Meta" segment — complementary to
 * the Meta Ad Library adapter.
 *
 * SerpAPI key sourced from integration_connections via getCredential('serpapi').
 * Credential is passed in by the orchestrator — adapter is credential-agnostic.
 *
 * Owner: LG-2. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import type {
  DiscoveryCandidate,
  DiscoveryResult,
  DiscoverySearchInput,
  ViabilityProfile,
} from "@/lib/lead-gen/types";

interface SerpApiTransparencyAdvertiser {
  advertiser_name?: string;
  advertiser_id?: string;
  location?: string;
  domains?: string[];
  number_of_ads?: number;
  first_shown?: string;
  last_shown?: string;
}

function extractPrimaryDomain(
  domains: string[] | undefined,
): string | null {
  if (!domains?.length) return null;
  return domains[0].replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;
}

/**
 * Search Google Ads Transparency Center via SerpAPI for businesses running
 * Google Ads in the given location.
 *
 * @param input - Search parameters.
 * @param apiKey - SerpAPI key from getCredential('serpapi').
 * @returns DiscoveryResult with candidates and google_ads profile data.
 */
export async function searchGoogleAdsTransparency(
  input: DiscoverySearchInput,
  apiKey: string,
): Promise<DiscoveryResult> {
  const startMs = Date.now();

  const query = [input.category, input.locationCentre]
    .filter(Boolean)
    .join(" ");

  const params = new URLSearchParams({
    engine: "google_ads_transparency_center",
    q: query || input.locationCentre,
    api_key: apiKey,
    region_code: deriveRegionCode(input.locationCentre),
    num: String(Math.min(input.maxResults * 2, 20)),
  });

  let fetchError: string | undefined;
  const candidates: DiscoveryCandidate[] = [];

  try {
    const response = await fetch(
      `${SERPAPI_API_BASE}/search.json?${params.toString()}`,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `SerpAPI Google Ads Transparency HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as {
        ads_transparency_results?: SerpApiTransparencyAdvertiser[];
        error?: string;
      };

      if (data.error) {
        fetchError = `SerpAPI Google Ads Transparency error: ${data.error}`;
      } else {
        const results = data.ads_transparency_results ?? [];
        const seen = new Set<string>();

        for (const advertiser of results) {
          if (candidates.length >= input.maxResults) break;
          const name = advertiser.advertiser_name?.trim();
          if (!name || seen.has(name)) continue;
          seen.add(name);

          const adCount = advertiser.number_of_ads ?? 0;
          const profile: Partial<ViabilityProfile> = {
            google_ads: {
              active_creative_count: adCount,
              has_active_campaigns: adCount > 0,
            },
          };

          candidates.push({
            businessName: name,
            domain: extractPrimaryDomain(advertiser.domains),
            location: advertiser.location ?? input.locationCentre,
            phone: null,
            source: "google_ads_transparency",
            partialProfile: profile,
          });
        }
      }
    }
  } catch (err) {
    fetchError = `SerpAPI Google Ads Transparency fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "serpapi:google_ads_transparency",
    actor_type: "internal",
    units: JSON.stringify({
      candidates: candidates.length,
      duration_ms: Date.now() - startMs,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  return {
    source: "google_ads_transparency",
    candidates,
    ...(fetchError ? { fetchError } : {}),
  };
}

/** Derive a Google Ads region code from a location string. */
function deriveRegionCode(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes("australia") || lower.includes("melbourne") || lower.includes("sydney")) {
    return "AU";
  }
  if (lower.includes("united kingdom") || lower.includes("london")) return "GB";
  if (lower.includes("united states") || lower.includes("new york")) return "US";
  return "AU";
}
