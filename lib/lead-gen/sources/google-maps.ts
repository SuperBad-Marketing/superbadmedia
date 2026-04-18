/**
 * Google Maps discovery source via SerpAPI `google_maps` engine.
 *
 * Primary discovery for location-based businesses not running ads.
 * Query shape: `category + location` derived from Settings standing brief.
 *
 * SerpAPI is already in the stack (shared with Content Engine).
 * Reuses the same `serpapi` credential via `getCredential()`.
 *
 * Owner: LG-2. Consumer: discovery orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { DiscoveredCandidate, DiscoverySearchParams } from "../types";

interface SerpApiMapsResult {
  position: number;
  title: string;
  place_id?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  phone?: string;
  website?: string;
  thumbnail?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  photos_count?: number;
}

interface SerpApiMapsResponse {
  local_results?: SerpApiMapsResult[];
  search_metadata?: { status: string };
  error?: string;
}

/**
 * Extract a clean domain from a website URL.
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(
      url.startsWith("http") ? url : `https://${url}`,
    ).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Search Google Maps via SerpAPI for businesses matching the category + location.
 *
 * @param params Discovery search parameters from Settings.
 * @returns Array of discovered candidates with partial maps profile.
 */
export async function searchGoogleMaps(
  params: DiscoverySearchParams,
): Promise<{ candidates: DiscoveredCandidate[]; error?: string }> {
  const apiKey = await getCredential("serpapi");
  if (!apiKey) {
    return {
      candidates: [],
      error: "SerpAPI credential not found — complete the API key setup wizard first.",
    };
  }

  const start = Date.now();

  const query = params.category
    ? `${params.category} in ${params.location}`
    : params.location;

  const queryParams = new URLSearchParams({
    engine: "google_maps",
    q: query,
    api_key: apiKey,
    type: "search",
    hl: "en",
    ll: "", // Empty — let SerpAPI resolve from the text location
  });

  // If location is provided, use it as the location param for more accurate results
  queryParams.set("location", params.location);

  try {
    const response = await fetch(
      `${SERPAPI_API_BASE}/search.json?${queryParams.toString()}`,
    );
    const duration = Date.now() - start;

    if (!response.ok) {
      await logExternalCall("serpapi.google_maps", duration, 0);
      return {
        candidates: [],
        error: `SerpAPI Google Maps error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as SerpApiMapsResponse;

    if (data.error) {
      await logExternalCall("serpapi.google_maps", duration, 0);
      return {
        candidates: [],
        error: `SerpAPI Google Maps error: ${data.error}`,
      };
    }

    const results = data.local_results ?? [];
    await logExternalCall("serpapi.google_maps", duration, results.length);

    const candidates: DiscoveredCandidate[] = results.map((result) => {
      const domain = result.website ? extractDomain(result.website) : null;
      const category =
        result.type ?? (result.types ? result.types[0] : undefined);

      return {
        company_name: result.title,
        domain,
        source: "google_maps" as const,
        partial_profile: {
          maps: {
            category: category ?? "unknown",
            rating: result.rating ?? null,
            review_count: result.reviews ?? 0,
            photo_count: result.photos_count ?? 0,
            last_photo_date: null, // Not available in search results — enrichment fills this
          },
        },
        raw_source_data: {
          place_id: result.place_id,
          address: result.address,
          phone: result.phone,
          gps_coordinates: result.gps_coordinates,
          types: result.types,
        },
      };
    });

    return { candidates };
  } catch (err) {
    const duration = Date.now() - start;
    await logExternalCall("serpapi.google_maps", duration, 0);
    return {
      candidates: [],
      error: `Google Maps fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function logExternalCall(
  job: string,
  durationMs: number,
  resultCount: number,
): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job,
      actor_type: "internal",
      units: JSON.stringify({
        search_queries: 1,
        results_returned: resultCount,
      }),
      estimated_cost_aud: 0.005, // SerpAPI ~ $50/5000 searches
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
