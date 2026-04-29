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
  type ScrapedContact,
  type ScrapedPhone,
  type ScrapedSocialLinks,
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
  scraped_contacts: ScrapedContact[];
  scraped_phones: ScrapedPhone[];
  scraped_social_links: ScrapedSocialLinks;
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
  let scrapedContacts: ScrapedContact[] = [];
  let scrapedPhones: ScrapedPhone[] = [];
  let scrapedSocialLinks: ScrapedSocialLinks = {
    instagram_url: null, facebook_url: null, linkedin_url: null,
    tiktok_url: null, twitter_url: null, youtube_url: null,
  };
  let igUsername: string | null = null;

  const hasDomain = !!candidate.domain;
  const placeId = (candidate.raw_source_data as Record<string, unknown>)
    ?.place_id as string | undefined;

  // Phase 1: Website scrape runs first so we can extract real social handles
  // for downstream enrichment (Instagram handle from footer links, etc.)
  if (hasDomain) {
    signalsAttempted++;
    try {
      const scrapeResult = await scrapeWebsite(candidate.domain!);
      profile = applyWebsiteScrapeToProfile(profile, scrapeResult);
      scrapedContacts = scrapeResult.scraped_contacts;
      scrapedPhones = scrapeResult.scraped_phones;
      scrapedSocialLinks = scrapeResult.scraped_social_links;
      if (scrapeResult.has_about_page || scrapeResult.has_pricing_page) signalsSucceeded++;
    } catch {
      // Website scrape failed — continue with remaining signals
    }
  }

  // Manual social handles from admin UI always win over scraped/guessed values
  const manual = candidate.manual_social;

  // Instagram handle priority: manual > scraped footer link > domain guess
  const scrapedIgHandle = manual?.instagram_handle
    ?? (scrapedSocialLinks.instagram_url
      ? extractHandleFromUrl(scrapedSocialLinks.instagram_url)
      : undefined);

  // Phase 2: Remaining signals in parallel (Instagram now uses real handle)
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
        const result = await fetchInstagram(candidate.domain!, scrapedIgHandle);
        profile = applyInstagramToProfile(profile, result);
        if (result.follower_count !== null) signalsSucceeded++;
        if (result.username) igUsername = result.username;
      },
    },
    {
      name: "youtube",
      requires_domain: false,
      run: async () => {
        const result = await fetchYouTube(
          candidate.company_name,
          candidate.domain,
          manual?.youtube_url ?? undefined,
        );
        profile = applyYouTubeToProfile(profile, result);
        if (result.subscriber_count !== null) signalsSucceeded++;
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
  signalsAttempted += eligibleTasks.length;

  // Run remaining signals in parallel
  await Promise.allSettled(eligibleTasks.map((t) => t.run()));

  const finalProfile = profile as ViabilityProfile;
  finalProfile.social_profiles = {
    instagram_url:
      (manual?.instagram_handle ? `https://www.instagram.com/${manual.instagram_handle}/` : null)
      ?? scrapedSocialLinks.instagram_url
      ?? (igUsername ? `https://www.instagram.com/${igUsername}/` : null),
    facebook_url: manual?.facebook_url ?? scrapedSocialLinks.facebook_url,
    linkedin_url: manual?.linkedin_url ?? scrapedSocialLinks.linkedin_url,
    tiktok_url: manual?.tiktok_url ?? scrapedSocialLinks.tiktok_url,
    twitter_url: scrapedSocialLinks.twitter_url,
    youtube_url: manual?.youtube_url ?? scrapedSocialLinks.youtube_url,
  };

  return {
    profile: finalProfile,
    enrichment_duration_ms: Date.now() - start,
    signals_attempted: signalsAttempted,
    signals_succeeded: signalsSucceeded,
    scraped_contacts: scrapedContacts,
    scraped_phones: scrapedPhones,
    scraped_social_links: scrapedSocialLinks,
  };
}

function extractHandleFromUrl(url: string): string | undefined {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    const handle = path.split("/")[0];
    return handle && handle.length > 0 ? handle : undefined;
  } catch {
    return undefined;
  }
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
export type { ScrapedContact, ScrapedPhone, ScrapedSocialLinks } from "./website-scrape";
export {
  fetchMapsExtras,
  parseRelativeDate,
  applyMapsExtrasToProfile,
} from "./maps-extras";
