import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contentTopics } from "./content-topics";

/**
 * Content Engine — blog post (CE-1). Two-pass generation: Haiku outline
 * (stored on `content_topics.outline`) → Opus draft. Status lifecycle:
 * `draft` → `in_review` → `approved` → `publishing` → `published`
 * (or `rejected` from `in_review`).
 *
 * Body is markdown. SEO package: title, meta, OG image, JSON-LD, TOC,
 * internal links, featured snippet section. Published URL built from
 * `slug` + company domain config.
 */
export const BLOG_POST_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "publishing",
  "published",
  "rejected",
] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const blogPosts = sqliteTable(
  "blog_posts",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    topic_id: text("topic_id")
      .notNull()
      .references(() => contentTopics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull(),
    meta_description: text("meta_description"),
    og_image_url: text("og_image_url"),
    structured_data: text("structured_data", { mode: "json" }),
    internal_links: text("internal_links", { mode: "json" }),
    snippet_target_section: text("snippet_target_section"),
    status: text("status", { enum: BLOG_POST_STATUSES })
      .notNull()
      .default("draft"),
    published_at_ms: integer("published_at_ms"),
    published_url: text("published_url"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company_status: index("blog_posts_company_status_idx").on(
      t.company_id,
      t.status,
    ),
    by_status: index("blog_posts_status_idx").on(t.status),
    by_topic: index("blog_posts_topic_idx").on(t.topic_id),
    by_slug: index("blog_posts_slug_idx").on(t.company_id, t.slug),
  }),
);

export type BlogPostRow = typeof blogPosts.$inferSelect;
export type BlogPostInsert = typeof blogPosts.$inferInsert;
