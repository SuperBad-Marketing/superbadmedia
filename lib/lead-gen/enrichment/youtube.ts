import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchResponse {
  items?: { id?: { channelId?: string } }[];
  error?: { message: string };
}

interface YouTubeChannelResponse {
  items?: {
    statistics?: {
      subscriberCount?: string;
      videoCount?: string;
    };
  }[];
  error?: { message: string };
}

/**
 * Enrich with YouTube channel stats via YouTube Data API v3.
 * Searches for the best-matching channel by business name.
 * Logs to external_call_log (job: "youtube:channel_search").
 *
 * @param businessName - Used as the search query.
 * @param apiKey - Google API key with YouTube Data API v3 enabled.
 */
export async function enrichYouTube(
  businessName: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey) return {};

  const startMs = Date.now();
  let subscriber_count = 0;
  let video_count = 0;
  let fetchError: string | undefined;

  try {
    // Step 1: search for the channel
    const searchParams = new URLSearchParams({
      q: businessName,
      type: "channel",
      part: "snippet",
      maxResults: "1",
      key: apiKey,
    });
    const searchRes = await fetch(
      `${YOUTUBE_API_BASE}/search?${searchParams.toString()}`,
    );
    const searchData = (await searchRes.json()) as YouTubeSearchResponse;

    if (!searchRes.ok || searchData.error) {
      fetchError = `YouTube search error: ${searchData.error?.message ?? searchRes.status}`;
    } else {
      const channelId = searchData.items?.[0]?.id?.channelId;
      if (!channelId) {
        fetchError = `YouTube: no channel found for "${businessName}"`;
      } else {
        // Step 2: get channel statistics
        const statsParams = new URLSearchParams({
          id: channelId,
          part: "statistics",
          key: apiKey,
        });
        const statsRes = await fetch(
          `${YOUTUBE_API_BASE}/channels?${statsParams.toString()}`,
        );
        const statsData = (await statsRes.json()) as YouTubeChannelResponse;

        if (!statsRes.ok || statsData.error) {
          fetchError = `YouTube channel stats error: ${statsData.error?.message ?? statsRes.status}`;
        } else {
          const stats = statsData.items?.[0]?.statistics;
          subscriber_count = parseInt(stats?.subscriberCount ?? "0", 10) || 0;
          video_count = parseInt(stats?.videoCount ?? "0", 10) || 0;
        }
      }
    }
  } catch (err) {
    fetchError = `YouTube fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "youtube:channel_search",
    actor_type: "internal",
    units: JSON.stringify({
      businessName,
      duration_ms: Date.now() - startMs,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) {
    return { fetch_errors: { youtube: fetchError } };
  }

  return {
    youtube: {
      subscriber_count,
      video_count,
      uploads_last_90d: null,
    },
  };
}
