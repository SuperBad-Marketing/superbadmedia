import { eq, and, or, inArray, desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_accounts,
  instagram_media,
  instagram_replies,
  instagram_comment_triggers,
} from "@/lib/db/schema/instagram";
import {
  getMediaComments,
  getConversations,
  getConversationMessages,
  type IGComment,
  type IGMessage,
} from "@/lib/channels/instagram/client";
import { processInbound, type InboundMessage } from "@/lib/channels/instagram/reply-pipeline";
import { sendAllApproved } from "@/lib/channels/instagram/send-reply";
import { checkAndFireTriggersForComment } from "@/lib/channels/instagram/trigger-check";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import settings from "@/lib/settings";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

async function handleInstagramReplyPoll(): Promise<void> {
  const accounts = await db
    .select()
    .from(instagram_accounts)
    .where(eq(instagram_accounts.status, "active"));

  for (const account of accounts) {
    await pollComments(account);
    await pollDMs(account);
    await sendAllApproved(account.id);
  }

  await scheduleNext();
}

// ── Comment polling ──────────────────────────────────────────────────────

async function pollComments(
  account: typeof instagram_accounts.$inferSelect,
): Promise<void> {
  const allMedia = await db
    .select()
    .from(instagram_media)
    .where(eq(instagram_media.account_id, account.id))
    .orderBy(desc(instagram_media.published_at_ms));

  for (const media of allMedia) {
    const res = await getMediaComments(
      media.ig_media_id,
      account.access_token,
      50,
    );
    if (!res.ok) continue;

    const activeTriggers = await db
      .select()
      .from(instagram_comment_triggers)
      .where(
        and(
          or(
            eq(instagram_comment_triggers.media_id, media.id),
            isNull(instagram_comment_triggers.media_id),
          ),
          eq(instagram_comment_triggers.is_active, true),
        ),
      );

    for (const comment of res.data.data) {
      if (isOwnComment(comment, account.username)) continue;

      if (activeTriggers.length > 0) {
        await checkAndFireTriggersForComment(
          activeTriggers,
          comment,
          account,
        );
      }

      if (await isAlreadyProcessed(account.id, comment.id, null)) continue;

      const msg: InboundMessage = {
        replyType: "comment",
        igCommentId: comment.id,
        inboundText: comment.text,
        inboundAuthor: comment.username,
        mediaCaption: media.caption,
      };

      try {
        await processInbound(account.id, msg);
      } catch (err) {
        console.error(
          `[instagram-reply-poll] Failed to process comment ${comment.id}:`,
          err,
        );
      }
    }
  }
}

// ── DM polling ───────────────────────────────────────────────────────────

async function pollDMs(
  account: typeof instagram_accounts.$inferSelect,
): Promise<void> {
  const convRes = await getConversations(
    account.instagram_user_id,
    account.access_token,
    20,
  );
  if (!convRes.ok) return;

  for (const conv of convRes.data.data) {
    const msgRes = await getConversationMessages(
      conv.id,
      account.access_token,
      10,
    );
    if (!msgRes.ok) continue;

    const messages: IGMessage[] =
      (msgRes.data as unknown as { messages?: { data?: IGMessage[] } })
        ?.messages?.data ?? [];

    for (const message of messages) {
      if (!message.message) continue;
      if (message.from.id === account.instagram_user_id) continue;
      if (await isAlreadyProcessed(account.id, null, message.id)) continue;

      const history = messages
        .slice(0, 5)
        .map(
          (m) =>
            `${m.from.id === account.instagram_user_id ? "SuperBad" : m.from.username ?? "them"}: ${m.message ?? ""}`,
        )
        .join("\n");

      const msg: InboundMessage = {
        replyType: "dm",
        igConversationId: conv.id,
        igMessageId: message.id,
        inboundText: message.message,
        inboundAuthor: message.from.username ?? null,
        conversationHistory: history,
      };

      try {
        await processInbound(account.id, msg);
      } catch (err) {
        console.error(
          `[instagram-reply-poll] Failed to process DM ${message.id}:`,
          err,
        );
      }
    }
  }
}

// ── Deduplication ────────────────────────────────────────────────────────

async function isAlreadyProcessed(
  accountId: string,
  igCommentId: string | null,
  igMessageId: string | null,
): Promise<boolean> {
  if (igCommentId) {
    const existing = await db
      .select({ id: instagram_replies.id })
      .from(instagram_replies)
      .where(
        and(
          eq(instagram_replies.account_id, accountId),
          eq(instagram_replies.ig_comment_id, igCommentId),
        ),
      )
      .limit(1);
    return existing.length > 0;
  }

  if (igMessageId) {
    const existing = await db
      .select({ id: instagram_replies.id })
      .from(instagram_replies)
      .where(
        and(
          eq(instagram_replies.account_id, accountId),
          eq(instagram_replies.ig_message_id, igMessageId),
        ),
      )
      .limit(1);
    return existing.length > 0;
  }

  return false;
}

function isOwnComment(
  comment: IGComment,
  ownUsername: string,
): boolean {
  return comment.username.toLowerCase() === ownUsername.toLowerCase();
}

// ── Self-scheduling ──────────────────────────────────────────────────────

async function scheduleNext(): Promise<void> {
  const intervalSeconds = await settings.get(
    "instagram.reply.poll_interval_seconds",
  );
  const interval =
    typeof intervalSeconds === "number" ? intervalSeconds : 150;

  await enqueueTask({
    task_type: "instagram_reply_poll",
    runAt: Date.now() + interval * 1000,
    idempotencyKey: `ig-reply-poll-${Date.now()}`,
  });
}

/**
 * Called on server boot to ensure the reply-poll loop is alive.
 * If a pending or running task already exists, this is a no-op.
 * Otherwise enqueues one to run immediately.
 */
export async function ensureInstagramReplyPollEnqueued(): Promise<void> {
  const active = await db
    .select({ id: instagram_accounts.id })
    .from(instagram_accounts)
    .where(eq(instagram_accounts.status, "active"))
    .limit(1);

  if (active.length === 0) return;

  const existing = await db
    .select({ id: scheduled_tasks.id })
    .from(scheduled_tasks)
    .where(
      and(
        eq(scheduled_tasks.task_type, "instagram_reply_poll"),
        inArray(scheduled_tasks.status, ["pending", "running"]),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  await enqueueTask({
    task_type: "instagram_reply_poll",
    runAt: Date.now(),
    idempotencyKey: `ig-reply-poll-boot-${Date.now()}`,
  });
}

export const INSTAGRAM_REPLY_POLL_HANDLERS: HandlerMap = {
  instagram_reply_poll: handleInstagramReplyPoll,
};
