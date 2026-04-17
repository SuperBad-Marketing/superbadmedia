/**
 * Content Engine — ranking snapshot pipeline (spec §7.1).
 *
 * Weekly SerpAPI re-queries per published blog post. Tracks organic
 * ranking position for the post's target keyword. Trend data
 * (entry, current, peak, direction) derived at query time from the
 * snapshot history.
 *
 * Owner: CE-9. Consumer: `content_ranking_snapshot` scheduled-task handler.
 */
import { eq, and, desc } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { rankingSnapshots } from "@/lib/db/schema/ranking-snapshots";
import { fetchSerpResults } from "./research";
import { getCredential } from "@/lib/integrations/getCredential";
import { logActivity } from "@/lib/activity-log";
import { randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────

export interface RankingSnapshotResult {
  ok: true;
  postsChecked: number;
  postsRanked: number;
  postsNotFound: number;
  errors: number;
}

export interface PostRankingTrend {
  blogPostId: string;
  keyword: string;
  entryPosition: number | null;
  currentPosition: number | null;
  peakPosition: number | null;
  direction: "up" | "down" | "stable" | "new" | "lost";
  snapshotCount: number;
}

// ── Core pipeline ──────────────────────────────────────────────────

/**
 * Take a ranking snapshot for all published blog posts owned by a company.
 *
 * For each published post: look up the target keyword from its topic,
 * query SerpAPI, find the post's domain in results, record the position
 * (null if not in top 100).
 */
export async function takeRankingSnapshots(
  companyId: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<RankingSnapshotResult> {
  const database = deps.db ?? defaultDb;

  const apiKey = await getCredential("serpapi");
  if (!apiKey) {
    throw new Error(
      "SerpAPI credential not found — complete the API key setup wizard first.",
    );
  }

  // Fetch all published posts with their target keywords
  const publishedPosts = await database
    .select({
      postId: blogPosts.id,
      publishedUrl: blogPosts.published_url,
      keyword: contentTopics.keyword,
    })
    .from(blogPosts)
    .innerJoin(contentTopics, eq(blogPosts.topic_id, contentTopics.id))
    .where(
      and(
        eq(blogPosts.company_id, companyId),
        eq(blogPosts.status, "published"),
      ),
    );

  if (publishedPosts.length === 0) {
    return { ok: true, postsChecked: 0, postsRanked: 0, postsNotFound: 0, errors: 0 };
  }

  const nowMs = Date.now();
  let postsRanked = 0;
  let postsNotFound = 0;
  let errors = 0;

  for (const post of publishedPosts) {
    try {
      const serpSnapshot = await fetchSerpResults(post.keyword, apiKey);

      // Find the post's position in the SERP results by matching the
      // published URL's domain against result domains
      const postDomain = post.publishedUrl
        ? extractDomain(post.publishedUrl)
        : null;

      const position = postDomain
        ? findPositionByDomain(serpSnapshot.results, postDomain)
        : null;

      await database.insert(rankingSnapshots).values({
        id: randomUUID(),
        blog_post_id: post.postId,
        keyword: post.keyword,
        position,
        source: "serpapi",
        snapshot_date_ms: nowMs,
        created_at_ms: nowMs,
      });

      if (position !== null) {
        postsRanked++;
      } else {
        postsNotFound++;
      }
    } catch (err) {
      // Log but don't abort the entire snapshot run for one post
      console.error(
        `Content Engine: ranking snapshot failed for post ${post.postId} (keyword "${post.keyword}"):`,
        err,
      );
      errors++;
    }
  }

  await logActivity({
    companyId,
    kind: "content_ranking_snapshot_taken",
    body: `Ranking snapshots taken: ${postsRanked} ranked, ${postsNotFound} not found in top 100, ${errors} errors`,
    meta: {
      posts_checked: publishedPosts.length,
      posts_ranked: postsRanked,
      posts_not_found: postsNotFound,
      errors,
    },
  });

  return {
    ok: true,
    postsChecked: publishedPosts.length,
    postsRanked,
    postsNotFound,
    errors,
  };
}

// ── Trend queries ──────────────────────────────────────────────────

/**
 * Compute ranking trend for a published post from its snapshot history.
 *
 * - entryPosition: position from the earliest snapshot
 * - currentPosition: position from the most recent snapshot
 * - peakPosition: best (lowest number) position ever recorded
 * - direction: comparing the two most recent snapshots
 */
export async function getPostRankingTrend(
  blogPostId: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<PostRankingTrend | null> {
  const database = deps.db ?? defaultDb;

  const snapshots = await database
    .select({
      position: rankingSnapshots.position,
      keyword: rankingSnapshots.keyword,
      snapshot_date_ms: rankingSnapshots.snapshot_date_ms,
    })
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.blog_post_id, blogPostId))
    .orderBy(desc(rankingSnapshots.snapshot_date_ms));

  if (snapshots.length === 0) return null;

  const keyword = snapshots[0].keyword;
  const currentPosition = snapshots[0].position;
  const entryPosition = snapshots[snapshots.length - 1].position;

  // Peak = lowest numeric position (closer to #1). Null positions excluded.
  const rankedPositions = snapshots
    .map((s) => s.position)
    .filter((p): p is number => p !== null);
  const peakPosition =
    rankedPositions.length > 0 ? Math.min(...rankedPositions) : null;

  // Direction: compare two most recent snapshots
  let direction: PostRankingTrend["direction"];
  if (snapshots.length === 1) {
    direction = "new";
  } else {
    const previous = snapshots[1].position;
    if (currentPosition === null && previous === null) {
      direction = "stable";
    } else if (currentPosition === null) {
      direction = "lost";
    } else if (previous === null) {
      direction = "new";
    } else if (currentPosition < previous) {
      direction = "up";
    } else if (currentPosition > previous) {
      direction = "down";
    } else {
      direction = "stable";
    }
  }

  return {
    blogPostId,
    keyword,
    entryPosition,
    currentPosition,
    peakPosition,
    direction,
    snapshotCount: snapshots.length,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Find the organic position of a domain in SerpAPI results.
 * Returns null if the domain is not in the top results.
 */
function findPositionByDomain(
  results: Array<{ domain: string; position: number }>,
  targetDomain: string,
): number | null {
  const match = results.find(
    (r) => r.domain === targetDomain || r.domain.endsWith(`.${targetDomain}`),
  );
  return match?.position ?? null;
}
