export { enrichPageSpeed } from "./pagespeed";
export { enrichDomainAge } from "./domain-age";
export { enrichInstagram } from "./instagram";
export { enrichYouTube } from "./youtube";
export { enrichWebsiteScrape } from "./website-scrape";
export { enrichMapsPhotos } from "./maps-photos";

import type { ViabilityProfile } from "@/lib/lead-gen/types";

type SubObject = Record<string, unknown>;

/**
 * Deep-merge partial profiles left-to-right.
 * - Top-level keys: later defined value wins.
 * - Sub-objects (website, maps, etc.): field-level merge where a later
 *   non-null value wins; a null from a later profile does NOT overwrite
 *   a non-null from an earlier profile. This lets per-field enrichers
 *   (pagespeed, domain-age, website-scrape) combine cleanly.
 * - fetch_errors: aggregated from all profiles.
 */
export function mergeProfiles(
  profiles: Partial<ViabilityProfile>[],
): ViabilityProfile {
  const result: SubObject = {};
  const allErrors: Record<string, string> = {};

  for (const profile of profiles) {
    const { fetch_errors, ...rest } = profile;

    for (const [key, value] of Object.entries(rest)) {
      if (value == null) continue;

      const existing = result[key];
      if (
        existing != null &&
        typeof existing === "object" &&
        !Array.isArray(existing) &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        result[key] = mergeSubObject(existing as SubObject, value as SubObject);
      } else {
        result[key] = value;
      }
    }

    if (fetch_errors) {
      Object.assign(allErrors, fetch_errors);
    }
  }

  if (Object.keys(allErrors).length > 0) {
    result.fetch_errors = allErrors;
  }

  return result as ViabilityProfile;
}

function mergeSubObject(existing: SubObject, incoming: SubObject): SubObject {
  const out: SubObject = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== null && v !== undefined) {
      // Non-null later value wins.
      out[k] = v;
    } else if (!(k in out) || out[k] === null || out[k] === undefined) {
      // Only write null/undefined if the field isn't already set to something.
      out[k] = v;
    }
  }
  return out;
}
