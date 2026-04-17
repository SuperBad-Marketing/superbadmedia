/**
 * /lite/content/social — Social drafts admin tab (CE-8).
 *
 * Spec: docs/specs/content-engine.md §8.1, Q11, Q16.
 * Shows social drafts grouped by blog post, with Publish/Download
 * buttons and carousel preview for Instagram multi-slide.
 *
 * Admin-only.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { socialDrafts } from "@/lib/db/schema/social-drafts";
import { ContentTabs } from "../_components/content-tabs";
import { SocialDraftList } from "../_components/social-draft-list";

export const metadata: Metadata = {
  title: "Social Drafts — SuperBad",
};

export default async function SocialPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  // Fetch all social drafts with their parent blog post, newest first
  const drafts = await db
    .select({
      id: socialDrafts.id,
      blog_post_id: socialDrafts.blog_post_id,
      platform: socialDrafts.platform,
      text: socialDrafts.text,
      format: socialDrafts.format,
      visual_asset_urls: socialDrafts.visual_asset_urls,
      carousel_slides: socialDrafts.carousel_slides,
      status: socialDrafts.status,
      published_at_ms: socialDrafts.published_at_ms,
      created_at_ms: socialDrafts.created_at_ms,
    })
    .from(socialDrafts)
    .orderBy(desc(socialDrafts.created_at_ms));

  // Collect unique post IDs and fetch their titles
  const postIds = [...new Set(drafts.map((d) => d.blog_post_id))];

  const posts =
    postIds.length > 0
      ? await db
          .select({
            id: blogPosts.id,
            title: blogPosts.title,
            slug: blogPosts.slug,
            published_url: blogPosts.published_url,
            status: blogPosts.status,
          })
          .from(blogPosts)
          .where(inArray(blogPosts.id, postIds))
      : [];

  const postMap = new Map(posts.map((p) => [p.id, p]));

  // Group drafts by post
  const grouped: {
    postId: string;
    postTitle: string;
    postSlug: string;
    drafts: typeof drafts;
  }[] = [];

  const seen = new Set<string>();
  for (const draft of drafts) {
    if (!seen.has(draft.blog_post_id)) {
      seen.add(draft.blog_post_id);
      const post = postMap.get(draft.blog_post_id);
      grouped.push({
        postId: draft.blog_post_id,
        postTitle: post?.title ?? "Unknown post",
        postSlug: post?.slug ?? "",
        drafts: drafts.filter((d) => d.blog_post_id === draft.blog_post_id),
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ContentTabs currentPath="/lite/content/social" />

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No social drafts yet.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.postId}>
              <h2 className="mb-3 text-lg font-semibold truncate">
                {group.postTitle}
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                /{group.postSlug}
              </p>
              <SocialDraftList drafts={group.drafts} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
