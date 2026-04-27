import { runApifyActor } from "./apify-runner";
import type { DiscoveredCandidate, DiscoverySearchParams } from "../types";

const ACTOR_ID = "apify~instagram-search-scraper";

interface RawInstagramPlaceItem {
  name?: string;
  locationId?: string;
  address?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  externalUrl?: string;
  category?: string;
  mediaCount?: number;
  profilePicUrl?: string;
}

interface RawInstagramProfileItem {
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  externalUrl?: string;
  isVerified?: boolean;
  isBusiness?: boolean;
  businessCategory?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  latestPosts?: Array<{
    timestamp?: string;
    likesCount?: number;
    commentsCount?: number;
  }>;
}

type RawInstagramItem = RawInstagramPlaceItem & RawInstagramProfileItem;

function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(
      url.startsWith("http") ? url : `https://${url}`,
    ).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchInstagramLocation(
  params: DiscoverySearchParams,
): Promise<{ candidates: DiscoveredCandidate[]; error?: string }> {
  try {
    const items = await runApifyActor<RawInstagramItem>({
      actorId: ACTOR_ID,
      jobName: "apify.instagram_location",
      estimatedCostAud: 0.03,
      timeoutMs: 90_000,
      pollIntervalMs: 5_000,
      maxPollAttempts: 18,
      input: {
        search: params.location,
        searchType: "place",
        resultsLimit: Math.min(params.max_candidates * 3, 100),
      },
    });

    if (items.length === 0) {
      return { candidates: [] };
    }

    const radiusLimit = params.radius_km * 1.5;
    const candidates: DiscoveredCandidate[] = [];

    for (const item of items) {
      const name = item.name ?? item.fullName ?? item.username;
      if (!name) continue;

      if (item.lat != null && item.lng != null) {
        const dist = haversineKm(
          params.location_lat, params.location_lng,
          item.lat, item.lng,
        );
        if (dist > radiusLimit) continue;
      }

      const websiteUrl = item.externalUrl ?? item.website;
      const domain = extractDomain(websiteUrl);

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentPosts = (item.latestPosts ?? []).filter((p) => {
        if (!p.timestamp) return false;
        return new Date(p.timestamp).getTime() > thirtyDaysAgo;
      });

      candidates.push({
        company_name: name,
        domain,
        source: "instagram_location",
        partial_profile: {
          instagram: {
            follower_count: item.followersCount ?? 0,
            post_count: item.postsCount ?? item.mediaCount ?? 0,
            posts_last_30d: recentPosts.length > 0 ? recentPosts.length : null,
          },
        },
        raw_source_data: {
          username: item.username,
          location_id: item.locationId,
          address: item.address ?? item.businessAddress,
          city: item.city,
          phone: item.phone ?? item.businessPhone,
          email: item.businessEmail,
          category: item.category ?? item.businessCategory,
          is_business: item.isBusiness,
          is_verified: item.isVerified,
          lat: item.lat,
          lng: item.lng,
        },
      });
    }

    return { candidates };
  } catch (err) {
    return {
      candidates: [],
      error: `Instagram location search failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
