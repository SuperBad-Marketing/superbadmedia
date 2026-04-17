/**
 * Google Maps photo enrichment — SerpAPI google_maps engine.
 * Populates maps.photo_count + maps.last_photo_date.
 * Merges into existing maps profile — does not overwrite category/rating/review_count.
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

interface SerpApiMapsPhotoResult {
  title?: string;
  photos_count?: number;
  user_reviews?: { date?: string }[];
}

export async function enrichMapsPhotos(
  businessName: string,
  location: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey || !businessName) return {};

  const startMs = Date.now();
  const query = [businessName, location].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    engine: "google_maps",
    q: query,
    api_key: apiKey,
    type: "search",
    num: "1",
  });

  let photoCount: number | undefined;
  let lastPhotoDate: string | null = null;
  let fetchError: string | undefined;

  try {
    const response = await fetch(`${SERPAPI_API_BASE}/search.json?${params}`);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `SerpAPI Maps Photos HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as {
        local_results?: SerpApiMapsPhotoResult[];
        error?: string;
      };
      if (data.error) {
        fetchError = `SerpAPI Maps Photos error: ${data.error}`;
      } else {
        const place = data.local_results?.[0];
        if (place) {
          photoCount = place.photos_count ?? 0;
          lastPhotoDate = inferLastPhotoDate(place);
        }
      }
    }
  } catch (err) {
    fetchError = `SerpAPI Maps Photos fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "serpapi:maps_photos",
    actor_type: "internal",
    units: JSON.stringify({ businessName, location, duration_ms: Date.now() - startMs }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) return { fetch_errors: { maps_photos: fetchError } };
  if (photoCount === undefined) return {};

  return {
    maps: {
      // Empty defaults — mergeProfiles will prefer non-empty values from prior enrichment
      category: "",
      rating: null,
      review_count: 0,
      photo_count: photoCount,
      last_photo_date: lastPhotoDate,
    },
  };
}

function inferLastPhotoDate(place: SerpApiMapsPhotoResult): string | null {
  const reviews = place.user_reviews ?? [];
  const dates = reviews.map((r) => r.date).filter((d): d is string => !!d);
  return dates[0] ?? null;
}
