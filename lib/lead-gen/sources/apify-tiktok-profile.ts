import { runApifyActor } from "./apify-runner";
import type { ViabilityProfile } from "../types";

const ACTOR_ID = "clockworks~free-tiktok-scraper";

interface RawTikTokItem {
  authorMeta?: {
    name?: string;
    fans?: number;
    following?: number;
    heart?: number;
    video?: number;
    digg?: number;
    verified?: boolean;
    signature?: string;
  };
  text?: string;
  createTime?: number;
  diggCount?: number;
  shareCount?: number;
  playCount?: number;
  commentCount?: number;
}

export interface TikTokProfileResult {
  follower_count: number | null;
  video_count: number | null;
  posts_last_30d: number | null;
  last_post_date: string | null;
  has_active_profile: boolean;
  profile_url: string | null;
  error?: string;
}

export async function scrapeTikTokProfile(
  companyName: string,
): Promise<TikTokProfileResult> {
  const handle = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);

  try {
    const items = await runApifyActor<RawTikTokItem>({
      actorId: ACTOR_ID,
      jobName: "apify.tiktok_profile",
      estimatedCostAud: 0.01,
      input: {
        profiles: [handle],
        resultsPerPage: 10,
      },
    });

    if (items.length === 0) {
      return emptyResult();
    }

    const authorMeta = items.find((i) => i.authorMeta)?.authorMeta;
    const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;

    const recentPosts = items.filter(
      (i) => i.createTime && i.createTime > thirtyDaysAgo,
    );

    const lastPostTimestamp = items
      .map((i) => i.createTime)
      .filter((t): t is number => t != null)
      .sort((a, b) => b - a)[0];

    const lastPostDate = lastPostTimestamp
      ? new Date(lastPostTimestamp * 1000).toISOString().split("T")[0]
      : null;

    const resolvedHandle = authorMeta?.name ?? handle;

    return {
      follower_count: authorMeta?.fans ?? null,
      video_count: authorMeta?.video ?? null,
      posts_last_30d: recentPosts.length,
      last_post_date: lastPostDate,
      has_active_profile: (authorMeta?.fans ?? 0) > 0 || items.length > 0,
      profile_url: resolvedHandle ? `https://www.tiktok.com/@${resolvedHandle}` : null,
    };
  } catch (err) {
    return {
      ...emptyResult(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function emptyResult(): TikTokProfileResult {
  return {
    follower_count: null,
    video_count: null,
    posts_last_30d: null,
    last_post_date: null,
    has_active_profile: false,
    profile_url: null,
  };
}

export function applyTikTokToProfile(
  profile: Partial<ViabilityProfile>,
  result: TikTokProfileResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    tiktok: {
      follower_count: result.follower_count,
      video_count: result.video_count,
      posts_last_30d: result.posts_last_30d,
      last_post_date: result.last_post_date,
      has_active_profile: result.has_active_profile,
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, tiktok: result.error }
      : profile.fetch_errors,
  };
}
