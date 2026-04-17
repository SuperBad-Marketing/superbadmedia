import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

interface SerpApiMapsResult {
  title?: string;
  photos_count?: number;
  user_reviews?: { date?: string }[];
}

interface SerpApiMapsResponse {
  local_results?: SerpApiMapsResult[];
  error?: string;
}

function extractLastPhotoDate(results: SerpApiMapsResult[]): string | null {
  const withDate = results.flatMap(
    (r) => r.user_reviews?.map((u) => u.date).filter(Boolean) ?? [],
  ) as string[];
  return withDate[0] ?? null;
}

/**
 * Enrich with Google Maps photo count and last photo date via SerpAPI.
 * Merges into existing maps profile — does not overwrite category/rating/review_count.
 * Logs to external_call_log (job: "serpapi:maps_photos").
 *
 * @param businessName - Used as the search query.
 * @param location - Location string (e.g. "Melbourne, Australia").
 * @param apiKey - SerpAPI key.
 */
export async function enrichMapsPhotos(
  businessName: string,
  location: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey) return {};

  const startMs = Date.now();
  let photo_count = 0;
  let last_photo_date: string | null = null;
  let fetchError: string | undefined;

  try {
    const params = new URLSearchParams({
      engine: "google_maps",
      q: `${businessName} ${location}`.trim(),
      api_key: apiKey,
      type: "search",
      num: "1",
    });

    const response = await fetch(
      `${SERPAPI_API_BASE}/search.json?${params.toString()}`,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `SerpAPI maps_photos HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as SerpApiMapsResponse;
      if (data.error) {
        fetchError = `SerpAPI maps_photos error: ${data.error}`;
      } else {
        const results = data.local_results ?? [];
        const match = results.find(
          (r) => r.title?.toLowerCase().includes(businessName.toLowerCase()),
        ) ?? results[0];

        if (match) {
          photo_count = match.photos_count ?? 0;
          last_photo_date = extractLastPhotoDate([match]);
        }
      }
    }
  } catch (err) {
    fetchError = `SerpAPI maps_photos fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "serpapi:maps_photos",
    actor_type: "internal",
    units: JSON.stringify({
      businessName,
      location,
      duration_ms: Date.now() - startMs,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) {
    return { fetch_errors: { maps_photos: fetchError } };
  }

  // Return only photo_count + last_photo_date; mergeProfiles preserves
  // existing category/rating/review_count from the LG-2 google-maps adapter.
  const mapsUpdate: Pick<
    NonNullable<ViabilityProfile["maps"]>,
    "photo_count" | "last_photo_date"
  > = { photo_count, last_photo_date };

  return { maps: mapsUpdate as ViabilityProfile["maps"] };
}
