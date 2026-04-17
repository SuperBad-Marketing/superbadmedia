import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { blogPosts } from "./blog-posts";

/**
 * Content Engine — social media draft per blog post per platform (CE-1).
 * Claude decides format (single/carousel/video) per platform. Visual
 * assets stored in R2 (URLs in `visual_asset_urls` JSON array).
 *
 * v1 publishing is stub-adapter — Publish button opens native compose
 * screen. Real API integrations slot in later.
 */
export const SOCIAL_PLATFORMS = [
  "instagram",
  "linkedin",
  "x",
  "facebook",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_DRAFT_FORMATS = [
  "single",
  "carousel",
  "video",
] as const;
export type SocialDraftFormat = (typeof SOCIAL_DRAFT_FORMATS)[number];

export const SOCIAL_DRAFT_STATUSES = [
  "generating",
  "ready",
  "published",
] as const;
export type SocialDraftStatus = (typeof SOCIAL_DRAFT_STATUSES)[number];

export const socialDrafts = sqliteTable(
  "social_drafts",
  {
    id: text("id").primaryKey(),
    blog_post_id: text("blog_post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: SOCIAL_PLATFORMS }).notNull(),
    text: text("text").notNull(),
    format: text("format", { enum: SOCIAL_DRAFT_FORMATS }).notNull(),
    visual_asset_urls: text("visual_asset_urls", { mode: "json" }),
    image_prompt: text("image_prompt"),
    carousel_slides: text("carousel_slides", { mode: "json" }),
    status: text("status", { enum: SOCIAL_DRAFT_STATUSES })
      .notNull()
      .default("generating"),
    published_at_ms: integer("published_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_post: index("social_drafts_post_idx").on(t.blog_post_id),
    by_status: index("social_drafts_status_idx").on(t.status),
    by_platform: index("social_drafts_platform_idx").on(
      t.blog_post_id,
      t.platform,
    ),
  }),
);

export type SocialDraftRow = typeof socialDrafts.$inferSelect;
export type SocialDraftInsert = typeof socialDrafts.$inferInsert;
