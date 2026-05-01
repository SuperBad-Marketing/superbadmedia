/**
 * Instagram enrichment — social maturity signal.
 *
 * Two-tier strategy:
 *   1. Meta Graph API (Business Discovery) — free, fast, but requires a
 *      connected IG Business account + token.
 *   2. Apify `instagram-profile-scraper` — paid (~$0.03/run), no auth
 *      needed, works on any public profile. Used as automatic fallback
 *      when Meta credential is missing or the API call fails.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { META_GRAPH_API_VERSION } from "@/lib/integrations/vendors/meta";
import { logExternalCall } from "@/lib/observatory";
import { runApifyActor } from "@/lib/lead-gen/sources/apify-runner";
import type { ViabilityProfile } from "../types";
import type { EnrichmentMatchSource } from "./youtube";

export interface InstagramResult {
  follower_count: number | null;
  post_count: number | null;
  posts_last_30d: number | null;
  username: string | null;
  match_source: EnrichmentMatchSource;
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

interface ApifyInstagramProfile {
  username?: string;
  followersCount?: number;
  postsCount?: number;
  latestPosts?: Array<{ timestamp?: string }>;
  posts?: Array<{ timestamp?: string }>;
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
 * Fetch Instagram profile data for a candidate.
 * Tries Meta Graph API first; falls back to Apify scraper.
 *
 * @param matchSource How the handle was resolved — "manual" (admin UI),
 *   "scraped" (website footer), or "searched" (domain guess).
 */
export async function fetchInstagram(
  domain: string,
  instagramHandle?: string,
  matchSource?: EnrichmentMatchSource,
): Promise<InstagramResult> {
  const handle = instagramHandle ?? guessInstagramHandle(domain);
  const source: EnrichmentMatchSource = matchSource ?? (instagramHandle ? "scraped" : "searched");

  const metaResult = await fetchViaMetaGraphApi(handle);
  if (metaResult.follower_count !== null) return { ...metaResult, match_source: source };

  const apifyResult = await fetchViaApify(handle);
  return { ...apifyResult, match_source: source };
}

// ── Meta Graph API (tier 1) ──────────────────────────────────────────

async function fetchViaMetaGraphApi(
  handle: string,
): Promise<InstagramResult> {
  const accessToken = await getCredential("meta");
  if (!accessToken) {
    return emptyResult(handle, "Meta credential not configured — falling back to Apify.");
  }

  const fields = [
    "followers_count",
    "media_count",
    "media.limit(30){timestamp}",
    "username",
  ].join(",");

  const discoveryUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me?fields=business_discovery.fields(${encodeURIComponent(fields)})%7Busername%3D${encodeURIComponent(handle)}%7D&access_token=${accessToken}`;

  try {
    const response = await fetch(discoveryUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    logExternalCall({ job: "meta.instagram_business_discovery", actorType: "internal", units: { api_calls: 1 }, estimatedCostAud: 0 }).catch(() => {});

    if (!response.ok) {
      return emptyResult(handle, `Instagram API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as IgBusinessDiscoveryResponse;

    if (data.error) {
      return emptyResult(handle, `Instagram API error: ${data.error.message}`);
    }

    const biz = data.business_discovery;
    if (!biz) {
      return emptyResult(handle, "No business_discovery data returned — account may not be a business account.");
    }

    return {
      follower_count: biz.followers_count ?? null,
      post_count: biz.media_count ?? null,
      posts_last_30d: countRecentPosts(biz.media?.data ?? [], 30),
      username: biz.username ?? handle,
      match_source: "searched",
    };
  } catch (err) {
    logExternalCall({ job: "meta.instagram_business_discovery", actorType: "internal", units: { api_calls: 1 }, estimatedCostAud: 0 }).catch(() => {});
    return emptyResult(handle, `Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Apify instagram-profile-scraper (tier 2) ─────────────────────────

async function fetchViaApify(
  handle: string,
): Promise<InstagramResult> {
  try {
    const items = await runApifyActor<ApifyInstagramProfile>({
      actorId: "apify~instagram-profile-scraper",
      input: {
        usernames: [handle],
        resultsLimit: 30,
      },
      jobName: "apify.instagram_profile",
      timeoutMs: 70_000,
      pollIntervalMs: 5_000,
      maxPollAttempts: 15,
      estimatedCostAud: 0.03,
    });

    const profile = items[0];
    if (!profile) {
      return emptyResult(handle, `Apify returned no results for @${handle}.`);
    }

    const posts = profile.latestPosts ?? profile.posts ?? [];
    const postsLast30d = countRecentPosts(
      posts
        .filter((p): p is { timestamp: string } => !!p.timestamp)
        .map((p) => ({ timestamp: p.timestamp })),
      30,
    );

    return {
      follower_count: profile.followersCount ?? null,
      post_count: profile.postsCount ?? null,
      posts_last_30d: postsLast30d,
      username: profile.username ?? handle,
      match_source: "searched",
    };
  } catch (err) {
    return emptyResult(handle, `Apify Instagram scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function emptyResult(handle: string | null, error: string): InstagramResult {
  return {
    follower_count: null,
    post_count: null,
    posts_last_30d: null,
    username: handle,
    match_source: "searched",
    error,
  };
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
 *
 * Domain-guessed handles ("searched") are diverted to
 * `unverified_signals.instagram` to keep them out of scoring and
 * Brand DNA summaries until manually confirmed.
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

  const data = {
    follower_count: result.follower_count ?? 0,
    post_count: result.post_count ?? 0,
    posts_last_30d: result.posts_last_30d,
  };

  if (result.match_source === "searched") {
    return {
      ...profile,
      unverified_signals: {
        ...profile.unverified_signals,
        instagram: {
          ...data,
          username: result.username ?? "",
        },
      },
      fetch_errors: result.error
        ? { ...profile.fetch_errors, instagram: result.error }
        : profile.fetch_errors,
    };
  }

  return {
    ...profile,
    instagram: data,
    fetch_errors: result.error
      ? { ...profile.fetch_errors, instagram: result.error }
      : profile.fetch_errors,
  };
}

