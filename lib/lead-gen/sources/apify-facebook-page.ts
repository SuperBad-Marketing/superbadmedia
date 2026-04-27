import { runApifyActor } from "./apify-runner";
import type { ViabilityProfile } from "../types";

const ACTOR_ID = "apify~facebook-pages-scraper";

interface RawFacebookItem {
  name?: string;
  likes?: number;
  followers?: number;
  posts?: Array<{
    text?: string;
    timestamp?: string;
    likes?: number;
    comments?: number;
  }>;
  categories?: string[];
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface FacebookPageResult {
  page_name: string | null;
  follower_count: number | null;
  posts_last_30d: number | null;
  last_post_date: string | null;
  has_active_page: boolean;
  scraped_email: string | null;
  scraped_phone: string | null;
  error?: string;
}

export async function scrapeFacebookPage(
  companyName: string,
  domain: string | null,
): Promise<FacebookPageResult> {
  const searchUrl = domain
    ? `https://www.facebook.com/search/pages/?q=${encodeURIComponent(companyName + " " + domain)}`
    : `https://www.facebook.com/search/pages/?q=${encodeURIComponent(companyName)}`;

  try {
    const items = await runApifyActor<RawFacebookItem>({
      actorId: ACTOR_ID,
      jobName: "apify.facebook_page",
      estimatedCostAud: 0.02,
      input: {
        startUrls: [{ url: searchUrl }],
        maxPages: 1,
      },
    });

    if (items.length === 0) {
      return emptyResult();
    }

    const page = items[0];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentPosts = (page.posts ?? []).filter((p) => {
      if (!p.timestamp) return false;
      return new Date(p.timestamp).getTime() > thirtyDaysAgo;
    });

    const lastPostDate = (page.posts ?? [])
      .map((p) => p.timestamp)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

    return {
      page_name: page.name ?? null,
      follower_count: page.followers ?? page.likes ?? null,
      posts_last_30d: recentPosts.length,
      last_post_date: lastPostDate ?? null,
      has_active_page: (page.followers ?? 0) > 0 || (page.posts ?? []).length > 0,
      scraped_email: page.email ?? null,
      scraped_phone: page.phone ?? null,
    };
  } catch (err) {
    return {
      ...emptyResult(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function emptyResult(): FacebookPageResult {
  return {
    page_name: null,
    follower_count: null,
    posts_last_30d: null,
    last_post_date: null,
    has_active_page: false,
    scraped_email: null,
    scraped_phone: null,
  };
}

export function applyFacebookToProfile(
  profile: Partial<ViabilityProfile>,
  result: FacebookPageResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    facebook: {
      page_name: result.page_name,
      follower_count: result.follower_count,
      posts_last_30d: result.posts_last_30d,
      last_post_date: result.last_post_date,
      has_active_page: result.has_active_page,
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, facebook: result.error }
      : profile.fetch_errors,
  };
}
