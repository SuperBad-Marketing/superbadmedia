/**
 * Instagram enrichment — Meta Graph API Business Discovery.
 * Populates instagram.follower_count, instagram.post_count, instagram.posts_last_30d.
 *
 * Flow:
 * 1. Scrape domain homepage for instagram.com/<username> link.
 * 2. Look up follower_count + media_count via Graph API.
 * 3. posts_last_30d is not directly available without additional calls — set to null.
 *
 * apiKey should be a user or page access token with instagram_basic permission.
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

export async function enrichInstagram(
  domain: string | null,
  _businessName: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey) return {};

  const startMs = Date.now();

  const username = domain ? await extractInstagramUsername(domain) : null;
  if (!username) return {};

  let followerCount: number | undefined;
  let postCount: number | undefined;
  let fetchError: string | undefined;

  try {
    const params = new URLSearchParams({
      fields: "followers_count,media_count",
      access_token: apiKey,
    });
    const response = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(username)}?${params}`);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchError = `Meta Instagram HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as {
        followers_count?: number;
        media_count?: number;
        error?: { message?: string };
      };
      if (data.error?.message) {
        fetchError = `Meta Instagram API error: ${data.error.message}`;
      } else {
        followerCount = data.followers_count;
        postCount = data.media_count;
      }
    }
  } catch (err) {
    fetchError = `Meta Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "meta:instagram_business_discovery",
    actor_type: "internal",
    units: JSON.stringify({ username, domain, duration_ms: Date.now() - startMs }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) return { fetch_errors: { instagram: fetchError } };
  if (followerCount === undefined) return {};

  return {
    instagram: {
      follower_count: followerCount,
      post_count: postCount ?? 0,
      posts_last_30d: null,
    },
  };
}

async function extractInstagramUsername(domain: string): Promise<string | null> {
  try {
    const response = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    let handle: string | null = null;

    $("a[href*='instagram.com/']").each((_, el) => {
      if (handle) return;
      const href = $(el).attr("href") ?? "";
      const match = href.match(/instagram\.com\/([A-Za-z0-9_.]+)\/?/);
      if (match?.[1] && !["p", "reel", "explore", "stories"].includes(match[1])) {
        handle = match[1];
      }
    });

    return handle;
  } catch {
    return null;
  }
}
