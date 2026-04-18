"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { runLeadGenDaily } from "@/lib/lead-gen";
import { transitionAutonomyState } from "@/lib/lead-gen/autonomy";

export async function triggerManualRun(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  try {
    await runLeadGenDaily("run_now");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function approveDraft(draftId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  try {
    const drafts = await db
      .select({
        id: outreachDrafts.id,
        status: outreachDrafts.status,
        candidate_id: outreachDrafts.candidate_id,
      })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.id, draftId))
      .limit(1);

    if (drafts.length === 0) return { ok: false, error: "Draft not found" };
    const draft = drafts[0];
    if (draft.status !== "pending_approval") {
      return { ok: false, error: "Draft is not pending approval" };
    }

    let track: "saas" | "retainer" = "saas";
    if (draft.candidate_id) {
      const candidates = await db
        .select({ qualified_track: leadCandidates.qualified_track })
        .from(leadCandidates)
        .where(eq(leadCandidates.id, draft.candidate_id))
        .limit(1);
      if (candidates.length > 0) track = candidates[0].qualified_track;
    }

    await db
      .update(outreachDrafts)
      .set({
        status: "approved_queued",
        approval_kind: "manual",
        approved_at: new Date(),
        approved_by: session.user.id,
      })
      .where(eq(outreachDrafts.id, draftId));

    await transitionAutonomyState(track, "clean_approve");

    revalidatePath("/lite/admin/lead-gen");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function rejectDraft(draftId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  try {
    const drafts = await db
      .select({
        id: outreachDrafts.id,
        status: outreachDrafts.status,
        candidate_id: outreachDrafts.candidate_id,
      })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.id, draftId))
      .limit(1);

    if (drafts.length === 0) return { ok: false, error: "Draft not found" };
    const draft = drafts[0];
    if (draft.status !== "pending_approval") {
      return { ok: false, error: "Draft is not pending approval" };
    }

    let track: "saas" | "retainer" = "saas";
    if (draft.candidate_id) {
      const candidates = await db
        .select({ qualified_track: leadCandidates.qualified_track })
        .from(leadCandidates)
        .where(eq(leadCandidates.id, draft.candidate_id))
        .limit(1);
      if (candidates.length > 0) track = candidates[0].qualified_track;
    }

    await db
      .update(outreachDrafts)
      .set({ status: "rejected" })
      .where(eq(outreachDrafts.id, draftId));

    await transitionAutonomyState(track, "reject");

    revalidatePath("/lite/admin/lead-gen");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
