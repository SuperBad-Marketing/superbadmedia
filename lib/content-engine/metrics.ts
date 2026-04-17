/**
 * Content Engine — metrics queries (CE-10).
 *
 * Aggregates data from blog_posts, ranking_snapshots, newsletter_sends,
 * newsletter_subscribers, and social_drafts for the /lite/content/metrics
 * admin surface.
 *
 * Owner: CE-10. Consumer: Metrics tab page.
 */
import { eq, and, desc, count } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { newsletterSends } from "@/lib/db/schema/newsletter-sends";
import { newsletterSubscribers } from "@/lib/db/schema/newsletter-subscribers";
import { socialDrafts } from "@/lib/db/schema/social-drafts";
import { getPostRankingTrend } from "./ranking-snapshot";
import type { PostRankingTrend } from "./ranking-snapshot";

export interface ContentMetrics {
  posts: {
    total: number;
    published: number;
    inReview: number;
  };
  rankings: PostRankingTrend[];
  newsletter: {
    totalSends: number;
    totalRecipients: number;
    totalOpens: number;
    totalClicks: number;
    recentSends: Array<{
      id: string;
      subject: string;
      sentAtMs: number | null;
      recipientCount: number | null;
      openCount: number;
      clickCount: number;
    }>;
  };
  subscribers: {
    active: number;
    bounced: number;
    unsubscribed: number;
    inactiveRemoved: number;
    pendingConfirmation: number;
    total: number;
  };
  social: {
    totalDrafts: number;
    published: number;
    ready: number;
  };
}

/**
 * Gather all content metrics for a given company (or all if null).
 * Passing null fetches admin-wide metrics across all companies.
 */
export async function getContentMetrics(
  companyId: string | null,
  deps: { db?: typeof defaultDb } = {},
): Promise<ContentMetrics> {
  const database = deps.db ?? defaultDb;

  // ── Post counts ──────────────────────────────────────────────────
  const postCountsQuery = companyId
    ? database
        .select({
          status: blogPosts.status,
          count: count(),
        })
        .from(blogPosts)
        .where(eq(blogPosts.company_id, companyId))
        .groupBy(blogPosts.status)
    : database
        .select({
          status: blogPosts.status,
          count: count(),
        })
        .from(blogPosts)
        .groupBy(blogPosts.status);

  const postCounts = await postCountsQuery;

  const postsByStatus = Object.fromEntries(
    postCounts.map((r) => [r.status, r.count]),
  ) as Record<string, number>;

  // ── Published posts for ranking trends ───────────────────────────
  const publishedPostsQuery = companyId
    ? database
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.company_id, companyId),
            eq(blogPosts.status, "published"),
          ),
        )
        .orderBy(desc(blogPosts.published_at_ms))
        .limit(20)
    : database
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.status, "published"))
        .orderBy(desc(blogPosts.published_at_ms))
        .limit(20);

  const publishedPosts = await publishedPostsQuery;

  const rankings: PostRankingTrend[] = [];
  for (const post of publishedPosts) {
    const trend = await getPostRankingTrend(post.id, deps);
    if (trend) rankings.push(trend);
  }

  // ── Newsletter sends ─────────────────────────────────────────────
  const sendsQuery = companyId
    ? database
        .select()
        .from(newsletterSends)
        .where(eq(newsletterSends.company_id, companyId))
        .orderBy(desc(newsletterSends.sent_at_ms))
        .limit(10)
    : database
        .select()
        .from(newsletterSends)
        .orderBy(desc(newsletterSends.sent_at_ms))
        .limit(10);

  const sends = await sendsQuery;

  const totalSendsCountQuery = companyId
    ? database
        .select({ count: count() })
        .from(newsletterSends)
        .where(eq(newsletterSends.company_id, companyId))
    : database.select({ count: count() }).from(newsletterSends);

  const [{ count: totalSendsCount }] = await totalSendsCountQuery;

  const totalRecipients = sends.reduce(
    (sum, s) => sum + (s.recipient_count ?? 0),
    0,
  );
  const totalOpens = sends.reduce((sum, s) => sum + s.open_count, 0);
  const totalClicks = sends.reduce((sum, s) => sum + s.click_count, 0);

  // ── Subscriber counts ────────────────────────────────────────────
  const subCountsQuery = companyId
    ? database
        .select({
          status: newsletterSubscribers.status,
          count: count(),
        })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.company_id, companyId))
        .groupBy(newsletterSubscribers.status)
    : database
        .select({
          status: newsletterSubscribers.status,
          count: count(),
        })
        .from(newsletterSubscribers)
        .groupBy(newsletterSubscribers.status);

  const subCounts = await subCountsQuery;

  const subsByStatus = Object.fromEntries(
    subCounts.map((r) => [r.status, r.count]),
  ) as Record<string, number>;

  // ── Social draft counts ──────────────────────────────────────────
  const socialCountsQuery = companyId
    ? database
        .select({
          status: socialDrafts.status,
          count: count(),
        })
        .from(socialDrafts)
        .innerJoin(blogPosts, eq(socialDrafts.blog_post_id, blogPosts.id))
        .where(eq(blogPosts.company_id, companyId))
        .groupBy(socialDrafts.status)
    : database
        .select({
          status: socialDrafts.status,
          count: count(),
        })
        .from(socialDrafts)
        .groupBy(socialDrafts.status);

  const socialCounts = await socialCountsQuery;

  const socialByStatus = Object.fromEntries(
    socialCounts.map((r) => [r.status, r.count]),
  ) as Record<string, number>;

  return {
    posts: {
      total: Object.values(postsByStatus).reduce((a, b) => a + b, 0),
      published: postsByStatus["published"] ?? 0,
      inReview: postsByStatus["in_review"] ?? 0,
    },
    rankings,
    newsletter: {
      totalSends: totalSendsCount,
      totalRecipients,
      totalOpens,
      totalClicks,
      recentSends: sends.map((s) => ({
        id: s.id,
        subject: s.subject,
        sentAtMs: s.sent_at_ms,
        recipientCount: s.recipient_count,
        openCount: s.open_count,
        clickCount: s.click_count,
      })),
    },
    subscribers: {
      active: subsByStatus["active"] ?? 0,
      bounced: subsByStatus["bounced"] ?? 0,
      unsubscribed: subsByStatus["unsubscribed"] ?? 0,
      inactiveRemoved: subsByStatus["inactive_removed"] ?? 0,
      pendingConfirmation: subsByStatus["pending_confirmation"] ?? 0,
      total: Object.values(subsByStatus).reduce((a, b) => a + b, 0),
    },
    social: {
      totalDrafts: Object.values(socialByStatus).reduce((a, b) => a + b, 0),
      published: socialByStatus["published"] ?? 0,
      ready: socialByStatus["ready"] ?? 0,
    },
  };
}
