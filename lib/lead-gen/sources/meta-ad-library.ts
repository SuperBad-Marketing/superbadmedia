/**
 * Meta Ad Library discovery adapter.
 *
 * Queries the Meta Ad Library API (ads_archive endpoint) for businesses
 * running active ads in the given location. Returns candidates with the
 * meta_ads portion of ViabilityProfile already populated.
 *
 * API docs: https://www.facebook.com/ads/library/api/
 * Endpoint: GET https://graph.facebook.com/v20.0/ads_archive
 *
 * Owner: LG-2. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { META_GRAPH_API_VERSION } from "@/lib/integrations/vendors/meta-ads";
import type {
  DiscoveryCandidate,
  DiscoveryResult,
  DiscoverySearchInput,
  ViabilityProfile,
} from "@/lib/lead-gen/types";

const META_ADS_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

/** Spend range labels returned by the Meta Ad Library spend_bracket field. */
type MetaSpendBracket = "unknown" | "low" | "medium" | "high";

interface MetaAdArchiveResult {
  page_name?: string;
  page_id?: string;
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  estimated_audience_size?: { lower_bound?: number; upper_bound?: number };
  spend?: { lower_bound?: string; upper_bound?: string; currency?: string };
  publisher_platforms?: string[];
  eu_total_reach?: number;
}

function parseSpendBracket(
  spend: MetaAdArchiveResult["spend"],
): MetaSpendBracket {
  if (!spend?.lower_bound) return "unknown";
  const lower = parseInt(spend.lower_bound, 10);
  if (isNaN(lower)) return "unknown";
  if (lower < 100) return "low";
  if (lower < 1000) return "medium";
  return "high";
}

function extractDomainFromSnapshotUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const advertiserUrl = u.searchParams.get("ad_id") ? null : null;
    void advertiserUrl;
    return null;
  } catch {
    return null;
  }
}

/**
 * Search Meta Ad Library for businesses running active ads in the given location.
 *
 * @param input - Search parameters (location, category, maxResults).
 * @param accessToken - Meta API user access token from getCredential('meta-ads').
 * @returns DiscoveryResult with candidates and meta_ads profile data.
 */
export async function searchMetaAdLibrary(
  input: DiscoverySearchInput,
  accessToken: string,
): Promise<DiscoveryResult> {
  const startMs = Date.now();

  const searchTerms = [input.category, input.locationCentre]
    .filter(Boolean)
    .join(" ");

  const params = new URLSearchParams({
    access_token: accessToken,
    search_terms: searchTerms || "business",
    ad_active_status: "ACTIVE",
    ad_reached_countries: deriveCountryCode(input.locationCentre),
    fields: [
      "page_name",
      "page_id",
      "ad_snapshot_url",
      "ad_delivery_start_time",
      "spend",
      "publisher_platforms",
    ].join(","),
    limit: String(Math.min(input.maxResults * 3, 50)),
  });

  let fetchError: string | undefined;
  const candidates: DiscoveryCandidate[] = [];

  try {
    const response = await fetch(
      `${META_ADS_API_BASE}/ads_archive?${params.toString()}`,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `Meta Ad Library HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as {
        data?: MetaAdArchiveResult[];
        error?: { message?: string };
      };

      if (data.error) {
        fetchError = `Meta Ad Library API error: ${data.error.message ?? JSON.stringify(data.error)}`;
      } else {
        const results = data.data ?? [];
        const seen = new Set<string>();

        for (const ad of results) {
          if (candidates.length >= input.maxResults) break;
          const name = ad.page_name?.trim();
          if (!name || seen.has(name)) continue;
          seen.add(name);

          const profile: Partial<ViabilityProfile> = {
            meta_ads: {
              active_ad_count: 1,
              estimated_spend_bracket: parseSpendBracket(ad.spend),
              has_active_creatives: true,
            },
          };

          candidates.push({
            businessName: name,
            domain: extractDomainFromSnapshotUrl(ad.ad_snapshot_url),
            location: input.locationCentre,
            phone: null,
            source: "meta_ad_library",
            partialProfile: profile,
          });
        }
      }
    }
  } catch (err) {
    fetchError = `Meta Ad Library fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "meta_ads:search",
    actor_type: "internal",
    units: JSON.stringify({
      candidates: candidates.length,
      duration_ms: Date.now() - startMs,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  return {
    source: "meta_ad_library",
    candidates,
    ...(fetchError ? { fetchError } : {}),
  };
}

/** Derive an ISO 3166-1 alpha-2 country code from a location string. */
function deriveCountryCode(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes("australia") || lower.includes("melbourne") || lower.includes("sydney") || lower.includes("brisbane")) {
    return "AU";
  }
  if (lower.includes("united kingdom") || lower.includes("london")) return "GB";
  if (lower.includes("united states") || lower.includes("new york")) return "US";
  return "AU";
}
