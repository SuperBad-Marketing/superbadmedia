import type { ViabilityProfile } from "@/lib/lead-gen/types";
import {
  fetchPageSpeed,
  applyPageSpeedToProfile,
  fetchWhois,
  applyWhoisToProfile,
  fetchInstagram,
  applyInstagramToProfile,
  fetchYouTube,
  applyYouTubeToProfile,
  scrapeWebsite,
  applyWebsiteScrapeToProfile,
  fetchMapsExtras,
  applyMapsExtrasToProfile,
} from "@/lib/lead-gen/enrich";
import { searchMetaAdLibraryApify } from "@/lib/lead-gen/sources/apify-meta-ad-library";
import { searchGoogleMaps } from "@/lib/lead-gen/sources/google-maps";
import { searchGoogleAdsTransparency } from "@/lib/lead-gen/sources/google-ads-transparency";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";

export interface AuditInput {
  businessName: string;
  domain: string;
  websiteUrl: string;
  email: string;
  instagramHandle?: string | null;
  facebookPageUrl?: string | null;
  youtubeChannel?: string | null;
  googleMapsUrl?: string | null;
}

export type SignalName =
  | "meta_ads"
  | "google_ads"
  | "google_maps"
  | "pagespeed"
  | "whois"
  | "instagram"
  | "youtube"
  | "website_scrape"
  | "maps_extras";

export interface AuditEnrichmentResult {
  profile: ViabilityProfile;
  duration_ms: number;
  signals_attempted: number;
  signals_succeeded: number;
  failed_signals: SignalName[];
}

export type SignalProgressCallback = (signal: SignalName, status: "complete" | "failed") => void;

function extractPlaceIdFromUrl(url: string): string | null {
  const placeMatch = url.match(/place_id[=:]([^&/]+)/i);
  if (placeMatch) return placeMatch[1];
  const ftidMatch = url.match(/ftid[=:]([^&/]+)/i);
  if (ftidMatch) return ftidMatch[1];
  return null;
}

function extractPageIdFromUrl(url: string): string | null {
  const match = url.match(/facebook\.com\/(?:pages\/[^/]+\/)?(\d{10,})/);
  return match ? match[1] : null;
}

async function logAuditCall(
  job: string,
  submissionId: string,
  costAud: number,
): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job,
      actor_type: "prospect",
      actor_id: submissionId,
      units: JSON.stringify({ audit_calls: 1 }),
      estimated_cost_aud: costAud,
      created_at_ms: Date.now(),
    });
  } catch {
    // best-effort
  }
}

