/**
 * YouTube Data API v3 enrichment — long-form content presence signal.
 *
 * Searches for a YouTube channel matching the candidate's domain/brand,
 * then fetches subscriber count and recent upload cadence. A strong
 * retainer signal — businesses investing in long-form video content are
 * more likely to value a creative retainer.
 *
 * Owner: LG-3. Consumer: enrichment orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "../types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  snippet?: {
    channelId?: string;
    channelTitle?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: { message: string };
}

interface YouTubeChannelStatistics {
  subscriberCount?: string;
  videoCount?: string;
  hiddenSubscriberCount?: boolean;
}

interface YouTubeChannelItem {
  statistics?: YouTubeChannelStatistics;
}

interface YouTubeChannelResponse {
  items?: YouTubeChannelItem[];
  error?: { message: string };
}

interface YouTubeActivityItem {
  snippet?: { publishedAt?: string };
}

interface YouTubeActivityResponse {
  items?: YouTubeActivityItem[];
  error?: { message: string };
}

export interface YouTubeResult {
  subscriber_count: number | null;
  video_count: number | null;
  uploads_last_90d: number | null;
  channel_id: string | null;
  error?: string;
}

/**
 * Search YouTube for a channel matching the candidate, then fetch stats.
 *
 * @param companyName Business name for the YouTube search.
 * @param domain Optional domain for a more targeted search.
 * @returns YouTube channel signals or null fields on failure.
 */
export async function fetchYouTube(
  companyName: string,
  domain?: string | null,
): Promise<YouTubeResult> {
  const apiKey = await getCredential("google-youtube");
  if (!apiKey) {
    return {
      subscriber_count: null,
      video_count: null,
      uploads_last_90d: null,
      channel_id: null,
      error: "YouTube API key not found — complete the setup wizard first.",
    };
  }

  const start = Date.now();

  try {
    // Step 1: Search for a channel matching the company
    const query = domain
      ? `${companyName} ${domain}`
      : companyName;

    const searchParams = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "channel",
      maxResults: "1",
      key: apiKey,
    });

    const searchResponse = await fetch(
      `${YOUTUBE_API_BASE}/search?${searchParams.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!searchResponse.ok) {
      const duration = Date.now() - start;
      await logCall(duration, 1);
      return {
        subscriber_count: null,
        video_count: null,
        uploads_last_90d: null,
        channel_id: null,
        error: `YouTube search error: ${searchResponse.status} ${searchResponse.statusText}`,
      };
    }

    const searchData = (await searchResponse.json()) as YouTubeSearchResponse;

    if (searchData.error) {
      const duration = Date.now() - start;
      await logCall(duration, 1);
      return {
        subscriber_count: null,
        video_count: null,
        uploads_last_90d: null,
        channel_id: null,
        error: `YouTube search error: ${searchData.error.message}`,
      };
    }

    const channelId = searchData.items?.[0]?.snippet?.channelId;
    if (!channelId) {
      const duration = Date.now() - start;
      await logCall(duration, 1);
      return {
        subscriber_count: null,
        video_count: null,
        uploads_last_90d: null,
        channel_id: null,
        error: "No YouTube channel found for this business.",
      };
    }

    // Step 2: Fetch channel statistics
    const channelParams = new URLSearchParams({
      part: "statistics",
      id: channelId,
      key: apiKey,
    });

    const channelResponse = await fetch(
      `${YOUTUBE_API_BASE}/channels?${channelParams.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    let subscriberCount: number | null = null;
    let videoCount: number | null = null;

    if (channelResponse.ok) {
      const channelData =
        (await channelResponse.json()) as YouTubeChannelResponse;
      const stats = channelData.items?.[0]?.statistics;
      if (stats) {
        subscriberCount = stats.hiddenSubscriberCount
          ? null
          : parseInt(stats.subscriberCount ?? "0", 10);
        videoCount = parseInt(stats.videoCount ?? "0", 10);
      }
    }

    // Step 3: Fetch recent activity for upload cadence
    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const activityParams = new URLSearchParams({
      part: "snippet",
      channelId,
      publishedAfter: ninetyDaysAgo,
      maxResults: "50",
      key: apiKey,
    });

    let uploadsLast90d: number | null = null;

    const activityResponse = await fetch(
      `${YOUTUBE_API_BASE}/activities?${activityParams.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (activityResponse.ok) {
      const activityData =
        (await activityResponse.json()) as YouTubeActivityResponse;
      uploadsLast90d = activityData.items?.length ?? 0;
    }

    const duration = Date.now() - start;
    await logCall(duration, 3);

    return {
      subscriber_count: subscriberCount,
      video_count: videoCount,
      uploads_last_90d: uploadsLast90d,
      channel_id: channelId,
    };
  } catch (err) {
    const duration = Date.now() - start;
    await logCall(duration, 1);
    return {
      subscriber_count: null,
      video_count: null,
      uploads_last_90d: null,
      channel_id: null,
      error: `YouTube fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Merge YouTube result into a partial ViabilityProfile.
 */
export function applyYouTubeToProfile(
  profile: Partial<ViabilityProfile>,
  result: YouTubeResult,
): Partial<ViabilityProfile> {
  if (
    result.subscriber_count === null &&
    result.video_count === null &&
    result.uploads_last_90d === null
  ) {
    return {
      ...profile,
      fetch_errors: result.error
        ? { ...profile.fetch_errors, youtube: result.error }
        : profile.fetch_errors,
    };
  }

  return {
    ...profile,
    youtube: {
      subscriber_count: result.subscriber_count ?? 0,
      video_count: result.video_count ?? 0,
      uploads_last_90d: result.uploads_last_90d,
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, youtube: result.error }
      : profile.fetch_errors,
  };
}

async function logCall(
  durationMs: number,
  apiCalls: number,
): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job: "google.youtube.data_api",
      actor_type: "internal",
      units: JSON.stringify({ api_calls: apiCalls }),
      estimated_cost_aud: 0,
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
