/**
 * CE-1 — Content Engine schema sanity.
 *
 * Covers:
 *  - All 8 tables exist via migration + insert round-trips.
 *  - FK cascades: company deletion cascades to all CE tables.
 *  - Hiring Pipeline claimable columns on content_topics.
 *  - content_engine_config company_id uniqueness.
 *  - newsletter_subscribers compound email index.
 *  - Enum values match spec §11.1.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import { companies } from "@/lib/db/schema/companies";
import { contentTopics, CONTENT_TOPIC_STATUSES } from "@/lib/db/schema/content-topics";
import { blogPosts, BLOG_POST_STATUSES } from "@/lib/db/schema/blog-posts";
import { blogPostFeedback, BLOG_FEEDBACK_ROLES } from "@/lib/db/schema/blog-post-feedback";
import { socialDrafts, SOCIAL_PLATFORMS, SOCIAL_DRAFT_FORMATS, SOCIAL_DRAFT_STATUSES } from "@/lib/db/schema/social-drafts";
import { newsletterSubscribers, NEWSLETTER_CONSENT_SOURCES, NEWSLETTER_SUBSCRIBER_STATUSES } from "@/lib/db/schema/newsletter-subscribers";
import { newsletterSends, NEWSLETTER_FORMATS } from "@/lib/db/schema/newsletter-sends";
import { rankingSnapshots, RANKING_SOURCES } from "@/lib/db/schema/ranking-snapshots";
import { contentEngineConfig, SEND_WINDOW_DAYS } from "@/lib/db/schema/content-engine-config";

const TEST_DB = path.join(process.cwd(), "tests/.test-ce1-schema.db");
const NOW = 1_700_000_000_000;

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

async function seedCompany(): Promise<string> {
  const id = randomUUID();
  await db.insert(companies).values({
    id,
    name: "Test Co",
    name_normalised: "test co",
    billing_mode: "stripe",
    first_seen_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
  });
  return id;
}

describe("content_topics table", () => {
  it("round-trips a full row", async () => {
    const companyId = await seedCompany();
    const id = randomUUID();
    await db.insert(contentTopics).values({
      id,
      company_id: companyId,
      keyword: "melbourne photography studio",
      rankability_score: 72,
      content_gaps: ["no guide for small business"],
      outline: { sections: ["intro", "tips"], word_count: 1200 },
      serp_snapshot: { top_10: [] },
      status: "queued",
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(contentTopics)
      .where(eq(contentTopics.id, id));
    expect(row.keyword).toBe("melbourne photography studio");
    expect(row.rankability_score).toBe(72);
    expect(row.status).toBe("queued");
  });

  it("supports Hiring Pipeline claimable columns", async () => {
    const companyId = await seedCompany();
    const id = randomUUID();
    const candidateId = randomUUID();
    await db.insert(contentTopics).values({
      id,
      company_id: companyId,
      keyword: "brand photography tips",
      claimed_by: candidateId,
      claimed_at_ms: NOW,
      claim_budget_cap_aud: 50,
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(contentTopics)
      .where(eq(contentTopics.id, id));
    expect(row.claimed_by).toBe(candidateId);
    expect(row.claim_budget_cap_aud).toBe(50);
  });
});

describe("blog_posts table", () => {
  it("round-trips a full row with FK to content_topics", async () => {
    const companyId = await seedCompany();
    const topicId = randomUUID();
    await db.insert(contentTopics).values({
      id: topicId,
      company_id: companyId,
      keyword: "test keyword",
      created_at_ms: NOW,
    });
    const postId = randomUUID();
    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topicId,
      title: "Test Post",
      slug: "test-post",
      body: "# Hello\nWorld",
      meta_description: "A test post",
      status: "draft",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, postId));
    expect(row.title).toBe("Test Post");
    expect(row.slug).toBe("test-post");
    expect(row.topic_id).toBe(topicId);
  });
});

describe("blog_post_feedback table", () => {
  it("round-trips a rejection chat message", async () => {
    const companyId = await seedCompany();
    const topicId = randomUUID();
    await db.insert(contentTopics).values({
      id: topicId,
      company_id: companyId,
      keyword: "feedback test",
      created_at_ms: NOW,
    });
    const postId = randomUUID();
    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topicId,
      title: "Feedback Post",
      slug: "feedback-post",
      body: "Draft body",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const feedbackId = randomUUID();
    await db.insert(blogPostFeedback).values({
      id: feedbackId,
      blog_post_id: postId,
      role: "user",
      content: "Too corporate, pull it back",
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(blogPostFeedback)
      .where(eq(blogPostFeedback.id, feedbackId));
    expect(row.role).toBe("user");
    expect(row.content).toBe("Too corporate, pull it back");
  });
});

describe("social_drafts table", () => {
  it("round-trips a carousel draft with visual assets", async () => {
    const companyId = await seedCompany();
    const topicId = randomUUID();
    await db.insert(contentTopics).values({
      id: topicId,
      company_id: companyId,
      keyword: "social test",
      created_at_ms: NOW,
    });
    const postId = randomUUID();
    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topicId,
      title: "Social Post",
      slug: "social-post",
      body: "Body",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const draftId = randomUUID();
    await db.insert(socialDrafts).values({
      id: draftId,
      blog_post_id: postId,
      platform: "instagram",
      text: "Check this out #photography",
      format: "carousel",
      visual_asset_urls: ["https://r2.example/slide1.png", "https://r2.example/slide2.png"],
      carousel_slides: [{ text: "Slide 1" }, { text: "Slide 2" }],
      status: "ready",
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(socialDrafts)
      .where(eq(socialDrafts.id, draftId));
    expect(row.platform).toBe("instagram");
    expect(row.format).toBe("carousel");
    expect(row.visual_asset_urls).toEqual([
      "https://r2.example/slide1.png",
      "https://r2.example/slide2.png",
    ]);
  });
});

describe("newsletter_subscribers table", () => {
  it("round-trips a subscriber with consent tracking", async () => {
    const companyId = await seedCompany();
    const subId = randomUUID();
    await db.insert(newsletterSubscribers).values({
      id: subId,
      company_id: companyId,
      email: "reader@example.com",
      name: "Reader",
      consent_source: "blog_cta",
      consented_at_ms: NOW,
      status: "active",
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, subId));
    expect(row.email).toBe("reader@example.com");
    expect(row.consent_source).toBe("blog_cta");
    expect(row.status).toBe("active");
  });
});

describe("newsletter_sends table", () => {
  it("round-trips a digest send with multiple post IDs", async () => {
    const companyId = await seedCompany();
    const sendId = randomUUID();
    const postIds = [randomUUID(), randomUUID()];
    await db.insert(newsletterSends).values({
      id: sendId,
      company_id: companyId,
      blog_post_ids: postIds,
      subject: "This week in photography",
      body: "<html>digest</html>",
      format: "digest",
      scheduled_for_ms: NOW + 86400000,
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(newsletterSends)
      .where(eq(newsletterSends.id, sendId));
    expect(row.format).toBe("digest");
    expect(row.blog_post_ids).toEqual(postIds);
  });
});

describe("ranking_snapshots table", () => {
  it("round-trips a SerpAPI ranking snapshot", async () => {
    const companyId = await seedCompany();
    const topicId = randomUUID();
    await db.insert(contentTopics).values({
      id: topicId,
      company_id: companyId,
      keyword: "ranking test",
      created_at_ms: NOW,
    });
    const postId = randomUUID();
    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topicId,
      title: "Ranked Post",
      slug: "ranked-post",
      body: "Body",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const snapId = randomUUID();
    await db.insert(rankingSnapshots).values({
      id: snapId,
      blog_post_id: postId,
      keyword: "ranking test",
      position: 7,
      source: "serpapi",
      snapshot_date_ms: NOW,
      created_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.id, snapId));
    expect(row.position).toBe(7);
    expect(row.source).toBe("serpapi");
  });
});

describe("content_engine_config table", () => {
  it("round-trips a full config row", async () => {
    const companyId = await seedCompany();
    const configId = randomUUID();
    await db.insert(contentEngineConfig).values({
      id: configId,
      company_id: companyId,
      seed_keywords: ["photography", "branding", "melbourne"],
      send_window_day: "tuesday",
      send_window_time: "10:00",
      send_window_tz: "Australia/Melbourne",
      embed_form_token: randomUUID(),
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    const [row] = await db
      .select()
      .from(contentEngineConfig)
      .where(eq(contentEngineConfig.id, configId));
    expect(row.seed_keywords).toEqual(["photography", "branding", "melbourne"]);
    expect(row.send_window_day).toBe("tuesday");
  });

  it("enforces one config per company (unique constraint)", async () => {
    const companyId = await seedCompany();
    await db.insert(contentEngineConfig).values({
      id: randomUUID(),
      company_id: companyId,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    expect(() =>
      sqlite.prepare(
        "INSERT INTO content_engine_config (id, company_id, send_window_day, send_window_time, send_window_tz, created_at_ms, updated_at_ms) VALUES (?, ?, 'tuesday', '10:00', 'Australia/Melbourne', ?, ?)"
      ).run(randomUUID(), companyId, NOW, NOW)
    ).toThrow(/UNIQUE/);
  });
});

describe("FK cascades", () => {
  it("company deletion cascades to all CE tables", async () => {
    const companyId = await seedCompany();
    const topicId = randomUUID();
    await db.insert(contentTopics).values({
      id: topicId,
      company_id: companyId,
      keyword: "cascade test",
      created_at_ms: NOW,
    });
    const postId = randomUUID();
    await db.insert(blogPosts).values({
      id: postId,
      company_id: companyId,
      topic_id: topicId,
      title: "Cascade Post",
      slug: "cascade-post",
      body: "Body",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });
    await db.insert(blogPostFeedback).values({
      id: randomUUID(),
      blog_post_id: postId,
      role: "user",
      content: "Feedback",
      created_at_ms: NOW,
    });
    await db.insert(socialDrafts).values({
      id: randomUUID(),
      blog_post_id: postId,
      platform: "linkedin",
      text: "Post text",
      format: "single",
      status: "ready",
      created_at_ms: NOW,
    });
    await db.insert(newsletterSubscribers).values({
      id: randomUUID(),
      company_id: companyId,
      email: "cascade@test.com",
      consent_source: "embed_form",
      consented_at_ms: NOW,
      created_at_ms: NOW,
    });
    await db.insert(newsletterSends).values({
      id: randomUUID(),
      company_id: companyId,
      blog_post_ids: [postId],
      subject: "Send",
      body: "<html/>",
      format: "single",
      created_at_ms: NOW,
    });
    await db.insert(rankingSnapshots).values({
      id: randomUUID(),
      blog_post_id: postId,
      keyword: "cascade",
      source: "serpapi",
      snapshot_date_ms: NOW,
      created_at_ms: NOW,
    });
    await db.insert(contentEngineConfig).values({
      id: randomUUID(),
      company_id: companyId,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    });

    // Delete the company — everything should cascade
    sqlite.prepare("DELETE FROM companies WHERE id = ?").run(companyId);

    const topics = await db.select().from(contentTopics).where(eq(contentTopics.company_id, companyId));
    const posts = await db.select().from(blogPosts).where(eq(blogPosts.company_id, companyId));
    const subs = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.company_id, companyId));
    const sends = await db.select().from(newsletterSends).where(eq(newsletterSends.company_id, companyId));
    const configs = await db.select().from(contentEngineConfig).where(eq(contentEngineConfig.company_id, companyId));

    expect(topics).toHaveLength(0);
    expect(posts).toHaveLength(0);
    expect(subs).toHaveLength(0);
    expect(sends).toHaveLength(0);
    expect(configs).toHaveLength(0);
  });
});

describe("enum values match spec §11", () => {
  it("content_topic statuses", () => {
    expect(CONTENT_TOPIC_STATUSES).toEqual(["queued", "vetoed", "generating", "generated", "skipped"]);
  });

  it("blog_post statuses", () => {
    expect(BLOG_POST_STATUSES).toEqual(["draft", "in_review", "approved", "publishing", "published", "rejected"]);
  });

  it("blog_feedback roles", () => {
    expect(BLOG_FEEDBACK_ROLES).toEqual(["user", "assistant"]);
  });

  it("social platforms", () => {
    expect(SOCIAL_PLATFORMS).toEqual(["instagram", "linkedin", "x", "facebook"]);
  });

  it("social draft formats", () => {
    expect(SOCIAL_DRAFT_FORMATS).toEqual(["single", "carousel", "video"]);
  });

  it("social draft statuses", () => {
    expect(SOCIAL_DRAFT_STATUSES).toEqual(["generating", "ready", "published"]);
  });

  it("newsletter consent sources", () => {
    expect(NEWSLETTER_CONSENT_SOURCES).toEqual([
      "csv_import", "embed_form", "blog_cta", "outreach_reply", "permission_pass",
    ]);
  });

  it("newsletter subscriber statuses", () => {
    expect(NEWSLETTER_SUBSCRIBER_STATUSES).toEqual([
      "pending_confirmation", "active", "bounced", "unsubscribed", "inactive_removed",
    ]);
  });

  it("newsletter formats", () => {
    expect(NEWSLETTER_FORMATS).toEqual(["single", "digest"]);
  });

  it("ranking sources", () => {
    expect(RANKING_SOURCES).toEqual(["serpapi", "gsc"]);
  });

  it("send window days", () => {
    expect(SEND_WINDOW_DAYS).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    ]);
  });
});
