import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_watched_accounts,
  instagram_competitor_posts,
} from "@/lib/db/schema/instagram-competitive";
import { runApifyActor } from "@/lib/lead-gen/sources/apify-runner";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { logActivity } from "@/lib/activity-log";
import { scoreCompetitorPosts } from "./score-posts";

interface ApifyInstagramPost {
  url?: string;
  displayUrl?: string;
  imageUrl?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  type?: string;
  id?: string;
}

interface ApifyInstagramProfile {
  username?: string;
  fullName?: string;
  followersCount?: number;
  biography?: string;
  profilePicUrl?: string;
  latestPosts?: ApifyInstagramPost[];
  posts?: ApifyInstagramPost[];
}

export async function scrapeWatchedAccounts(): Promise<{
  accountsScraped: number;
  postsStored: number;
}> {
  const accounts = await db
    .select()
    .from(instagram_watched_accounts)
    .where(eq(instagram_watched_accounts.status, "active"))
    .all();

  if (accounts.length === 0) return { accountsScraped: 0, postsStored: 0 };

  let totalPosts = 0;
  const now = Date.now();

  for (const account of accounts) {
    const results = await runApifyActor<ApifyInstagramProfile>({
      actorId: "apify~instagram-profile-scraper",
      input: {
        usernames: [account.username],
        resultsLimit: 50,
      },
      jobName: "apify.instagram_profile",
      timeoutMs: 70_000,
      pollIntervalMs: 5_000,
      maxPollAttempts: 15,
      estimatedCostAud: 0.05,
    });

    const profile = results[0];
    if (!profile) continue;

    const followers = profile.followersCount ?? 0;
    const posts = profile.latestPosts ?? profile.posts ?? [];

    await db
      .update(instagram_watched_accounts)
      .set({
        display_name: profile.fullName ?? account.display_name,
        followers,
        bio: profile.biography ?? account.bio,
        last_scraped_at_ms: now,
        posts_scraped: posts.length,
      })
      .where(eq(instagram_watched_accounts.id, account.id));

    const scored = scoreCompetitorPosts(posts, followers);

    for (const post of scored) {
      let imageUrl = post.imageUrl;

      if (imageUrl) {
        try {
          const uploaded = await uploadToCloudinary(imageUrl, `superbad/competitive-intel/${account.username}`);
          imageUrl = uploaded.secure_url;
        } catch {
          console.warn(`Cloudinary upload failed for ${account.username} post — using original URL`);
        }
      }

      if (!imageUrl) continue;

      await db.insert(instagram_competitor_posts).values({
        id: randomUUID(),
        watched_account_id: account.id,
        ig_permalink: post.permalink ?? undefined,
        media_type: mapMediaType(post.type ?? undefined),
        caption: post.caption ?? undefined,
        image_url: imageUrl,
        likes: post.likes,
        comments: post.comments,
        post_er: post.postEr,
        performance_score: post.performanceScore,
        recency_weight: post.recencyWeight,
        final_score: post.finalScore,
        why_high: null,
        published_at_ms: post.publishedAtMs,
        scraped_at_ms: now,
      });

      totalPosts++;
    }

    const avgEr = scored.length > 0
      ? scored.reduce((sum, p) => sum + p.postEr, 0) / scored.length
      : 0;

    await db
      .update(instagram_watched_accounts)
      .set({ avg_engagement_rate: avgEr })
      .where(eq(instagram_watched_accounts.id, account.id));
  }

  await logActivity({
    kind: "instagram_competitive_scrape_completed",
    body: `Scraped ${accounts.length} watched account${accounts.length !== 1 ? "s" : ""} — ${totalPosts} posts stored.`,
    meta: {
      accounts_scraped: accounts.length,
      posts_stored: totalPosts,
    },
  });

  return { accountsScraped: accounts.length, postsStored: totalPosts };
}

function mapMediaType(
  type?: string,
): "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL" {
  if (!type) return "IMAGE";
  const t = type.toUpperCase();
  if (t === "VIDEO" || t === "REEL") return t as "VIDEO" | "REEL";
  if (t.includes("CAROUSEL") || t === "SIDECAR") return "CAROUSEL_ALBUM";
  return "IMAGE";
}
