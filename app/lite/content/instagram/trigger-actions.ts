"use server";

import { randomUUID } from "node:crypto";
import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  instagram_comment_triggers,
  instagram_trigger_fires,
  instagram_media,
  instagram_accounts,
} from "@/lib/db/schema/instagram";
import { sendPrivateReplyToComment } from "@/lib/channels/instagram/client";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorised");
  }
}

// ── List triggers ───────────────────────────────────────────────────────

export interface TriggerItem {
  id: string;
  mediaId: string | null;
  mediaCaption: string | null;
  mediaThumbnail: string | null;
  mediaPermalink: string | null;
  triggerType: "any_comment" | "keyword_match";
  keyword: string | null;
  actionType: string;
  dmMessageText: string;
  isActive: boolean;
  firesCount: number;
  createdAtMs: number;
}

export async function listTriggersAction(): Promise<Result<TriggerItem[]>> {
  await requireAdmin();

  const triggers = await db
    .select()
    .from(instagram_comment_triggers)
    .orderBy(desc(instagram_comment_triggers.created_at_ms));

  const mediaIds = [...new Set(triggers.map((t) => t.media_id).filter((id): id is string => id !== null))];
  const mediaRows =
    mediaIds.length > 0
      ? await db
          .select({
            id: instagram_media.id,
            caption: instagram_media.caption,
            thumbnail_url: instagram_media.thumbnail_url,
            permalink: instagram_media.permalink,
          })
          .from(instagram_media)
          .where(inArray(instagram_media.id, mediaIds))
      : [];

  const mediaMap = new Map(mediaRows.map((m) => [m.id, m]));

  return {
    ok: true,
    value: triggers.map((t) => {
      const media = t.media_id ? mediaMap.get(t.media_id) : undefined;
      return {
        id: t.id,
        mediaId: t.media_id,
        mediaCaption: media?.caption ?? null,
        mediaThumbnail: media?.thumbnail_url ?? null,
        mediaPermalink: media?.permalink ?? null,
        triggerType: t.trigger_type,
        keyword: t.keyword,
        actionType: t.action_type,
        dmMessageText: t.dm_message_text,
        isActive: t.is_active,
        firesCount: t.fires_count,
        createdAtMs: t.created_at_ms,
      };
    }),
  };
}

// ── Get synced posts for the post picker ────────────────────────────────

export interface PostPickerItem {
  id: string;
  igMediaId: string;
  caption: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  mediaType: string;
  publishedAtMs: number;
  commentsCount: number | null;
}

export async function getPostsForPickerAction(
  limit = 50,
): Promise<Result<PostPickerItem[]>> {
  await requireAdmin();

  const account = await db.query.instagram_accounts.findFirst({
    where: eq(instagram_accounts.status, "active"),
  });
  if (!account) return { ok: false, error: "No active Instagram account" };

  const posts = await db
    .select()
    .from(instagram_media)
    .where(eq(instagram_media.account_id, account.id))
    .orderBy(desc(instagram_media.published_at_ms))
    .limit(limit);

  return {
    ok: true,
    value: posts.map((p) => ({
      id: p.id,
      igMediaId: p.ig_media_id,
      caption: p.caption,
      thumbnailUrl: p.thumbnail_url,
      permalink: p.permalink,
      mediaType: p.media_type,
      publishedAtMs: p.published_at_ms,
      commentsCount: p.comments_count,
    })),
  };
}

// ── Draft DM copy with LLM ─────────────────────────────────────────────

