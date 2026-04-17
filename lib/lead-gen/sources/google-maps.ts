/**
 * Google Maps discovery adapter (via SerpAPI `google_maps` engine).
 *
 * Queries SerpAPI for businesses in the given location and category.
 * Returns candidates with the `maps` portion of ViabilityProfile populated.
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

interface SerpApiMapsResult {
  title?: string;
  place_id?: string;
  website?: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  thumbnail?: string;
  photos_count?: number;
  operating_hours?: Record<string, string>;
  user_reviews?: { rating?: number; date?: string }[];
}

function extractDomain(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function inferLastPhotoDate(result: SerpApiMapsResult): string | null {
  if (!result.user_reviews?.length) return null;
  const withDate = result.user_reviews
    .map((r) => r.date)
    .filter(Boolean) as string[];
  if (!withDate.length) return null;
  return withDate[0] ?? null;
}

/**
 * Search Google Maps via SerpAPI for businesses matching the category + location.
 *
 * @param input - Search parameters.
 * @param apiKey - SerpAPI key from getCredential('serpapi').
 * @returns DiscoveryResult with candidates and maps profile data.
 */
export async function searchGoogleMaps(
  input: DiscoverySearchInput,
  apiKey: string,
): Promise<DiscoveryResult> {
  const startMs = Date.now();

  const query = [input.category, input.locationCentre]
    .filter(Boolean)
    .join(" in ");

  const params = new URLSearchParams({
    engine: "google_maps",
    q: query || input.locationCentre,
    api_key: apiKey,
    type: "search",
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
      fetchError = `SerpAPI Google Maps HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as {
        local_results?: SerpApiMapsResult[];
        error?: string;
      };

      if (data.error) {
        fetchError = `SerpAPI Google Maps error: ${data.error}`;
      } else {
        const results = data.local_results ?? [];

        for (const place of results) {
          if (candidates.length >= input.maxResults) break;
          const name = place.title?.trim();
          if (!name) continue;

          const category = place.type ?? place.types?.[0] ?? input.category;

          const profile: Partial<ViabilityProfile> = {
            maps: {
              category,
              rating: place.rating ?? null,
              review_count: place.reviews ?? 0,
              photo_count: place.photos_count ?? 0,
              last_photo_date: inferLastPhotoDate(place),
            },
          };

          candidates.push({
            businessName: name,
            domain: extractDomain(place.website),
            location: place.address ?? input.locationCentre,
            phone: place.phone ?? null,
            source: "google_maps",
            partialProfile: profile,
          });
        }
      }
    }
  } catch (err) {
    fetchError = `SerpAPI Google Maps fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "serpapi:google_maps",
    actor_type: "internal",
    units: JSON.stringify({
      candidates: candidates.length,
      duration_ms: Date.now() - startMs,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  return {
    source: "google_maps",
    candidates,
    ...(fetchError ? { fetchError } : {}),
  };
}
