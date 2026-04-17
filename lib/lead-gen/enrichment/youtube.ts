/**
 * YouTube channel enrichment adapter.
 *
 * Searches YouTube Data API v3 for a channel matching the business name.
 * Fetches subscriber count, video count, and recent upload cadence.
 * Logs to external_call_log (job: "youtube:channel_search").
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface ChannelSearchItem {
  id?: { channelId?: string };
}

interface ChannelSearchResponse {
  items?: ChannelSearchItem[];
  error?: { message?: string };
}

interface ChannelStatistics {
  subscriberCount?: string;
  videoCount?: string;
}

interface ChannelListItem {
  statistics?: ChannelStatistics;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

interface ChannelListResponse {
  items?: ChannelListItem[];
}

interface PlaylistItem {
  contentDetails?: { videoPublishedAt?: string };
}

interface PlaylistResponse {
  items?: PlaylistItem[];
}

function countRecentUploads(
  items: PlaylistItem[] | undefined,
  days: number,
): number | null {
  if (!items?.length) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  let count = 0;
  for (const item of items) {
    const published = item.contentDetails?.videoPublishedAt;
    if (published && new Date(published) >= cutoff) {
      count++;
    }
  }
  return count;
}

/**
 * Enrich a candidate with YouTube channel subscriber and upload cadence signals.
 *
 * @param businessName - Business name used to search for the YouTube channel.
 * @param apiKey - YouTube Data API v3 key.
 */
export async function enrichYouTube(
  businessName: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey) return {};

  const startMs = Date.now();
  let fetchErrorMsg: string | undefined;
  let youtube: ViabilityProfile["youtube"] | undefined;

  try {
    // Step 1: Search for channel by business name
    const searchParams = new URLSearchParams({
      q: businessName,
      type: "channel",
      part: "snippet",
      maxResults: "3",
      key: apiKey,
    });

    const searchRes = await fetch(
      `${YOUTUBE_API_BASE}/search?${searchParams}`,
    );

    if (!searchRes.ok) {
      const body = await searchRes.text().catch(() => "");
      fetchErrorMsg = `YouTube search HTTP ${searchRes.status}: ${body.slice(0, 200)}`;
    } else {
      const searchData = (await searchRes.json()) as ChannelSearchResponse;

      if (searchData.error?.message) {
        fetchErrorMsg = `YouTube search error: ${searchData.error.message}`;
      } else {
        const channelId = searchData.items?.[0]?.id?.channelId;

        if (channelId) {
          // Step 2: Fetch channel statistics + uploads playlist ID
          const channelParams = new URLSearchParams({
            part: "statistics,contentDetails",
            id: channelId,
            key: apiKey,
          });

          const channelRes = await fetch(
            `${YOUTUBE_API_BASE}/channels?${channelParams}`,
          );

          if (channelRes.ok) {
            const channelData =
              (await channelRes.json()) as ChannelListResponse;
            const channel = channelData.items?.[0];

            if (channel) {
              const stats = channel.statistics;
              const uploadsPlaylistId =
                channel.contentDetails?.relatedPlaylists?.uploads;

              let uploadsLast90d: number | null = null;

              if (uploadsPlaylistId) {
                // Step 3: Fetch recent uploads
                const playlistParams = new URLSearchParams({
                  part: "contentDetails",
                  playlistId: uploadsPlaylistId,
                  maxResults: "50",
                  key: apiKey,
                });

                const playlistRes = await fetch(
                  `${YOUTUBE_API_BASE}/playlistItems?${playlistParams}`,
                );

                if (playlistRes.ok) {
                  const playlistData =
                    (await playlistRes.json()) as PlaylistResponse;
                  uploadsLast90d = countRecentUploads(
                    playlistData.items,
                    90,
                  );
                }
              }

              youtube = {
                subscriber_count: parseInt(
                  stats?.subscriberCount ?? "0",
                  10,
                ),
                video_count: parseInt(stats?.videoCount ?? "0", 10),
                uploads_last_90d: uploadsLast90d,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    fetchErrorMsg = `YouTube fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "youtube:channel_search",
    actor_type: "internal",
    units: JSON.stringify({
      businessName,
      found: !!youtube,
      duration_ms: Date.now() - startMs,
      ...(fetchErrorMsg ? { error: fetchErrorMsg } : {}),
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchErrorMsg) {
    return { fetch_errors: { youtube: fetchErrorMsg } };
  }
  if (!youtube) return {};

  return { youtube };
}
