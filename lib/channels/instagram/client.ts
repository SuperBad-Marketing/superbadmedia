import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { randomUUID } from "node:crypto";

const GRAPH_API_BASE = "https://graph.instagram.com/v21.0";
const GRAPH_FB_BASE = "https://graph.facebook.com/v21.0";

type HttpMethod = "GET" | "POST" | "DELETE";

export type IGApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: number };

async function callApi<T = unknown>(
  method: HttpMethod,
  url: string,
  accessToken: string,
  body?: Record<string, unknown>,
  job?: string,
): Promise<IGApiResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const parsed = new URL(url);
  if (method === "GET" && !parsed.searchParams.has("access_token")) {
    parsed.searchParams.set("access_token", accessToken);
  }
  const fullUrl = parsed.toString();

  const init: RequestInit = { method, headers };
  if (method === "POST" && body) {
    init.body = JSON.stringify({ ...body, access_token: accessToken });
  }

  const start = Date.now();
  let response: Response;
  try {
    response = await fetch(fullUrl, init);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
  const elapsed = Date.now() - start;

  const json = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  await db
    .insert(external_call_log)
    .values({
      id: randomUUID(),
      job: `instagram:${job ?? "api"}`,
      actor_type: "internal",
      units: JSON.stringify({ method, elapsed_ms: elapsed }),
      estimated_cost_aud: 0,
      created_at_ms: Date.now(),
    })
    .catch(() => {});

  if (!response.ok) {
    const errObj = json?.error as Record<string, unknown> | undefined;
    const message =
      typeof errObj?.message === "string"
        ? errObj.message
        : `HTTP ${response.status}`;
    const code =
      typeof errObj?.code === "number" ? errObj.code : response.status;
    return { ok: false, error: message, code };
  }

  return { ok: true, data: json as T };
}

export async function getAccountInfo(
  igUserId: string,
  accessToken: string,
): Promise<
  IGApiResult<{
    id: string;
    username: string;
    followers_count: number;
    media_count: number;
  }>
> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${igUserId}?fields=id,username,followers_count,media_count`,
    accessToken,
    undefined,
    "get_account_info",
  );
}

export async function getAccountInsights(
  igUserId: string,
  accessToken: string,
  metric: string,
  period: "day" | "week" | "days_28" | "lifetime",
  since?: number,
  until?: number,
): Promise<IGApiResult<{ data: unknown[] }>> {
  let url = `${GRAPH_FB_BASE}/${igUserId}/insights?metric=${metric}&period=${period}`;
  if (since) url += `&since=${Math.floor(since / 1000)}`;
  if (until) url += `&until=${Math.floor(until / 1000)}`;
  return callApi("GET", url, accessToken, undefined, "get_account_insights");
}

export async function getMediaList(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<
  IGApiResult<{
    data: { id: string; timestamp: string; media_type: string }[];
  }>
> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${igUserId}/media?fields=id,timestamp,media_type,caption,permalink,thumbnail_url&limit=${limit}`,
    accessToken,
    undefined,
    "get_media_list",
  );
}

export async function getMediaInsights(
  mediaId: string,
  accessToken: string,
  mediaType: string,
): Promise<IGApiResult<{ data: { name: string; values: { value: number }[] }[] }>> {
  const metrics =
    mediaType === "VIDEO" || mediaType === "REEL"
      ? "impressions,reach,likes,comments,saves,shares,plays"
      : "impressions,reach,likes,comments,saves,shares";
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${mediaId}/insights?metric=${metrics}`,
    accessToken,
    undefined,
    "get_media_insights",
  );
}

export async function getFollowerDemographics(
  igUserId: string,
  accessToken: string,
  breakdown: "city" | "country" | "age" | "gender",
): Promise<IGApiResult<{ data: unknown[] }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${igUserId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}`,
    accessToken,
    undefined,
    "get_follower_demographics",
  );
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  params: {
    image_url?: string;
    video_url?: string;
    caption?: string;
    media_type?: "CAROUSEL" | "REELS";
    is_carousel_item?: boolean;
    children?: string[];
    alt_text?: string;
    location_id?: string;
  },
): Promise<IGApiResult<{ id: string }>> {
  const body: Record<string, unknown> = {};
  if (params.image_url) body.image_url = params.image_url;
  if (params.video_url) body.video_url = params.video_url;
  if (params.caption) body.caption = params.caption;
  if (params.media_type) body.media_type = params.media_type;
  if (params.is_carousel_item) body.is_carousel_item = true;
  if (params.children) body.children = params.children.join(",");
  if (params.alt_text) body.alt_text = params.alt_text;
  if (params.location_id) body.location_id = params.location_id;

  return callApi(
    "POST",
    `${GRAPH_FB_BASE}/${igUserId}/media`,
    accessToken,
    body,
    "create_media_container",
  );
}

