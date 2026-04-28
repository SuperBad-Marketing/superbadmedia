import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_replies,
  instagram_accounts,
} from "@/lib/db/schema/instagram";
import { replyToComment, sendDirectMessage } from "./client";
import { logActivity } from "@/lib/activity-log";

export type SendResult =
  | { ok: true; sentCount: number }
  | { ok: false; error: string };

/**
 * Send a single approved reply via the Instagram Graph API.
 * Updates the row to "sent" on success.
 */
export async function sendApprovedReply(replyId: string): Promise<SendResult> {
  const reply = await db.query.instagram_replies.findFirst({
    where: eq(instagram_replies.id, replyId),
  });
  if (!reply) return { ok: false, error: "Reply not found" };
  if (reply.status !== "approved")
    return { ok: false, error: `Reply status is "${reply.status}", expected "approved"` };

  const account = await db.query.instagram_accounts.findFirst({
    where: eq(instagram_accounts.id, reply.account_id),
  });
  if (!account || account.status !== "active")
    return { ok: false, error: "Account not active" };

  const text = reply.final_text ?? reply.draft_text;

  if (reply.reply_type === "comment") {
    if (!reply.ig_comment_id)
      return { ok: false, error: "No comment ID to reply to" };

    const res = await replyToComment(
      reply.ig_comment_id,
      account.access_token,
      text,
    );
    if (!res.ok) return { ok: false, error: res.error };
  } else {
    if (!reply.ig_conversation_id)
      return { ok: false, error: "No conversation ID for DM" };

    const res = await sendDirectMessage(
      account.instagram_user_id,
      account.access_token,
      reply.ig_conversation_id,
      text,
    );
    if (!res.ok) return { ok: false, error: res.error };
  }

  await db
    .update(instagram_replies)
    .set({
      status: "sent",
      final_text: text,
      sent_at_ms: Date.now(),
    })
    .where(eq(instagram_replies.id, replyId));

  await logActivity({
    kind: "instagram_reply_sent",
    body: `${reply.reply_type} reply sent to @${reply.inbound_author ?? "unknown"}`,
    meta: { reply_id: replyId, reply_type: reply.reply_type },
  });

  return { ok: true, sentCount: 1 };
}

/**
 * Batch-send all approved replies for an account.
 * Used by the polling handler after autonomous classification.
 */
export async function sendAllApproved(accountId: string): Promise<SendResult> {
  const approved = await db
    .select({ id: instagram_replies.id })
    .from(instagram_replies)
    .where(
      and(
        eq(instagram_replies.account_id, accountId),
        eq(instagram_replies.status, "approved"),
      ),
    );

  let sent = 0;
  for (const row of approved) {
    const res = await sendApprovedReply(row.id);
    if (res.ok) sent += res.sentCount;
  }

  return { ok: true, sentCount: sent };
}
