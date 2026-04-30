"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth/session";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { habit_completions } from "@/lib/db/schema/habits";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { instagram_replies } from "@/lib/db/schema/instagram";
import { and, eq } from "drizzle-orm";
import { melbourneWallDate } from "@/lib/time/melbourne";
import { logActivity } from "@/lib/activity-log";

export async function regenerateBriefAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  const slot = getCurrentSlot();
  const result = await generateBriefForSlot(slot, {
    trigger: "material_event",
    triggerEvent: "manual_refresh",
  });

  revalidatePath("/lite/cockpit");

  if (!result.generated) {
    return { ok: true as const, quiet: true };
  }

  return { ok: true as const, quiet: false, prose: result.prose };
}

export async function toggleHabitAction(habitId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  const nowMs = Date.now();
  const { year, month, day } = melbourneWallDate(nowMs);
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const existing = await db.query.habit_completions.findFirst({
    where: and(
      eq(habit_completions.habit_id, habitId),
      eq(habit_completions.completed_date, todayStr),
    ),
  });

  if (existing) {
    await db.delete(habit_completions).where(eq(habit_completions.id, existing.id));
    revalidatePath("/lite/cockpit");
    return { ok: true as const, completed: false };
  }

  await db.insert(habit_completions).values({
    id: randomUUID(),
    habit_id: habitId,
    completed_date: todayStr,
    completed_at_ms: nowMs,
  });

  revalidatePath("/lite/cockpit");
  return { ok: true as const, completed: true };
}

export async function approveOutreachDraftAction(draftId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  await db
    .update(outreachDrafts)
    .set({
      status: "approved_queued",
      approved_at: new Date(),
      approved_by: session.user.id!,
      approval_kind: "manual",
    })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_approved",
    body: `Approved outreach draft from cockpit`,
    meta: { draftId, source: "cockpit" },
  });

  revalidatePath("/lite/cockpit");
  return { ok: true as const };
}

export async function rejectOutreachDraftAction(draftId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  await db
    .update(outreachDrafts)
    .set({ status: "rejected" })
    .where(eq(outreachDrafts.id, draftId));

  await logActivity({
    kind: "outreach_draft_rejected",
    body: `Rejected outreach draft from cockpit`,
    meta: { draftId, source: "cockpit" },
  });

  revalidatePath("/lite/cockpit");
  return { ok: true as const };
}

export async function approveInstagramReplyAction(
  replyId: string,
  editedText?: string,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  const updates: Record<string, unknown> = { status: "approved" };
  if (editedText !== undefined) updates.draft_text = editedText;

  await db
    .update(instagram_replies)
    .set(updates)
    .where(eq(instagram_replies.id, replyId));

  const { sendApprovedReply } = await import(
    "@/lib/channels/instagram/send-reply"
  );
  const sendResult = await sendApprovedReply(replyId);

  revalidatePath("/lite/cockpit");
  return sendResult.ok
    ? { ok: true as const }
    : { ok: false as const, error: sendResult.error };
}

export async function approveContentDraftAction(postId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  await db
    .update(blogPosts)
    .set({ status: "approved", updated_at_ms: Date.now() })
    .where(eq(blogPosts.id, postId));

  await logActivity({
    kind: "content_draft_approved",
    body: `Approved content draft from cockpit`,
    meta: { postId, source: "cockpit" },
  });

  revalidatePath("/lite/cockpit");
  return { ok: true as const };
}

export async function rejectContentDraftAction(
  postId: string,
  feedback: string,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  await db
    .update(blogPosts)
    .set({ status: "rejected", updated_at_ms: Date.now() })
    .where(eq(blogPosts.id, postId));

  await logActivity({
    kind: "content_draft_rejected",
    body: `Rejected content draft from cockpit: ${feedback}`,
    meta: { postId, feedback, source: "cockpit" },
  });

  revalidatePath("/lite/cockpit");
  return { ok: true as const };
}
