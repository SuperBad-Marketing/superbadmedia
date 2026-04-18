/**
 * Enrichment orchestrator — runs all six qualification signals in parallel
 * and merges results into a complete ViabilityProfile.
 *
 * This is step 4 of the daily run sequence (spec §3.4):
 *   "Enrich each survivor with the 9-signal set in parallel."
 *
 * Three signals (meta_ads, google_ads, maps basics) are already seeded by
 * the discovery sources (LG-2). This module handles the remaining six:
 *   1. PageSpeed Insights → website.pagespeed_performance_score
 *   2. WHOIS (RDAP) → website.domain_age_years
 *   3. Instagram Business Discovery → instagram.*
 *   4. YouTube Data API → youtube.*
 *   5. Website scrape → website.has_about_page, has_pricing_page, team_size_signal, stated_pricing_tier
 *   6. Maps extras (photo metadata) → maps.photo_count, maps.last_photo_date
 *
 * Owner: LG-3. Consumer: daily search runner (LG-4).
 */

import type { DiscoveredCandidate, ViabilityProfile } from "../types";
import { fetchPageSpeed, applyPageSpeedToProfile } from "./pagespeed";
import { fetchWhois, applyWhoisToProfile } from "./whois";
import {
  fetchInstagram,
  applyInstagramToProfile,
} from "./instagram";
import { fetchYouTube, applyYouTubeToProfile } from "./youtube";
import {
  scrapeWebsite,
  applyWebsiteScrapeToProfile,
} from "./website-scrape";
import {
  fetchMapsExtras,
  applyMapsExtrasToProfile,
} from "./maps-extras";

export interface EnrichmentResult {
  profile: ViabilityProfile;
  enrichment_duration_ms: number;
  signals_attempted: number;
  signals_succeeded: number;
}

/**
 * Enrich a discovered candidate with all six qualification signals.
 *
 * Runs all signals in parallel via Promise.allSettled. Each signal
 * degrades gracefully — a failure in one never blocks the others.
 * The partial profile from discovery is preserved and extended.
 *
 * Candidates without a domain skip domain-dependent signals
 * (PageSpeed, whois, website scrape, Instagram) — only YouTube
 * (name-based search) and Maps extras (place_id-based) run.
 */
export async function enrichCandidate(
  candidate: DiscoveredCandidate,
): Promise<EnrichmentResult> {
  const start = Date.now();
  let profile: Partial<ViabilityProfile> = { ...candidate.partial_profile };
  let signalsAttempted = 0;
  let signalsSucceeded = 0;

  const hasDomain = !!candidate.domain;
  const placeId = (candidate.raw_source_data as Record<string, unknown>)
    ?.place_id as string | undefined;

  // Build the set of enrichment tasks based on what data we have
  const tasks: Array<{
    name: string;
    run: () => Promise<void>;
    requires_domain: boolean;
  }> = [
    {
      name: "pagespeed",
      requires_domain: true,
      run: async () => {
        const result = await fetchPageSpeed(candidate.domain!);
        profile = applyPageSpeedToProfile(profile, result);
        if (result.performance_score !== null) signalsSucceeded++;
      },
    },
    {
      name: "whois",
      requires_domain: true,
      run: async () => {
        const result = await fetchWhois(candidate.domain!);
        profile = applyWhoisToProfile(profile, result);
        if (result.domain_age_years !== null) signalsSucceeded++;
      },
    },
    {
      name: "instagram",
      requires_domain: true,
      run: async () => {
        const result = await fetchInstagram(candidate.domain!);
        profile = applyInstagramToProfile(profile, result);
        if (result.follower_count !== null) signalsSucceeded++;
      },
    },
    {
      name: "youtube",
      requires_domain: false,
      run: async () => {
        const result = await fetchYouTube(
          candidate.company_name,
          candidate.domain,
        );
        profile = applyYouTubeToProfile(profile, result);
        if (result.subscriber_count !== null) signalsSucceeded++;
      },
    },
    {
      name: "website_scrape",
      requires_domain: true,
      run: async () => {
        const result = await scrapeWebsite(candidate.domain!);
        profile = applyWebsiteScrapeToProfile(profile, result);
        if (result.has_about_page || result.has_pricing_page) signalsSucceeded++;
      },
    },
    {
      name: "maps_extras",
      requires_domain: false,
      run: async () => {
        if (!placeId) return;
        const result = await fetchMapsExtras(placeId);
        profile = applyMapsExtrasToProfile(profile, result);
        if (result.last_photo_date !== null) signalsSucceeded++;
      },
    },
  ];

  // Filter tasks: skip domain-dependent signals when no domain
  const eligibleTasks = tasks.filter(
    (t) => !t.requires_domain || hasDomain,
  );
  signalsAttempted = eligibleTasks.length;

  // Run all eligible signals in parallel
  await Promise.allSettled(eligibleTasks.map((t) => t.run()));

  return {
    profile: profile as ViabilityProfile,
    enrichment_duration_ms: Date.now() - start,
    signals_attempted: signalsAttempted,
    signals_succeeded: signalsSucceeded,
  };
}

// Re-export individual modules for direct access
export { fetchPageSpeed, applyPageSpeedToProfile } from "./pagespeed";
export { fetchWhois, applyWhoisToProfile } from "./whois";
export {
  fetchInstagram,
  guessInstagramHandle,
  applyInstagramToProfile,
} from "./instagram";
export { fetchYouTube, applyYouTubeToProfile } from "./youtube";
export {
  scrapeWebsite,
  inferTeamSize,
  inferPricingTier,
  applyWebsiteScrapeToProfile,
} from "./website-scrape";
export {
  fetchMapsExtras,
  parseRelativeDate,
  applyMapsExtrasToProfile,
} from "./maps-extras";
