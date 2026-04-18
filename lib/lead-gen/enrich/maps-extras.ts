/**
 * Google Maps extras enrichment — photo count + last photo date.
 *
 * Queries SerpAPI `google_maps_photos` engine for a place_id to get
 * photo metadata. Supplements the basic Maps data already captured
 * during discovery (LG-2) with recency-of-activity signals.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "../types";

interface SerpApiPhotosResult {
  date?: string; // e.g. "2 months ago", "March 2024"
  thumbnail?: string;
}

interface SerpApiPhotosResponse {
  photos?: SerpApiPhotosResult[];
  error?: string;
}

export interface MapsExtrasResult {
  photo_count: number;
  last_photo_date: string | null;
  error?: string;
}

/**
 * Parse a SerpAPI relative date string into an approximate ISO date.
 * SerpAPI returns dates like "2 months ago", "March 2024", "a year ago".
 */
export function parseRelativeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const now = new Date();

  // Try "N months/years/weeks/days ago" format
  const agoMatch = dateStr.match(
    /(\d+|a)\s*(day|week|month|year)s?\s*ago/i,
  );

  if (agoMatch) {
    const amount = agoMatch[1] === "a" ? 1 : parseInt(agoMatch[1], 10);
    const unit = agoMatch[2].toLowerCase();

    const d = new Date(now);
    if (unit === "day") d.setDate(d.getDate() - amount);
    else if (unit === "week") d.setDate(d.getDate() - amount * 7);
    else if (unit === "month") d.setMonth(d.getMonth() - amount);
    else if (unit === "year") d.setFullYear(d.getFullYear() - amount);

    return d.toISOString().split("T")[0];
  }

  // Try "Month Year" format (e.g. "March 2024")
  const monthYearMatch = dateStr.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i,
  );

  if (monthYearMatch) {
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ];
    const monthIndex = monthNames.indexOf(monthYearMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      const year = monthYearMatch[2];
      const month = String(monthIndex + 1).padStart(2, "0");
      return `${year}-${month}-01`;
    }
  }

  return null;
}

/**
 * Fetch additional Maps data (photo count + last photo date) for a place.
 *
 * @param placeId Google Maps place_id from the discovery step.
 * @param existingMaps Partial maps profile from discovery (to merge with).
 * @returns Updated maps extras or error.
 */
export async function fetchMapsExtras(
  placeId: string,
): Promise<MapsExtrasResult> {
  const apiKey = await getCredential("serpapi");
  if (!apiKey) {
    return {
      photo_count: 0,
      last_photo_date: null,
      error: "SerpAPI credential not found.",
    };
  }

  const start = Date.now();

  const params = new URLSearchParams({
    engine: "google_maps_photos",
    data_id: placeId,
    api_key: apiKey,
  });

  try {
    const response = await fetch(
      `${SERPAPI_API_BASE}/search.json?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const duration = Date.now() - start;
    await logCall(duration);

    if (!response.ok) {
      return {
        photo_count: 0,
        last_photo_date: null,
        error: `SerpAPI Maps Photos error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as SerpApiPhotosResponse;

    if (data.error) {
      return {
        photo_count: 0,
        last_photo_date: null,
        error: `SerpAPI Maps Photos error: ${data.error}`,
      };
    }

    const photos = data.photos ?? [];

    // Find the most recent photo date
    let latestDate: string | null = null;
    for (const photo of photos) {
      if (photo.date) {
        const parsed = parseRelativeDate(photo.date);
        if (parsed && (!latestDate || parsed > latestDate)) {
          latestDate = parsed;
        }
      }
    }

    return {
      photo_count: photos.length,
      last_photo_date: latestDate,
    };
  } catch (err) {
    const duration = Date.now() - start;
    await logCall(duration);
    return {
      photo_count: 0,
      last_photo_date: null,
      error: `Maps photos fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Merge Maps extras result into a partial ViabilityProfile.
 * Updates the existing maps section if present, or creates one.
 */
export function applyMapsExtrasToProfile(
  profile: Partial<ViabilityProfile>,
  result: MapsExtrasResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    maps: {
      category: profile.maps?.category ?? "unknown",
      rating: profile.maps?.rating ?? null,
      review_count: profile.maps?.review_count ?? 0,
      photo_count: result.photo_count || (profile.maps?.photo_count ?? 0),
      last_photo_date: result.last_photo_date ?? (profile.maps?.last_photo_date ?? null),
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, maps_extras: result.error }
      : profile.fetch_errors,
  };
}

async function logCall(durationMs: number): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job: "serpapi.google_maps_photos",
      actor_type: "internal",
      units: JSON.stringify({ search_queries: 1 }),
      estimated_cost_aud: 0.005,
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
