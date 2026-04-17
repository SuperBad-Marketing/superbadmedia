/**
 * Lead Generation enrichment barrel.
 *
 * Exports all 6 enrichment adapters and the mergeProfiles() helper.
 * All enrichers return Partial<ViabilityProfile> and fail gracefully (return {}).
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import type { ViabilityProfile } from "@/lib/lead-gen/types";

export { enrichPageSpeed } from "./pagespeed";
export { enrichDomainAge } from "./domain-age";
export { enrichInstagram } from "./instagram";
export { enrichYouTube } from "./youtube";
export { enrichWebsiteScrape } from "./website-scrape";
export { enrichMapsPhotos } from "./maps-photos";

// ---------------------------------------------------------------------------
// mergeProfiles
// ---------------------------------------------------------------------------

type Website = NonNullable<ViabilityProfile["website"]>;
type Maps = NonNullable<ViabilityProfile["maps"]>;

/**
 * Merge the website sub-object from two partial profiles.
 * For nullable numerics: non-null wins (earlier first, later can override with non-null).
 * For booleans: true wins over false.
 * For enum-like strings: non-'unknown' wins.
 * Precedence: later (b) non-default value wins over earlier (a) default.
 */
function mergeWebsite(a: Website | undefined, b: Website | undefined): Website | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;

  return {
    pagespeed_performance_score:
      b.pagespeed_performance_score ?? a.pagespeed_performance_score,
    domain_age_years: b.domain_age_years ?? a.domain_age_years,
    has_about_page: b.has_about_page || a.has_about_page,
    has_pricing_page: b.has_pricing_page || a.has_pricing_page,
    team_size_signal:
      b.team_size_signal !== "unknown"
        ? b.team_size_signal
        : a.team_size_signal,
    stated_pricing_tier:
      b.stated_pricing_tier !== "unknown"
        ? b.stated_pricing_tier
        : a.stated_pricing_tier,
  };
}

/**
 * Merge the maps sub-object from two partial profiles.
 * category/rating/review_count: non-empty/non-null earlier value preserved.
 * photo_count/last_photo_date: later non-zero/non-null wins (maps-photos enricher wins).
 */
function mergeMaps(a: Maps | undefined, b: Maps | undefined): Maps | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;

  return {
    category: b.category || a.category,
    rating: b.rating ?? a.rating,
    review_count: b.review_count || a.review_count,
    photo_count: b.photo_count || a.photo_count,
    last_photo_date: b.last_photo_date ?? a.last_photo_date,
  };
}

/**
 * Merge an array of partial ViabilityProfiles into one complete ViabilityProfile.
 *
 * Merges left-to-right. For nested sub-objects (website, maps), per-field rules apply.
 * For top-level single-owner objects (instagram, youtube, meta_ads, google_ads),
 * the last non-undefined value wins.
 * fetch_errors are always aggregated across all profiles.
 */
export function mergeProfiles(
  profiles: Partial<ViabilityProfile>[],
): ViabilityProfile {
  let merged: ViabilityProfile = {};

  for (const profile of profiles) {
    merged = {
      meta_ads: profile.meta_ads ?? merged.meta_ads,
      google_ads: profile.google_ads ?? merged.google_ads,
      instagram: profile.instagram ?? merged.instagram,
      youtube: profile.youtube ?? merged.youtube,
      website: mergeWebsite(merged.website, profile.website),
      maps: mergeMaps(merged.maps, profile.maps),
      fetch_errors:
        merged.fetch_errors || profile.fetch_errors
          ? { ...merged.fetch_errors, ...profile.fetch_errors }
          : undefined,
    };
  }

  return merged;
}