export async function runAuditEnrichment(
  input: AuditInput,
  submissionId: string,
  onProgress?: SignalProgressCallback,
): Promise<AuditEnrichmentResult> {
  const start = Date.now();
  let profile: Partial<ViabilityProfile> = {};
  const fetchErrors: Record<string, string> = {};
  const failedSignals: SignalName[] = [];
  let signalsSucceeded = 0;

  const tasks: Array<{
    name: SignalName;
    run: () => Promise<void>;
  }> = [
    {
      name: "meta_ads",
      run: async () => {
        const result = await searchMetaAdLibraryApify({
          location: "",
          radius_km: 0,
          location_lat: 0,
          location_lng: 0,
          country_code: "AU",
          brief: input.domain,
          max_candidates: 5,
        });
        if (result.error) {
          fetchErrors.meta_ads = result.error;
          return;
        }
        const match = result.candidates.find(
          (c) => c.domain === input.domain || c.company_name.toLowerCase().includes(input.businessName.toLowerCase()),
        );
        if (match?.partial_profile.meta_ads) {
          profile.meta_ads = match.partial_profile.meta_ads;
          signalsSucceeded++;
        }
        await logAuditCall("audit.meta_ads", submissionId, 0);
      },
    },
    {
      name: "google_ads",
      run: async () => {
        const result = await searchGoogleAdsTransparency({
          location: "",
          radius_km: 0,
          location_lat: 0,
          location_lng: 0,
          country_code: "AU",
          brief: input.domain,
          max_candidates: 5,
        });
        if (result.error) {
          fetchErrors.google_ads = result.error;
          return;
        }
        const match = result.candidates.find(
          (c) => c.domain === input.domain,
        );
        if (match?.partial_profile.google_ads) {
          profile.google_ads = match.partial_profile.google_ads;
          signalsSucceeded++;
        }
        await logAuditCall("audit.google_ads", submissionId, 0.005);
      },
    },
    {
      name: "google_maps",
      run: async () => {
        if (input.googleMapsUrl) {
          const placeId = extractPlaceIdFromUrl(input.googleMapsUrl);
          if (placeId) {
            const extras = await fetchMapsExtras(placeId);
            profile.maps = {
              category: "unknown",
              rating: null,
              review_count: 0,
              photo_count: extras.photo_count ?? 0,
              last_photo_date: extras.last_photo_date,
            };
            signalsSucceeded++;
            await logAuditCall("audit.google_maps", submissionId, 0.005);
            return;
          }
        }
        const result = await searchGoogleMaps({
          category: input.businessName,
          location: "",
          radius_km: 0,
          location_lat: 0,
          location_lng: 0,
          country_code: "AU",
          brief: "",
          max_candidates: 5,
        });
        if (result.error) {
          fetchErrors.google_maps = result.error;
          return;
        }
        const match = result.candidates.find(
          (c) =>
            c.domain === input.domain ||
            c.company_name.toLowerCase().includes(input.businessName.toLowerCase()),
        );
        if (match?.partial_profile.maps) {
          profile.maps = match.partial_profile.maps;
          signalsSucceeded++;
        }
        await logAuditCall("audit.google_maps", submissionId, 0.005);
      },
    },
    {
      name: "pagespeed",
      run: async () => {
        const result = await fetchPageSpeed(input.domain);
        profile = applyPageSpeedToProfile(profile, result);
        if (result.performance_score !== null) signalsSucceeded++;
        else if (result.error) fetchErrors.pagespeed = result.error;
        await logAuditCall("audit.pagespeed", submissionId, 0);
      },
    },
    {
      name: "whois",
      run: async () => {
        const result = await fetchWhois(input.domain);
        profile = applyWhoisToProfile(profile, result);
        if (result.domain_age_years !== null) signalsSucceeded++;
        else if (result.error) fetchErrors.whois = result.error;
        await logAuditCall("audit.whois", submissionId, 0);
      },
    },
    {
      name: "instagram",
      run: async () => {
        const result = await fetchInstagram(
          input.domain,
          input.instagramHandle || undefined,
        );
        profile = applyInstagramToProfile(profile, result);
        if (result.follower_count !== null) signalsSucceeded++;
        else if (result.error) fetchErrors.instagram = result.error;
        await logAuditCall("audit.instagram", submissionId, 0);
      },
    },
    {
      name: "youtube",
      run: async () => {
        const result = await fetchYouTube(
          input.youtubeChannel || input.businessName,
          input.domain,
        );
        profile = applyYouTubeToProfile(profile, result);
        if (result.subscriber_count !== null) signalsSucceeded++;
        else if (result.error) fetchErrors.youtube = result.error;
        await logAuditCall("audit.youtube", submissionId, 0);
      },
    },
    {
      name: "website_scrape",
      run: async () => {
        const result = await scrapeWebsite(input.domain);
        profile = applyWebsiteScrapeToProfile(profile, result);
        if (result.has_about_page || result.has_pricing_page) signalsSucceeded++;
        await logAuditCall("audit.website_scrape", submissionId, 0);
      },
    },
    {
      name: "maps_extras",
      run: async () => {
        if (!profile.maps) return;
        // maps_extras needs a place_id; skip if we didn't get one from the maps search
      },
    },
  ];

  const signalsAttempted = tasks.length;

  await Promise.allSettled(
    tasks.map(async (t) => {
      try {
        await t.run();
        onProgress?.(t.name, "complete");
      } catch (err) {
        fetchErrors[t.name] = err instanceof Error ? err.message : String(err);
        failedSignals.push(t.name);
        onProgress?.(t.name, "failed");
      }
    }),
  );

  if (Object.keys(fetchErrors).length > 0) {
    profile.fetch_errors = fetchErrors;
  }

  return {
    profile: profile as ViabilityProfile,
    duration_ms: Date.now() - start,
    signals_attempted: signalsAttempted,
    signals_succeeded: signalsSucceeded,
    failed_signals: failedSignals,
  };
}