export async function publishMedia(
  igUserId: string,
  accessToken: string,
  creationId: string,
): Promise<IGApiResult<{ id: string }>> {
  return callApi(
    "POST",
    `${GRAPH_FB_BASE}/${igUserId}/media_publish`,
    accessToken,
    { creation_id: creationId },
    "publish_media",
  );
}

export async function getContainerStatus(
  containerId: string,
  accessToken: string,
): Promise<IGApiResult<{ status_code: string }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${containerId}?fields=status_code`,
    accessToken,
    undefined,
    "get_container_status",
  );
}

// ---------------------------------------------------------------------------
// Boosting (Meta Ads API)
// ---------------------------------------------------------------------------

export async function createPromotedPost(
  pagePostId: string,
  accessToken: string,
  params: {
    budget_cents: number;
    duration_days: number;
    targeting?: Record<string, unknown>;
  },
): Promise<IGApiResult<{ id: string }>> {
  return callApi(
    "POST",
    `${GRAPH_FB_BASE}/${pagePostId}/promotions`,
    accessToken,
    {
      budget: params.budget_cents,
      duration: params.duration_days * 86400,
      ...(params.targeting ? { audience: params.targeting } : {}),
    },
    "create_promoted_post",
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export type IGComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
};

export async function getMediaComments(
  mediaId: string,
  accessToken: string,
  limit = 50,
): Promise<IGApiResult<{ data: IGComment[] }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${mediaId}/comments?fields=id,text,username,timestamp&limit=${limit}`,
    accessToken,
    undefined,
    "get_media_comments",
  );
}

export async function getCommentAuthorId(
  commentId: string,
  accessToken: string,
): Promise<IGApiResult<{ from: { id: string; username: string } }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${commentId}?fields=from`,
    accessToken,
    undefined,
    "get_comment_author",
  );
}

export async function replyToComment(
  commentId: string,
  accessToken: string,
  message: string,
): Promise<IGApiResult<{ id: string }>> {
  return callApi(
    "POST",
    `${GRAPH_FB_BASE}/${commentId}/replies`,
    accessToken,
    { message },
    "reply_to_comment",
  );
}

// ---------------------------------------------------------------------------
// Messaging (DMs)
// ---------------------------------------------------------------------------

export type IGConversation = {
  id: string;
  participants?: { data: { id: string; username: string }[] };
  updated_time?: string;
};

export type IGMessage = {
  id: string;
  message?: string;
  from: { id: string; username?: string };
  created_time: string;
};

export async function getConversations(
  igUserId: string,
  accessToken: string,
  limit = 20,
): Promise<IGApiResult<{ data: IGConversation[] }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${igUserId}/conversations?fields=id,participants,updated_time&limit=${limit}`,
    accessToken,
    undefined,
    "get_conversations",
  );
}

export async function getConversationMessages(
  conversationId: string,
  accessToken: string,
  limit = 20,
): Promise<IGApiResult<{ data: IGMessage[] }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${conversationId}?fields=messages.limit(${limit}){id,message,from,created_time}`,
    accessToken,
    undefined,
    "get_conversation_messages",
  );
}

export async function sendDirectMessage(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  message: string,
): Promise<IGApiResult<{ id: string }>> {
  return callApi(
    "POST",
    `${GRAPH_FB_BASE}/${igUserId}/messages`,
    accessToken,
    { recipient: { id: recipientId }, message: { text: message } },
    "send_dm",
  );
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

export async function refreshLongLivedToken(
  existingToken: string,
  appId: string,
  appSecret: string,
): Promise<IGApiResult<{ access_token: string; expires_in: number }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${existingToken}`,
    existingToken,
    undefined,
    "refresh_token",
  );
}

export async function getInstagramAccountFromPage(
  pageId: string,
  accessToken: string,
): Promise<IGApiResult<{ instagram_business_account: { id: string } }>> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/${pageId}?fields=instagram_business_account`,
    accessToken,
    undefined,
    "get_ig_from_page",
  );
}

export async function getPages(
  accessToken: string,
): Promise<
  IGApiResult<{
    data: { id: string; name: string; access_token: string }[];
  }>
> {
  return callApi(
    "GET",
    `${GRAPH_FB_BASE}/me/accounts?fields=id,name,access_token`,
    accessToken,
    undefined,
    "get_pages",
  );
}
