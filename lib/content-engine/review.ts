/**
 * Content Engine — blog review helpers (spec §2.1 Stage 4).
 *
 * Approve, reject-and-regenerate, and feedback chat for blog posts.
 * Rejection chat feeds back into Opus re-generation using the original
 * prompt + all prior feedback as added context.
 *
 * Owner: CE-3. Consumer: `/lite/content/review` admin surface + subscriber portal.
 */
import { randomUUID } from "node:crypto";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { blogPostFeedback } from "@/lib/db/schema/blog-post-feedback";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { desc } from "drizzle-orm";

// ─�� Types ────────────────────────────────────────────────────────────────────

export interface FeedbackMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAtMs: number;
}

export type ApproveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "wrong_status" };

export type RejectResult =
  | { ok: true; updatedBody: string }
  | { ok: false; reason: "not_found" | "wrong_status" | "regeneration_failed" };

// ── Approve ──────────────────────────────────────────────────────────────────

/**
 * Approve a blog post — transitions to `approved` and enqueues fan-out.
 * Fan-out handler (CE-6) generates newsletter rewrites + social drafts.
 */
export async function approveBlogPost(postId: string): Promise<ApproveResult> {
  const post = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .get();

  if (!post) return { ok: false, reason: "not_found" };
  if (post.status !== "in_review") return { ok: false, reason: "wrong_status" };

  const now = Date.now();
  await db
    .update(blogPosts)
    .set({ status: "approved", updated_at_ms: now })
    .where(eq(blogPosts.id, postId));

  // Enqueue fan-out (newsletter + social + visuals)
  await enqueueTask({
    task_type: "content_fan_out",
    runAt: now,
    payload: { post_id: postId, company_id: post.company_id },
    idempotencyKey: `content_fan_out_${postId}`,
  });

  await logActivity({
    companyId: post.company_id,
    kind: "content_draft_approved",
    body: `Blog post "${post.title}" approved`,
    meta: { post_id: postId, topic_id: post.topic_id },
  });

  return { ok: true };
}

// ── Reject + Regenerate ──────────────────────────────────────────────────────

/**
 * Reject a blog post with feedback. Inserts the user's feedback into the
 * chat thread, Opus regenerates with all prior feedback as context, and
 * the updated draft replaces the original blog post fields.
 */
export async function rejectAndRegenerate(
  postId: string,
  feedback: string,
): Promise<RejectResult> {
  const post = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .get();

  if (!post) return { ok: false, reason: "not_found" };
  if (post.status !== "in_review") return { ok: false, reason: "wrong_status" };

  const now = Date.now();

  // Insert user feedback
  await db.insert(blogPostFeedback).values({
    id: randomUUID(),
    blog_post_id: postId,
    role: "user",
    content: feedback,
    created_at_ms: now,
  });

  // Load all prior feedback for context
  const allFeedback = await db
    .select()
    .from(blogPostFeedback)
    .where(eq(blogPostFeedback.blog_post_id, postId))
    .orderBy(asc(blogPostFeedback.created_at_ms));

  // Load topic for original context
  const topic = await db
    .select()
    .from(contentTopics)
    .where(eq(contentTopics.id, post.topic_id))
    .get();

  // Load Brand DNA
  const brandDna = await loadFullBrandDnaForRegen(post.company_id);

  try {
    const systemPrompt = buildRegenSystemPrompt(brandDna);
    const userPrompt = buildRegenUserPrompt(
      post,
      topic,
      allFeedback.map((f) => ({ role: f.role as "user" | "assistant", content: f.content })),
    );

    const raw = await invokeLlmText({
      job: "content-generate-blog-post",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 8000,
    });

    const updated = parseRegenResponse(raw);

    // Drift check on regenerated content
    const driftProfile = {
      voiceDescription: brandDna.voiceDescription,
      toneMarkers: brandDna.toneMarkers,
      avoidWords: brandDna.avoidWords.length > 0 ? brandDna.avoidWords : undefined,
    };
    await checkBrandVoiceDrift(updated.body, driftProfile);

    // Update blog post in place
    await db
      .update(blogPosts)
      .set({
        title: updated.title,
        slug: updated.slug,
        body: updated.body,
        meta_description: updated.metaDescription,
        structured_data: updated.structuredData,
        internal_links: updated.internalLinks,
        snippet_target_section: updated.snippetTargetSection,
        updated_at_ms: Date.now(),
      })
      .where(eq(blogPosts.id, postId));

    // Insert assistant response noting what changed
    await db.insert(blogPostFeedback).values({
      id: randomUUID(),
      blog_post_id: postId,
      role: "assistant",
      content: `Draft updated based on your feedback. Key changes: addressed "${feedback.slice(0, 100)}${feedback.length > 100 ? "..." : ""}"`,
      created_at_ms: Date.now(),
    });

    await logActivity({
      companyId: post.company_id,
      kind: "content_draft_rejected",
      body: `Blog post "${post.title}" rejected with feedback and regenerated`,
      meta: {
        post_id: postId,
        feedback_preview: feedback.slice(0, 200),
        iteration: allFeedback.filter((f) => f.role === "user").length,
      },
    });

    return { ok: true, updatedBody: updated.body };
  } catch {
    return { ok: false, reason: "regeneration_failed" };
  }
}

// ── Feedback thread ──────────────────────────────────────────────────────────

/**
 * Get the full feedback/rejection chat thread for a blog post.
 */
