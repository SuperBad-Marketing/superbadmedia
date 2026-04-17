/**
 * Lead Generation enrichment barrel.
 * Exports all 6 enrichers + mergeProfiles helper.
 * Owner: LG-3.
 */

export { enrichPageSpeed } from "./pagespeed";
export { enrichDomainAge } from "./domain-age";
export { enrichInstagram } from "./instagram";
export { enrichYouTube } from "./youtube";
export { enrichWebsiteScrape } from "./website-scrape";
export { enrichMapsPhotos } from "./maps-photos";

import type { ViabilityProfile } from "@/lib/lead-gen/types";

/**
 * Merge an array of partial ViabilityProfiles into a single ViabilityProfile.
 * Profiles are applied left-to-right; later meaningful values win over defaults.
 * fetch_errors from all profiles are aggregated.
 *
 * "Meaningful" means: not null, not empty string, not zero, not "unknown" enum value.
 * Exceptions: boolean fields use OR semantics (once true, stays true).
 */
export function mergeProfiles(
  profiles: Partial<ViabilityProfile>[],
): ViabilityProfile {
  const merged: ViabilityProfile = {};
  const allErrors: Record<string, string> = {};

  for (const profile of profiles) {
    if (profile.meta_ads !== undefined) {
      merged.meta_ads = profile.meta_ads;
    }
    if (profile.google_ads !== undefined) {
      merged.google_ads = profile.google_ads;
    }
    if (profile.website !== undefined) {
      merged.website = mergeWebsite(merged.website, profile.website);
    }
    if (profile.instagram !== undefined) {
      merged.instagram = mergeInstagram(merged.instagram, profile.instagram);
    }
    if (profile.youtube !== undefined) {
      merged.youtube = mergeYouTube(merged.youtube, profile.youtube);
    }
    if (profile.maps !== undefined) {
      merged.maps = mergeMaps(merged.maps, profile.maps);
    }
    if (profile.fetch_errors) {
      Object.assign(allErrors, profile.fetch_errors);
    }
  }

  if (Object.keys(allErrors).length > 0) {
    merged.fetch_errors = allErrors;
  }

  return merged;
}

function isMeaningful(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (val === "" || val === "unknown") return false;
  if (val === 0) return false;
  return true;
}

function prefer<T>(base: T, overlay: T): T {
  return isMeaningful(overlay) ? overlay : isMeaningful(base) ? base : overlay;
}

function mergeWebsite(
  base: ViabilityProfile["website"],
  overlay: ViabilityProfile["website"],
): ViabilityProfile["website"] {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    domain_age_years: prefer(base.domain_age_years, overlay.domain_age_years),
    pagespeed_performance_score: prefer(
      base.pagespeed_performance_score,
      overlay.pagespeed_performance_score,
    ),
    has_about_page: base.has_about_page || overlay.has_about_page,
    has_pricing_page: base.has_pricing_page || overlay.has_pricing_page,
    team_size_signal: prefer(base.team_size_signal, overlay.team_size_signal),
    stated_pricing_tier: prefer(base.stated_pricing_tier, overlay.stated_pricing_tier),
  };
}

function mergeInstagram(
  base: ViabilityProfile["instagram"],
  overlay: ViabilityProfile["instagram"],
): ViabilityProfile["instagram"] {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    follower_count: prefer(base.follower_count, overlay.follower_count),
    post_count: prefer(base.post_count, overlay.post_count),
    posts_last_30d: prefer(base.posts_last_30d, overlay.posts_last_30d),
  };
}

function mergeYouTube(
  base: ViabilityProfile["youtube"],
  overlay: ViabilityProfile["youtube"],
): ViabilityProfile["youtube"] {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    subscriber_count: prefer(base.subscriber_count, overlay.subscriber_count),
    video_count: prefer(base.video_count, overlay.video_count),
    uploads_last_90d: prefer(base.uploads_last_90d, overlay.uploads_last_90d),
  };
}

function mergeMaps(
  base: ViabilityProfile["maps"],
  overlay: ViabilityProfile["maps"],
): ViabilityProfile["maps"] {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    category: prefer(base.category, overlay.category),
    rating: prefer(base.rating, overlay.rating),
    review_count: prefer(base.review_count, overlay.review_count),
    photo_count: prefer(base.photo_count, overlay.photo_count),
    last_photo_date: prefer(base.last_photo_date, overlay.last_photo_date),
  };
}
