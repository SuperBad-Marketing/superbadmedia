/**
 * /lite/content — Content Engine admin landing (CE-3).
 *
 * Spec: docs/specs/content-engine.md §8.1.
 * Shows the Review tab: posts awaiting review. Other tabs (Social,
 * Metrics, Topics, List) ship in later CE sessions.
 *
 * Admin-only.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { ContentTabs } from "./_components/content-tabs";

// SuperBad's own company ID — in production this comes from settings or config.
// For now, list all companies' posts since this is an admin view.

export const metadata: Metadata = {
  title: "Content Engine — SuperBad",
};

export default async function ContentPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  // For admin view, show all posts in review across all companies
  // A company filter will be added when subscriber fleet overview ships (CE-11)
  const { db } = await import("@/lib/db");
  const { blogPosts: blogPostsTable } = await import(
    "@/lib/db/schema/blog-posts"
  );
  const { desc, eq } = await import("drizzle-orm");

  const reviewPosts = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "in_review"))
    .orderBy(desc(blogPostsTable.created_at_ms));

  const recentPublished = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(desc(blogPostsTable.published_at_ms))
    .limit(10);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ContentTabs currentPath="/lite/content" />

      {/* Posts awaiting review */}
      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">Awaiting Review</h2>
        {reviewPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No drafts waiting for review.
          </p>
        ) : (
          <div className="space-y-3">
            {reviewPosts.map((post) => (
              <Link
                key={post.id}
                href={`/lite/content/review/${post.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-surface-1"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">{post.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    /{post.slug}
                    {" · "}
                    {new Date(post.created_at_ms).toLocaleDateString("en-AU")}
                  </p>
                </div>
                <Badge variant="outline" className="ml-4 shrink-0 text-xs">
                  In Review
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recently published */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Recently Published</h2>
        {recentPublished.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No published posts yet.
          </p>
        ) : (
          <div className="space-y-3">
            {recentPublished.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">{post.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {post.published_url ?? `/${post.slug}`}
                    {post.published_at_ms && (
                      <>
                        {" · "}
                        {new Date(post.published_at_ms).toLocaleDateString(
                          "en-AU",
                        )}
                      </>
                    )}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="ml-4 shrink-0 text-xs bg-success/10 text-success border-success/20"
                >
                  Published
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