export async function getBlogPostFeedback(
  postId: string,
): Promise<FeedbackMessage[]> {
  const rows = await db
    .select()
    .from(blogPostFeedback)
    .where(eq(blogPostFeedback.blog_post_id, postId))
    .orderBy(asc(blogPostFeedback.created_at_ms));

  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    content: r.content,
    createdAtMs: r.created_at_ms,
  }));
}

/**
 * Get a blog post by ID with its topic for the review surface.
 */
export async function getBlogPostForReview(postId: string) {
  const post = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .get();

  if (!post) return null;

  const topic = await db
    .select()
    .from(contentTopics)
    .where(eq(contentTopics.id, post.topic_id))
    .get();

  return { post, topic };
}

/**
 * List blog posts awaiting review for a company.
 */
export async function listPostsForReview(companyId: string) {
  return db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        eq(blogPosts.status, "in_review"),
      ),
    )
    .orderBy(desc(blogPosts.created_at_ms));
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface BrandDnaForRegen {
  prosePortrait: string | null;
  signalTags: Record<string, unknown> | null;
  voiceDescription: string;
  toneMarkers: string[];
  avoidWords: string[];
}

async function loadFullBrandDnaForRegen(
  companyId: string,
): Promise<BrandDnaForRegen> {
  const row = await db
    .select({
      prose_portrait: brand_dna_profiles.prose_portrait,
      signal_tags: brand_dna_profiles.signal_tags,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.company_id, companyId),
        eq(brand_dna_profiles.status, "complete"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .orderBy(desc(brand_dna_profiles.updated_at_ms))
    .limit(1)
    .get();

  if (!row) {
    return {
      prosePortrait: null,
      signalTags: null,
      voiceDescription: "professional, clear, and approachable",
      toneMarkers: ["professional", "clear"],
      avoidWords: [],
    };
  }

  const tags = row.signal_tags
    ? (JSON.parse(
        typeof row.signal_tags === "string"
          ? row.signal_tags
          : JSON.stringify(row.signal_tags),
      ) as Record<string, unknown>)
    : null;

  const voiceObj = tags?.voice as Record<string, number> | undefined;
  const toneObj = tags?.tone as Record<string, number> | undefined;
  const avoidObj = tags?.avoid as Record<string, number> | undefined;

  return {
    prosePortrait: row.prose_portrait,
    signalTags: tags,
    voiceDescription: voiceObj
      ? Object.keys(voiceObj).slice(0, 5).join(", ")
      : "professional, clear, and approachable",
    toneMarkers: toneObj ? Object.keys(toneObj).slice(0, 5) : ["professional"],
    avoidWords: avoidObj ? Object.keys(avoidObj) : [],
  };
}

function buildRegenSystemPrompt(brandDna: BrandDnaForRegen): string {
  const parts: string[] = [
    "You are a blog post writer revising a draft based on reviewer feedback. Maintain the brand voice while addressing every piece of feedback precisely.",
  ];

  if (brandDna.prosePortrait) {
    parts.push(`\nBRAND VOICE PORTRAIT:\n${brandDna.prosePortrait}`);
  }
  if (brandDna.signalTags) {
    parts.push(`\nBRAND SIGNAL TAGS:\n${JSON.stringify(brandDna.signalTags)}`);
  }

  return parts.join("\n");
}

function buildRegenUserPrompt(
  post: typeof blogPosts.$inferSelect,
  topic: typeof contentTopics.$inferSelect | undefined,
  feedbackThread: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const parts: string[] = [
    `Revise this blog post based on the feedback below.`,
    `\nORIGINAL KEYWORD: "${topic?.keyword ?? "unknown"}"`,
    `\nCURRENT DRAFT TITLE: "${post.title}"`,
    `\nCURRENT DRAFT BODY:\n${post.body}`,
  ];

  if (feedbackThread.length > 0) {
    parts.push(`\nFEEDBACK HISTORY:`);
    for (const msg of feedbackThread) {
      parts.push(`[${msg.role}]: ${msg.content}`);
    }
  }

  parts.push(`
Address ALL feedback points. Keep the same JSON format:
{
  "title": "Revised title",
  "slug": "revised-slug",
  "body": "Full revised blog post in markdown",
  "metaDescription": "Revised 155-char meta description",
  "structuredData": { "@context": "https://schema.org", "@type": "Article", "headline": "...", "description": "...", "datePublished": "${new Date().toISOString().split("T")[0]}", "author": { "@type": "Organization", "name": "..." } },
  "internalLinks": ["slug-1", "slug-2"],
  "snippetTargetSection": "Heading or null"
}`);

  return parts.join("\n");
}

interface ParsedRegenDraft {
  title: string;
  slug: string;
  body: string;
  metaDescription: string;
  structuredData: Record<string, unknown>;
  internalLinks: string[];
  snippetTargetSection: string | null;
}

function parseRegenResponse(raw: string): ParsedRegenDraft {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const title = String(parsed.title ?? "Untitled");
  const rawSlug = String(parsed.slug ?? title);
  const slug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    title,
    slug,
    body: String(parsed.body ?? ""),
    metaDescription: String(parsed.metaDescription ?? ""),
    structuredData:
      typeof parsed.structuredData === "object" && parsed.structuredData !== null
        ? (parsed.structuredData as Record<string, unknown>)
        : {},
    internalLinks: Array.isArray(parsed.internalLinks)
      ? parsed.internalLinks.map(String)
      : [],
    snippetTargetSection:
      typeof parsed.snippetTargetSection === "string"
        ? parsed.snippetTargetSection
        : null,
  };
}
