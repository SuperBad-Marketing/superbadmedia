/**
 * Instagram Business Discovery enrichment — social maturity signal.
 *
 * Queries the Instagram Business Discovery API (Graph API endpoint) for
 * public business profile data: follower count, media count, and recent
 * posting cadence. Requires a Meta Business token with `instagram_basic`
 * scope and an Instagram Business or Creator account connected.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { META_GRAPH_API_VERSION } from "@/lib/integrations/vendors/meta-ads";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "../types";

export interface InstagramResult {
  follower_count: number | null;
  post_count: number | null;
  posts_last_30d: number | null;
  username: string | null;
  error?: string;
}

interface IgBusinessDiscoveryResponse {
  business_discovery?: {
    followers_count?: number;
    media_count?: number;
    media?: {
      data?: Array<{ timestamp: string }>;
    };
    username?: string;
  };
  error?: { message: string; type: string; code: number };
}

/**
 * Derive an Instagram username guess from a domain.
 * Strips TLD suffixes and common prefixes. This is a best-effort heuristic —
 * many businesses use their brand name as their IG handle.
 */
export function guessInstagramHandle(domain: string): string {
  return domain
    .replace(/\.(com|com\.au|net|org|io|co|co\.uk|net\.au|org\.au)$/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

/**
 * Fetch Instagram Business Discovery data for a candidate.
 *
 * @param domain Bare domain — used to guess the IG handle.
 * @param instagramHandle Optional known handle (overrides domain guess).
 * @returns Instagram profile signals or null fields on failure.
 */
export async function fetchInstagram(
  domain: string,
  instagramHandle?: string,
): Promise<InstagramResult> {
  const accessToken = await getCredential("meta-ads");
  if (!accessToken) {
    return {
      follower_count: null,
      post_count: null,
      posts_last_30d: null,
      username: null,
      error: "Meta Ads credential not found — needed for Instagram Business Discovery.",
    };
  }

  const handle = instagramHandle ?? guessInstagramHandle(domain);
  const start = Date.now();

  const fields = [
    "followers_count",
    "media_count",
    "media.limit(30){timestamp}",
    "username",
  ].join(",");

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: `business_discovery.fields(${fields})`,
  });

  // The Business Discovery API requires querying from your own IG business account
  // against the target username. The "me" endpoint with business_discovery works
  // when the token belongs to a connected IG Business account.
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me?${params.toString()}&business_discovery.username=${handle}`;

  try {
    // Business Discovery uses the ig_user_id endpoint with username lookup
    const actualUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/ig_username_search?q=${encodeURIComponent(handle)}&access_token=${accessToken}`;

    // Simplified: use the direct business_discovery endpoint
    const discoveryUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me?fields=business_discovery.fields(${encodeURIComponent(fields)})%7Busername%3D${encodeURIComponent(handle)}%7D&access_token=${accessToken}`;

    const response = await fetch(discoveryUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    const duration = Date.now() - start;
    await logCall(duration);

    if (!response.ok) {
      return {
        follower_count: null,
        post_count: null,
        posts_last_30d: null,
        username: handle,
        error: `Instagram API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as IgBusinessDiscoveryResponse;

    if (data.error) {
      return {
        follower_count: null,
        post_count: null,
        posts_last_30d: null,
        username: handle,
        error: `Instagram API error: ${data.error.message}`,
      };
    }

    const biz = data.business_discovery;
    if (!biz) {
      return {
        follower_count: null,
        post_count: null,
        posts_last_30d: null,
        username: handle,
        error: "No business_discovery data returned — account may not be a business account.",
      };
    }

    const postsLast30d = countRecentPosts(biz.media?.data ?? [], 30);

    return {
      follower_count: biz.followers_count ?? null,
      post_count: biz.media_count ?? null,
      posts_last_30d: postsLast30d,
      username: biz.username ?? handle,
    };
  } catch (err) {
    const duration = Date.now() - start;
    await logCall(duration);
    return {
      follower_count: null,
      post_count: null,
      posts_last_30d: null,
      username: handle,
      error: `Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Count posts published within the last N days from a media timestamp array.
 */
function countRecentPosts(
  media: Array<{ timestamp: string }>,
  days: number,
): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return media.filter((m) => new Date(m.timestamp).getTime() >= cutoff).length;
}

/**
 * Merge Instagram result into a partial ViabilityProfile.
 */
export function applyInstagramToProfile(
  profile: Partial<ViabilityProfile>,
  result: InstagramResult,
): Partial<ViabilityProfile> {
  if (
    result.follower_count === null &&
    result.post_count === null &&
    result.posts_last_30d === null
  ) {
    return {
      ...profile,
      fetch_errors: result.error
        ? { ...profile.fetch_errors, instagram: result.error }
        : profile.fetch_errors,
    };
  }

  return {
    ...profile,
    instagram: {
      follower_count: result.follower_count ?? 0,
      post_count: result.post_count ?? 0,
      posts_last_30d: result.posts_last_30d,
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, instagram: result.error }
      : profile.fetch_errors,
  };
}

async function logCall(durationMs: number): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job: "meta.instagram_business_discovery",
      actor_type: "internal",
      units: JSON.stringify({ api_calls: 1 }),
      estimated_cost_aud: 0,
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