export async function draftTriggerDmAction(
  brief: string,
  postCaption: string | null,
): Promise<Result<string>> {
  await requireAdmin();

  const system = `You are the voice of SuperBad Marketing — a Melbourne-based performance marketing & media agency.

Voice: dry, observational, self-deprecating, slow burn. Never explain the joke. Short sentences. Leave room for the mutter.

Your job: write a short Instagram DM (1-3 sentences max) that a commenter will receive automatically. It should feel natural and on-brand, not robotic or overly enthusiastic. No emojis spam. One emoji max if it fits.

The user will give you a brief describing what the DM should contain (usually a link or resource to share). Write the DM copy only — no subject line, no greeting like "Hey!", no sign-off.`;

  const prompt = [
    `Brief: ${brief}`,
    postCaption ? `Post caption for context: ${postCaption}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const draft = await invokeLlmText({
    job: "instagram-trigger-dm-draft",
    system,
    prompt,
    maxTokens: 200,
    actorType: "internal",
  });

  return { ok: true, value: draft };
}

// ── Create trigger ──────────────────────────────────────────────────────

export async function createTriggerAction(params: {
  mediaId: string | null;
  triggerType: "any_comment" | "keyword_match";
  keyword?: string;
  dmMessageText: string;
}): Promise<Result<{ id: string }>> {
  await requireAdmin();

  let accountId: string;
  let label: string;

  if (params.mediaId) {
    const media = await db.query.instagram_media.findFirst({
      where: eq(instagram_media.id, params.mediaId),
    });
    if (!media) return { ok: false, error: "Post not found" };
    accountId = media.account_id;
    label = (media.caption ?? "").slice(0, 60);
  } else {
    const account = await db.query.instagram_accounts.findFirst({
      where: eq(instagram_accounts.status, "active"),
    });
    if (!account) return { ok: false, error: "No active Instagram account" };
    accountId = account.id;
    label = "all posts";
  }

  const id = randomUUID();
  await db.insert(instagram_comment_triggers).values({
    id,
    account_id: accountId,
    media_id: params.mediaId,
    trigger_type: params.triggerType,
    keyword:
      params.triggerType === "keyword_match" ? (params.keyword ?? null) : null,
    action_type: "send_dm",
    dm_message_text: params.dmMessageText,
    is_active: true,
    fires_count: 0,
    created_at_ms: Date.now(),
  });

  await logActivity({
    kind: "instagram_trigger_created",
    body: `Comment automation created for ${label}`,
    meta: {
      trigger_id: id,
      media_id: params.mediaId,
      trigger_type: params.triggerType,
    },
  });

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: { id } };
}

// ── Toggle trigger active/inactive ──────────────────────────────────────

export async function toggleTriggerAction(
  triggerId: string,
  isActive: boolean,
): Promise<Result> {
  await requireAdmin();

  await db
    .update(instagram_comment_triggers)
    .set({ is_active: isActive })
    .where(eq(instagram_comment_triggers.id, triggerId));

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: undefined };
}

// ── Delete trigger ──────────────────────────────────────────────────────

export async function deleteTriggerAction(
  triggerId: string,
): Promise<Result> {
  await requireAdmin();

  await db
    .delete(instagram_trigger_fires)
    .where(eq(instagram_trigger_fires.trigger_id, triggerId));

  await db
    .delete(instagram_comment_triggers)
    .where(eq(instagram_comment_triggers.id, triggerId));

  await logActivity({
    kind: "instagram_trigger_deleted",
    body: "Comment automation deleted",
    meta: { trigger_id: triggerId },
  });

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: undefined };
}

// ── Get recent fires for a trigger ──────────────────────────────────────

export interface TriggerFireItem {
  id: string;
  commenterUsername: string;
  dmSent: boolean;
  error: string | null;
  firedAtMs: number;
}

export async function getTriggerFiresAction(
  triggerId: string,
  limit = 20,
): Promise<Result<TriggerFireItem[]>> {
  await requireAdmin();

  const fires = await db
    .select()
    .from(instagram_trigger_fires)
    .where(eq(instagram_trigger_fires.trigger_id, triggerId))
    .orderBy(desc(instagram_trigger_fires.fired_at_ms))
    .limit(limit);

  return {
    ok: true,
    value: fires.map((f) => ({
      id: f.id,
      commenterUsername: f.commenter_username,
      dmSent: f.dm_sent,
      error: f.error,
      firedAtMs: f.fired_at_ms,
    })),
  };
}

// ── Retry failed fires ─────────────────────────────────────────────────

export async function retryFailedFiresAction(
  triggerId: string,
): Promise<Result<{ retried: number; succeeded: number }>> {
  await requireAdmin();

  const trigger = await db.query.instagram_comment_triggers.findFirst({
    where: eq(instagram_comment_triggers.id, triggerId),
  });
  if (!trigger) return { ok: false, error: "Trigger not found" };

  const account = await db.query.instagram_accounts.findFirst({
    where: eq(instagram_accounts.id, trigger.account_id),
  });
  if (!account || account.status !== "active")
    return { ok: false, error: "Account not active" };

  const failedFires = await db
    .select()
    .from(instagram_trigger_fires)
    .where(
      and(
        eq(instagram_trigger_fires.trigger_id, triggerId),
        eq(instagram_trigger_fires.dm_sent, false),
      ),
    );

  if (failedFires.length === 0)
    return { ok: true, value: { retried: 0, succeeded: 0 } };

  let succeeded = 0;

  for (const fire of failedFires) {
    const dmRes = await sendPrivateReplyToComment(
      account.instagram_user_id,
      account.access_token,
      fire.ig_comment_id,
      trigger.dm_message_text,
    );

    if (dmRes.ok) {
      succeeded++;
      await db
        .update(instagram_trigger_fires)
        .set({ dm_sent: true, error: null })
        .where(eq(instagram_trigger_fires.id, fire.id));
    } else {
      await db
        .update(instagram_trigger_fires)
        .set({ error: dmRes.error })
        .where(eq(instagram_trigger_fires.id, fire.id));
    }
  }

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: { retried: failedFires.length, succeeded } };
}
