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

  const totalDrafts = drafts.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Content · Social
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Social Drafts
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Posts cut into platform-native pieces.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {totalDrafts > 0 ? "ready when you are." : "nothing in the hopper."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {totalDrafts}
          </span>
          <span>draft{totalDrafts === 1 ? "" : "s"}</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">·</span>
          <span>
            {grouped.length} post{grouped.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <ContentTabs currentPath="/lite/content/social" />

      {grouped.length === 0 ? (
        <div
          className="rounded-[12px] px-8 py-10 text-center"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <p
            className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            No social drafts yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
            publish a post and they&apos;ll appear.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.postId}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="truncate text-[16px] font-medium text-[color:var(--color-brand-cream)]">
                  {group.postTitle}
                </h2>
                <span className="shrink-0 text-[12px] italic text-[color:var(--color-brand-pink)]">
                  /{group.postSlug}
                </span>
              </div>
              <SocialDraftList drafts={group.drafts} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
