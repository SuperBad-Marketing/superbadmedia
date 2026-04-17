import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

interface IgAccountResponse {
  instagram_business_account?: { id: string };
  error?: { message: string };
}

interface IgBusinessDiscoveryResponse {
  business_discovery?: {
    followers_count?: number;
    media_count?: number;
  };
  error?: { message: string };
}

/** Derive a candidate Instagram username from a business name. */
function deriveUsername(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 30);
}

/**
 * Enrich with Instagram presence via Graph API Business Discovery.
 * Requires a Page access token with instagram_basic permission.
 * Derives a candidate IG username from the business name.
 * Logs to external_call_log (job: "meta:instagram_business_discovery").
 *
 * @param _domain - Unused; present for uniform enricher signature.
 * @param businessName - Business name used to derive IG username.
 * @param apiKey - Facebook Page access token.
 */
export async function enrichInstagram(
  _domain: string | null,
  businessName: string,
  apiKey: string,
): Promise<Partial<ViabilityProfile>> {
  if (!apiKey) return {};

  const startMs = Date.now();
  let follower_count = 0;
  let post_count = 0;
  let fetchError: string | undefined;

  try {
    // Step 1: get our own page's IG business account ID
    const meRes = await fetch(
      `${GRAPH_API_BASE}/me?fields=instagram_business_account{id}&access_token=${apiKey}`,
    );
    const meData = (await meRes.json()) as IgAccountResponse;

    if (!meRes.ok || meData.error) {
      fetchError = `Instagram /me error: ${meData.error?.message ?? meRes.status}`;
    } else {
      const igAccountId = meData.instagram_business_account?.id;
      if (!igAccountId) {
        fetchError = "Instagram: page has no linked IG business account";
      } else {
        // Step 2: look up target business by derived username
        const username = deriveUsername(businessName);
        const fields = "business_discovery.fields(followers_count,media_count)";
        const bizRes = await fetch(
          `${GRAPH_API_BASE}/${igAccountId}?fields=${fields}&username=${encodeURIComponent(username)}&access_token=${apiKey}`,
        );
        const bizData = (await bizRes.json()) as IgBusinessDiscoveryResponse;

        if (!bizRes.ok || bizData.error) {
          fetchError = `Instagram business_discovery error for "${username}": ${bizData.error?.message ?? bizRes.status}`;
        } else {
          follower_count =
            bizData.business_discovery?.followers_count ?? 0;
          post_count = bizData.business_discovery?.media_count ?? 0;
        }
      }
    }
  } catch (err) {
    fetchError = `Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "meta:instagram_business_discovery",
    actor_type: "internal",
    units: JSON.stringify({
      businessName,
      duration_ms: Date.now() - startMs,
    }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  if (fetchError) {
    return { fetch_errors: { instagram: fetchError } };
  }

  return {
    instagram: {
      follower_count,
      post_count,
      posts_last_30d: null,
    },
  };
}
