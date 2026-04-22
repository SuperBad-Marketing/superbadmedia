"use server";

/**
 * Content Engine server actions (CE-3 + CE-8 + CE-10).
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
import { markSocialDraftPublished } from "@/lib/content-engine/social-publish";
import { vetoTopic } from "@/lib/content-engine/topic-queue";
import {
  addSeedKeyword,
  removeSeedKeyword,
} from "@/lib/content-engine/seed-keywords";

// ── Manual generate ─────────────────────────────────────────────────────────

export async function triggerContentGenerateAction(companyId?: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const { generateBlogPost } = await import(
    "@/lib/content-engine/generate-blog-post"
  );

  let targetCompanyId = companyId;

  if (!targetCompanyId) {
    const { db } = await import("@/lib/db");
    const { contentTopics } = await import("@/lib/db/schema/content-topics");
    const { eq: eqOp, asc } = await import("drizzle-orm");
    const topic = await db
      .select({ company_id: contentTopics.company_id })
      .from(contentTopics)
      .where(eqOp(contentTopics.status, "queued"))
      .orderBy(asc(contentTopics.created_at_ms))
      .limit(1)
      .then((r) => r[0]);
    if (!topic) return { ok: false as const, error: "No queued topics to generate from." };
    targetCompanyId = topic.company_id;
  }

  const result = await generateBlogPost(targetCompanyId);
  if (!result.ok) return { ok: false as const, error: result.reason };

  revalidatePath("/lite/content");
  return { ok: true as const, postId: result.postId };
}

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

// ── Publish Social Draft (CE-8) ─────────────────────────────────────────────

export async function publishSocialDraftAction(draftId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = z.string().uuid().safeParse(draftId);
  if (!parsed.success) return { ok: false as const, error: "invalid_id" };

  const result = await markSocialDraftPublished(parsed.data);
  if (!result.ok) return { ok: false as const, error: result.reason };

  revalidatePath("/lite/content/social");

  return { ok: true as const };
}

// ── Veto Topic (CE-10) ─────────────────────────────────────────────────────

export async function vetoTopicAction(topicId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = z.string().uuid().safeParse(topicId);
  if (!parsed.success) return { ok: false as const, error: "invalid_id" };

  const result = await vetoTopic(parsed.data);
  if (!result) return { ok: false as const, error: "not_found_or_already_vetoed" };

  revalidatePath("/lite/content/topics");

  return { ok: true as const };
}

// ── Add Seed Keyword (CE-10) ───────────────────────────────────────────────

const seedKeywordSchema = z.string().min(1).max(200).trim();

export async function addSeedKeywordAction(
  companyId: string,
  keyword: string,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsedCompany = z.string().uuid().safeParse(companyId);
  if (!parsedCompany.success)
    return { ok: false as const, error: "invalid_company_id" };

  const parsedKeyword = seedKeywordSchema.safeParse(keyword);
  if (!parsedKeyword.success)
    return { ok: false as const, error: "invalid_keyword" };

  const result = await addSeedKeyword(parsedCompany.data, parsedKeyword.data);
  if (!result.ok) return { ok: false as const, error: result.reason };

  revalidatePath("/lite/content/topics");

  return { ok: true as const };
}

// ── Remove Seed Keyword (CE-10) ────────────────────────────────────────────

export async function removeSeedKeywordAction(
  companyId: string,
  keyword: string,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsedCompany = z.string().uuid().safeParse(companyId);
  if (!parsedCompany.success)
    return { ok: false as const, error: "invalid_company_id" };

  const parsedKeyword = seedKeywordSchema.safeParse(keyword);
  if (!parsedKeyword.success)
    return { ok: false as const, error: "invalid_keyword" };

  const result = await removeSeedKeyword(
    parsedCompany.data,
    parsedKeyword.data,
  );
  if (!result.ok) return { ok: false as const, error: result.reason };

  revalidatePath("/lite/content/topics");

  return { ok: true as const };
}
