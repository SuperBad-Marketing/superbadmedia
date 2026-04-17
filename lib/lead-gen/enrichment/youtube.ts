/**
 * YouTube enrichment — YouTube Data API v3.
 * Populates youtube.subscriber_count, youtube.video_count, youtube.uploads_last_90d.
 *
 * Flow:
 * 1. Search for channel by business name.
 * 2. Get channel statistics (subscriber_count, video_count).
 * 3. Get uploads playlist, count items published in last 90 days.
 *
 * apiKey is a YouTube Data API v3 key.
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

export async function enrichYouTube(
  businessName: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey || !businessName) return {};

  const startMs = Date.now();

  let subscriberCount: number | undefined;
  let videoCount: number | undefined;
  let uploadsLast90d: number | null = null;
  let fetchError: string | undefined;

  try {
    const channelId = await searchChannelId(businessName, apiKey);
    if (!channelId) {
      await logCall("youtube:channel_search", { businessName, duration_ms: Date.now() - startMs });
      return {};
    }

    const statsParams = new URLSearchParams({
      part: "statistics,contentDetails",
      id: channelId,
      key: apiKey,
    });
    const statsRes = await fetch(`${YT_BASE}/channels?${statsParams}`);
    if (!statsRes.ok) {
      const body = await statsRes.text().catch(() => "");
      fetchError = `YouTube channels HTTP ${statsRes.status}: ${body.slice(0, 200)}`;
    } else {
      const statsData = (await statsRes.json()) as {
        items?: {
          statistics?: { subscriberCount?: string; videoCount?: string };
          contentDetails?: { relatedPlaylists?: { uploads?: string } };
        }[];
        error?: { message?: string };
      };
      if (statsData.error?.message) {
        fetchError = `YouTube channels API error: ${statsData.error.message}`;
      } else {
        const item = statsData.items?.[0];
        subscriberCount = parseInt(item?.statistics?.subscriberCount ?? "0", 10);
        videoCount = parseInt(item?.statistics?.videoCount ?? "0", 10);
        const uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylistId) {
          uploadsLast90d = await countRecentUploads(uploadsPlaylistId, apiKey);
        }
      }
    }
  } catch (err) {
    fetchError = `YouTube fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await logCall("youtube:channel_search", { businessName, duration_ms: Date.now() - startMs });

  if (fetchError) return { fetch_errors: { youtube: fetchError } };
  if (subscriberCount === undefined) return {};

  return {
    youtube: {
      subscriber_count: subscriberCount,
      video_count: videoCount ?? 0,
      uploads_last_90d: uploadsLast90d,
    },
  };
}

async function searchChannelId(businessName: string, apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({
    part: "snippet",
    q: businessName,
    type: "channel",
    maxResults: "1",
    key: apiKey,
  });
  const res = await fetch(`${YT_BASE}/search?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: { id?: { channelId?: string } }[];
  };
  return data.items?.[0]?.id?.channelId ?? null;
}

async function countRecentUploads(playlistId: string, apiKey: string): Promise<number | null> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    part: "contentDetails",
    playlistId,
    maxResults: "50",
    key: apiKey,
  });
  try {
    const res = await fetch(`${YT_BASE}/playlistItems?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { contentDetails?: { videoPublishedAt?: string } }[];
    };
    const items = data.items ?? [];
    return items.filter((item) => {
      const pub = item.contentDetails?.videoPublishedAt;
      return pub && new Date(pub) >= cutoff;
    }).length;
  } catch {
    return null;
  }
}

async function logCall(job: string, meta: Record<string, unknown>): Promise<void> {
  await db.insert(external_call_log).values({
    id: randomUUID(),
    job,
    actor_type: "internal",
    units: JSON.stringify(meta),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });
}
