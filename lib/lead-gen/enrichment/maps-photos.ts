/**
 * Google Maps photo enrichment adapter (via SerpAPI).
 *
 * Queries SerpAPI google_maps engine for a specific business to retrieve
 * photo_count and last_photo_date. Merges into existing maps profile
 * without overwriting category/rating/review_count.
 * Logs to external_call_log (job: "serpapi:maps_photos").
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

interface SerpApiMapsResult {
  title?: string;
  photos_count?: number;
  user_reviews?: { rating?: number; date?: string }[];
}

interface SerpApiMapsResponse {
  local_results?: SerpApiMapsResult[];
  error?: string;
}

function findBestMatch(
  results: SerpApiMapsResult[],
  businessName: string,
): SerpApiMapsResult | undefined {
  const lower = businessName.toLowerCase();
  return (
    results.find((r) => r.title?.toLowerCase().includes(lower)) ??
    results[0]
  );
}

function inferLastPhotoDate(result: SerpApiMapsResult): string | null {
  const withDate = (result.user_reviews ?? [])
    .map((r) => r.date)
    .filter(Boolean) as string[];
  return withDate[0] ?? null;
}

/**
 * Enrich a candidate with Google Maps photo signals (count + recency).
 *
 * @param businessName - Business name for the SerpAPI query.
 * @param location - Location string (e.g. "Melbourne, Australia").
 * @param apiKey - SerpAPI key from getCredential('serpapi').
 */
export async function enrichMapsPhotos(
  businessName: string,
  location: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey) return {};

  const startMs = Date.now();
  let fetchErrorMsg: string | undefined;
  let photoCount = 0;
  let lastPhotoDate: string | null = null;
  let found = false;

  try {
    const params = new URLSearchParams({
      engine: "google_maps",
      q: `${businessName} ${location}`,
      api_key: apiKey,
      type: "search",
      num: "5",
    });

    const response = await fetch(
      `${SERPAPI_API_BASE}/search.json?${params.toString()}`,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchErrorMsg = `SerpAPI maps photos HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as SerpApiMapsResponse;

      if (data.error) {
        fetchErrorMsg = `SerpAPI maps photos error: ${data.error}`;
      } else {
        const results = data.local_results ?? [];
        const match = findBestMatch(results, businessName);

        if (match) {
          found = true;
          photoCount = match.photos_count ?? 0;
          lastPhotoDate = inferLastPhotoDate(match);
        }
      }
    }
  } catch (err) {
    fetchErrorMsg = `SerpAPI maps photos fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "serpapi:maps_photos",
    actor_type: "internal",
    units: JSON.stringify({
      businessName,
      found,
      duration_ms: Date.now() - startMs,
      ...(fetchErrorMsg ? { error: fetchErrorMsg } : {}),
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchErrorMsg) {
    return { fetch_errors: { maps_photos: fetchErrorMsg } };
  }
  if (!found) return {};

  // Return only photo fields — mergeProfiles will deep-merge with the
  // existing maps profile (category/rating/review_count set by LG-2).
  return {
    maps: {
      photo_count: photoCount,
      last_photo_date: lastPhotoDate,
      // Defaults for required fields — overridden by existing maps data via mergeProfiles
      category: "",
      rating: null,
      review_count: 0,
    },
  };
}
