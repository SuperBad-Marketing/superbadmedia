"use server";

/**
 * Content Engine review server actions (CE-3).
 *
 * Admin-role-gated. Zod-validated input where needed.
 * Discriminated union returns: `{ ok: true, ... } | { ok: false, error }`.
 */
import { auth } from "@/lib/auth/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  approveBlogPost,
  rejectAndRegenerate,
} from "@/lib/content-engine/review";
import { publishBlogPost } from "@/lib/content-engine/publish";

// ── Approve ──────────────────────────────────────────────────────────────────

export async function approvePostAction(postId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = z.string().uuid().safeParse(postId);
  if (!parsed.success) return { ok: false as const, error: "invalid_id" };

  const result = await approveBlogPost(parsed.data);
  if (!result.ok) return { ok: false as const, error: result.reason };

  // Auto-publish after approval
  const publishResult = await publishBlogPost(parsed.data);
  if (!publishResult.ok) {
    return {
      ok: true as const,
      published: false,
      publishError: publishResult.reason,
    };
  }

  revalidatePath("/lite/content");
  revalidatePath(`/lite/content/review/${parsed.data}`);

  return {
    ok: true as const,
    published: true,
    publishedUrl: publishResult.publishedUrl,
  };
}

// ── Reject + Regenerate ──────────────────────────────────────────────────────

const rejectSchema = z.object({
  postId: z.string().uuid(),
  feedback: z.string().min(1).max(5000),
});

export async function rejectPostAction(postId: string, feedback: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = rejectSchema.safeParse({ postId, feedback });
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const result = await rejectAndRegenerate(parsed.data.postId, parsed.data.feedback);
  if (!result.ok) return { ok: false as const, error: result.reason };

  revalidatePath(`/lite/content/review/${parsed.data.postId}`);
  revalidatePath("/lite/content");

  return { ok: true as const };
}
