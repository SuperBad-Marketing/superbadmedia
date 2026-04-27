import { runApifyActor } from "./apify-runner";
import type { DiscoveredCandidate, DiscoverySearchParams } from "../types";

const ACTOR_ID = "curious_coder~facebook-ads-library-scraper";

interface RawAdLibraryItem {
  page_id?: string;
  page_name?: string;
  page_profile_picture_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_snapshot_url?: string;
  estimated_audience_size?: { lower_bound?: number; upper_bound?: number };
  impressions?: { lower_bound?: number; upper_bound?: number };
  spend?: { lower_bound?: number; upper_bound?: number };
  currency?: string;
  is_active?: boolean;
  publisher_platforms?: string[];
}

function classifySpendBracket(
  spend?: { lower_bound?: number; upper_bound?: number },
  audience?: { lower_bound?: number; upper_bound?: number },
): "unknown" | "low" | "medium" | "high" {
  if (spend?.lower_bound != null && spend?.upper_bound != null) {
    const mid = (spend.lower_bound + spend.upper_bound) / 2;
    if (mid < 500) return "low";
    if (mid < 5_000) return "medium";
    return "high";
  }
  if (audience?.lower_bound != null && audience?.upper_bound != null) {
    const mid = (audience.lower_bound + audience.upper_bound) / 2;
    if (mid < 5_000) return "low";
    if (mid < 50_000) return "medium";
    return "high";
  }
  return "unknown";
}

function extractDomainFromCreatives(item: RawAdLibraryItem): string | null {
  const captions = item.ad_creative_link_captions ?? [];
  for (const caption of captions) {
    const cleaned = caption
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
    if (cleaned.includes(".") && !cleaned.includes(" ")) {
      return cleaned;
    }
  }
  return null;
}

export async function searchMetaAdLibraryApify(
  params: DiscoverySearchParams,
): Promise<{ candidates: DiscoveredCandidate[]; error?: string }> {
  const countryCode = params.country_code || "AU";
  const adLibraryUrl =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${countryCode}&q=&search_type=keyword_unordered`;

  try {
    const items = await runApifyActor<RawAdLibraryItem>({
      actorId: ACTOR_ID,
      jobName: "apify.meta_ad_library",
      estimatedCostAud: 0.05,
      timeoutMs: 120_000,
      pollIntervalMs: 5_000,
      maxPollAttempts: 24,
      input: {
        startUrls: [{ url: adLibraryUrl }],
        maxAds: Math.min(params.max_candidates * 3, 150),
        countryCode,
      },
    });

    if (items.length === 0) {
      return { candidates: [] };
    }

    const seenPageIds = new Set<string>();
    const candidates: DiscoveredCandidate[] = [];

    for (const item of items) {
      const pageId = item.page_id ?? item.page_name;
      if (!pageId) continue;
      if (seenPageIds.has(pageId)) continue;
      seenPageIds.add(pageId);

      const domain = extractDomainFromCreatives(item);
      const spendBracket = classifySpendBracket(
        item.spend,
        item.estimated_audience_size,
      );

      candidates.push({
        company_name: item.page_name ?? "Unknown Advertiser",
        domain,
        source: "meta_ad_library",
        partial_profile: {
          meta_ads: {
            active_ad_count: 1,
            estimated_spend_bracket: spendBracket,
            has_active_creatives: true,
          },
        },
        raw_source_data: {
          page_id: item.page_id,
          ad_delivery_start_time: item.ad_delivery_start_time,
          estimated_audience_size: item.estimated_audience_size,
          spend: item.spend,
          publisher_platforms: item.publisher_platforms,
        },
      });
    }

    return { candidates };
  } catch (err) {
    return {
      candidates: [],
      error: `Meta Ad Library (Apify) failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
