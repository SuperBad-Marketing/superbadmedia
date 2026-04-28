"use server";

import { randomUUID } from "node:crypto";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  instagram_replies,
  instagram_voice_corrections,
  instagram_accounts,
} from "@/lib/db/schema/instagram";
import { sendApprovedReply } from "@/lib/channels/instagram/send-reply";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorised");
  }
}

// ── Fetch replies for review queue ───────────────────────────────────────

export interface ReplyQueueItem {
  id: string;
  replyType: "comment" | "dm";
  inboundText: string;
  inboundAuthor: string | null;
  classification: string | null;
  draftText: string;
  finalText: string | null;
  status: string;
  createdAtMs: number;
  sentAtMs: number | null;
}

export async function getReplyQueue(
  filter: "pending" | "sent" | "escalated" | "all" = "pending",
  limit = 50,
): Promise<Result<ReplyQueueItem[]>> {
  await requireAdmin();

  let whereClause;
  if (filter === "pending") {
    whereClause = eq(instagram_replies.status, "pending_review");
  } else if (filter === "sent") {
    whereClause = eq(instagram_replies.status, "sent");
  } else if (filter === "escalated") {
    whereClause = eq(instagram_replies.status, "escalated");
  }

  const rows = await db
    .select()
    .from(instagram_replies)
    .where(whereClause)
    .orderBy(desc(instagram_replies.created_at_ms))
    .limit(limit);

  return {
    ok: true,
    value: rows.map((r) => ({
      id: r.id,
      replyType: r.reply_type,
      inboundText: r.inbound_text,
      inboundAuthor: r.inbound_author,
      classification: r.classification,
      draftText: r.draft_text,
      finalText: r.final_text,
      status: r.status,
      createdAtMs: r.created_at_ms,
      sentAtMs: r.sent_at_ms,
    })),
  };
}

// ── Approve a reply (optionally with edits) ──────────────────────────────

export async function approveReplyAction(
  replyId: string,
  editedText?: string,
): Promise<Result> {
  await requireAdmin();

  const reply = await db.query.instagram_replies.findFirst({
    where: eq(instagram_replies.id, replyId),
  });
  if (!reply) return { ok: false, error: "Reply not found" };

  const wasEdited = editedText && editedText.trim() !== reply.draft_text;

  await db
    .update(instagram_replies)
    .set({
      status: "approved",
      final_text: editedText?.trim() ?? reply.draft_text,
    })
    .where(eq(instagram_replies.id, replyId));

  if (wasEdited && editedText) {
    await db.insert(instagram_voice_corrections).values({
      id: randomUUID(),
      account_id: reply.account_id,
      reply_id: replyId,
      reply_type: reply.reply_type,
      ai_draft: reply.draft_text,
      andy_version: editedText.trim(),
      correction_note: null,
      created_at_ms: Date.now(),
    });
  }

  const sendResult = await sendApprovedReply(replyId);

  await logActivity({
    kind: "instagram_reply_approved",
    body: `Reply ${wasEdited ? "edited and " : ""}approved for @${reply.inbound_author ?? "unknown"}`,
    meta: { reply_id: replyId, was_edited: wasEdited },
  });

  revalidatePath("/lite/content/instagram/replies");
  return sendResult.ok
    ? { ok: true, value: undefined }
    : { ok: false, error: sendResult.error };
}

// ── Skip a reply ─────────────────────────────────────────────────────────

export async function skipReplyAction(replyId: string): Promise<Result> {
  await requireAdmin();

  await db
    .update(instagram_replies)
    .set({ status: "skipped" })
    .where(eq(instagram_replies.id, replyId));

  await logActivity({
    kind: "instagram_reply_skipped",
    body: `Reply skipped`,
    meta: { reply_id: replyId },
  });

  revalidatePath("/lite/content/instagram/replies");
  return { ok: true, value: undefined };
}

// ── Graduation stats ─────────────────────────────────────────────────────

export interface GraduationStats {
  commentMode: string;
  dmMode: string;
  commentEditRate: number;
  dmEditRate: number;
  commentTotal: number;
  dmTotal: number;
  graduationThreshold: number;
  graduationWindow: number;
}

export async function getGraduationStatsAction(): Promise<Result<GraduationStats>> {
  await requireAdmin();

  const [commentMode, dmMode, threshold, window] = await Promise.all([
    settings.get("instagram.reply.comment_mode"),
    settings.get("instagram.reply.dm_mode"),
    settings.get("instagram.reply.graduation_threshold"),
    settings.get("instagram.reply.graduation_window"),
  ]);

  const gradWindow = typeof window === "number" ? window : 50;

  const [commentStats, dmStats] = await Promise.all([
    computeEditRate("comment", gradWindow),
    computeEditRate("dm", gradWindow),
  ]);

  return {
    ok: true,
    value: {
      commentMode: String(commentMode ?? "draft"),
      dmMode: String(dmMode ?? "draft"),
      commentEditRate: commentStats.editRate,
      dmEditRate: dmStats.editRate,
      commentTotal: commentStats.total,
      dmTotal: dmStats.total,
      graduationThreshold: typeof threshold === "number" ? threshold : 0.15,
      graduationWindow: gradWindow,
    },
  };
}

async function computeEditRate(
  replyType: "comment" | "dm",
  window: number,
): Promise<{ editRate: number; total: number }> {
  const recentSent = await db
    .select({
      id: instagram_replies.id,
      account_id: instagram_replies.account_id,
    })
    .from(instagram_replies)
    .where(
      and(
        eq(instagram_replies.reply_type, replyType),
        eq(instagram_replies.status, "sent"),
      ),
    )
    .orderBy(desc(instagram_replies.sent_at_ms))
    .limit(window);

  if (recentSent.length === 0) return { editRate: 1, total: 0 };

  const replyIds = recentSent.map((r) => r.id);
  const corrections = await db
    .select({ cnt: count() })
    .from(instagram_voice_corrections)
    .where(
      sql`${instagram_voice_corrections.reply_id} IN (${sql.join(
        replyIds.map((id) => sql`${id}`),
        sql`,`,
      )})`,
    );

  const editCount = corrections[0]?.cnt ?? 0;
  return {
    editRate: editCount / recentSent.length,
    total: recentSent.length,
  };
}

// ── Toggle autonomy mode ─────────────────────────────────────────────────

export async function toggleAutonomyAction(
  replyType: "comment" | "dm",
  mode: "draft" | "autonomous",
): Promise<Result> {
  await requireAdmin();

  const key =
    replyType === "comment"
      ? "instagram.reply.comment_mode"
      : "instagram.reply.dm_mode";

  await settings.set(key, mode);

  await logActivity({
    kind: "instagram_reply_approved",
    body: `${replyType} mode changed to ${mode}`,
    meta: { reply_type: replyType, mode },
  });

  revalidatePath("/lite/content/instagram/replies");
  return { ok: true, value: undefined };
}
