/**
 * Content Engine — social draft publish primitive (CE-8).
 *
 * v1 publishing is stub-adapter: the admin UI copies text to clipboard
 * and opens the platform's native compose screen. This function marks
 * the draft as `published` in the database and logs the activity.
 *
 * When real API integrations land, the publish call routes through here
 * with zero UI change (spec Q11).
 *
 * Owner: CE-8. Consumer: social tab server actions.
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialDrafts } from "@/lib/db/schema/social-drafts";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { logActivity } from "@/lib/activity-log";

export type MarkPublishedResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_ready" | "already_published" };

/**
 * Transition a social draft from `ready` → `published`.
 * Logs `content_social_published` activity.
 */
export async function markSocialDraftPublished(
  draftId: string,
): Promise<MarkPublishedResult> {
  const draft = await db
    .select({
      id: socialDrafts.id,
      blog_post_id: socialDrafts.blog_post_id,
      platform: socialDrafts.platform,
      status: socialDrafts.status,
    })
    .from(socialDrafts)
    .where(eq(socialDrafts.id, draftId))
    .get();

  if (!draft) return { ok: false, reason: "not_found" };
  if (draft.status === "published") return { ok: false, reason: "already_published" };
  if (draft.status !== "ready") return { ok: false, reason: "not_ready" };

  const now = Date.now();

  await db
    .update(socialDrafts)
    .set({ status: "published", published_at_ms: now })
    .where(eq(socialDrafts.id, draftId));

  // Look up company_id for activity logging
  const post = await db
    .select({ company_id: blogPosts.company_id, title: blogPosts.title })
    .from(blogPosts)
    .where(eq(blogPosts.id, draft.blog_post_id))
    .get();

  if (post) {
    await logActivity({
      companyId: post.company_id,
      kind: "content_social_published",
      body: `${draft.platform} draft published for "${post.title}"`,
      meta: {
        draft_id: draftId,
        blog_post_id: draft.blog_post_id,
        platform: draft.platform,
      },
    });
  }

  return { ok: true };
}
