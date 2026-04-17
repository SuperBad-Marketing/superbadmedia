/**
 * Instagram Business Discovery enrichment adapter.
 *
 * Uses the Facebook Graph API Business Discovery endpoint to find a business's
 * Instagram account and fetch follower / post signals.
 *
 * Flow:
 *   1. Search Facebook Pages by business name to find the linked Instagram account.
 *   2. Fetch follower_count, media_count, and recent media timestamps.
 *
 * apiKey = Facebook Page Access Token from getCredential('meta').
 * Logs to external_call_log (job: "meta:instagram_business_discovery").
 *
 * Owner: LG-3. Consumer: LG-4 orchestrator.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

interface PageSearchResult {
  id: string;
  instagram_business_account?: {
    id: string;
    followers_count?: number;
    media_count?: number;
    media?: { data?: { timestamp?: string }[] };
  };
}

interface GraphSearchResponse {
  data?: PageSearchResult[];
  error?: { message?: string };
}

function countRecentPosts(
  mediaData: { timestamp?: string }[] | undefined,
  days: number,
): number | null {
  if (!mediaData?.length) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  let count = 0;
  for (const item of mediaData) {
    if (item.timestamp && new Date(item.timestamp) >= cutoff) {
      count++;
    }
  }
  return count;
}

/**
 * Enrich a candidate with Instagram presence and engagement signals.
 *
 * @param domain - Candidate domain — used as a search hint if business name lookup fails.
 * @param businessName - Business name used to search for the Instagram account.
 * @param apiKey - Facebook Page Access Token.
 */
export async function enrichInstagram(
  domain: string | null,
  businessName: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  void domain;
  if (!apiKey) return {};

  const startMs = Date.now();
  let fetchErrorMsg: string | undefined;
  let instagram: ViabilityProfile["instagram"] | undefined;

  try {
    const params = new URLSearchParams({
      q: businessName,
      type: "page",
      fields:
        "id,instagram_business_account{id,followers_count,media_count,media.limit(50){timestamp}}",
      access_token: apiKey,
      limit: "5",
    });

    const response = await fetch(`${GRAPH_API_BASE}/search?${params}`);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fetchErrorMsg = `Instagram Graph API HTTP ${response.status}: ${body.slice(0, 200)}`;
    } else {
      const data = (await response.json()) as GraphSearchResponse;

      if (data.error?.message) {
        fetchErrorMsg = `Instagram Graph API error: ${data.error.message}`;
      } else {
        const page = data.data?.find((p) => p.instagram_business_account?.id);

        if (page?.instagram_business_account) {
          const ig = page.instagram_business_account;
          const mediaData = ig.media?.data;

          instagram = {
            follower_count: ig.followers_count ?? 0,
            post_count: ig.media_count ?? 0,
            posts_last_30d: countRecentPosts(mediaData, 30),
          };
        }
      }
    }
  } catch (err) {
    fetchErrorMsg = `Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "meta:instagram_business_discovery",
    actor_type: "internal",
    units: JSON.stringify({
      businessName,
      found: !!instagram,
      duration_ms: Date.now() - startMs,
      ...(fetchErrorMsg ? { error: fetchErrorMsg } : {}),
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchErrorMsg) {
    return { fetch_errors: { instagram: fetchErrorMsg } };
  }
  if (!instagram) return {};

  return { instagram };
}
