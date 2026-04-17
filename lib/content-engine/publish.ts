/**
 * Content Engine — blog publishing (spec §2.1 Stage 5).
 *
 * Transitions an approved post to `published`. Generates the published URL
 * from the company's domain + `/blog/` + slug. OG image generation is
 * stubbed for CE-3 (visual pipeline is CE-5/CE-6).
 *
 * Owner: CE-3. Consumer: fan-out handler (CE-6) calls this after approval.
 */
import { eq, and, ne, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { companies } from "@/lib/db/schema/companies";
import { logActivity } from "@/lib/activity-log";

// ── Types ────────────────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: true; publishedUrl: string }
  | { ok: false; reason: "not_found" | "wrong_status" | "no_domain" };

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Publish an approved blog post. Sets status → published, assigns the
 * published URL, and logs the activity.
 */
export async function publishBlogPost(postId: string): Promise<PublishResult> {
  const post = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .get();

  if (!post) return { ok: false, reason: "not_found" };
  if (post.status !== "approved") return { ok: false, reason: "wrong_status" };

  // Resolve company domain for the published URL
  const company = await db
    .select({ domain: companies.domain, name: companies.name })
    .from(companies)
    .where(eq(companies.id, post.company_id))
    .get();

  const domain = company?.domain;
  if (!domain) return { ok: false, reason: "no_domain" };

  const publishedUrl = `https://${domain}/blog/${post.slug}`;
  const now = Date.now();

  // Transition: approved → publishing → published
  await db
    .update(blogPosts)
    .set({ status: "publishing", updated_at_ms: now })
    .where(eq(blogPosts.id, postId));

  // Generate internal links to other published posts on the same domain
  const otherPosts = await db
    .select({ slug: blogPosts.slug, title: blogPosts.title })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, post.company_id),
        eq(blogPosts.status, "published"),
        ne(blogPosts.id, postId),
      ),
    )
    .orderBy(desc(blogPosts.published_at_ms))
    .limit(5);

  const internalLinks = otherPosts.map((p) => p.slug);

  // Patch structured data with the published URL
  const structuredData = (post.structured_data as Record<string, unknown>) ?? {};
  structuredData.url = publishedUrl;
  structuredData.mainEntityOfPage = publishedUrl;
  if (company?.name && typeof structuredData.author === "object" && structuredData.author !== null) {
    (structuredData.author as Record<string, unknown>).name = company.name;
  }

  await db
    .update(blogPosts)
    .set({
      status: "published",
      published_at_ms: now,
      published_url: publishedUrl,
      internal_links: internalLinks,
      structured_data: structuredData,
      updated_at_ms: now,
    })
    .where(eq(blogPosts.id, postId));

  await logActivity({
    companyId: post.company_id,
    kind: "content_post_published",
    body: `Blog post "${post.title}" published at ${publishedUrl}`,
    meta: {
      post_id: postId,
      slug: post.slug,
      published_url: publishedUrl,
    },
  });

  return { ok: true, publishedUrl };
}

/**
 * Resolve a company from the request hostname for multi-tenant blog routing.
 * Checks `companies.domain` for a match. Returns null if no company found.
 */
export async function resolveCompanyByDomain(
  hostname: string,
): Promise<{ id: string; name: string; domain: string } | null> {
  // Strip port if present
  const cleanHost = hostname.replace(/:\d+$/, "");

  const row = await db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
    })
    .from(companies)
    .where(eq(companies.domain, cleanHost))
    .get();

  if (!row || !row.domain) return null;

  return { id: row.id, name: row.name, domain: row.domain };
}

/**
 * Get a published blog post by slug, scoped to a company.
 */
export async function getPublishedPost(
  companyId: string,
  slug: string,
) {
  return db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        eq(blogPosts.slug, slug),
        eq(blogPosts.status, "published"),
      ),
    )
    .get();
}

/**
 * List all published posts for a company, newest first.
 */
export async function listPublishedPosts(companyId: string) {
  return db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        eq(blogPosts.status, "published"),
      ),
    )
    .orderBy(desc(blogPosts.published_at_ms));
}
