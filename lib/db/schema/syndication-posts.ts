import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { blogPosts } from "./blog-posts";
import { syndicationTargets } from "./syndication-targets";

export const SYNDICATION_POST_STATUSES = [
  "pending",
  "syndicating",
  "syndicated",
  "failed",
] as const;
export type SyndicationPostStatus = (typeof SYNDICATION_POST_STATUSES)[number];

export const syndicationPosts = sqliteTable(
  "syndication_posts",
  {
    id: text("id").primaryKey(),
    blog_post_id: text("blog_post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    syndication_target_id: text("syndication_target_id")
      .notNull()
      .references(() => syndicationTargets.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    status: text("status", { enum: SYNDICATION_POST_STATUSES })
      .notNull()
      .default("pending"),
    platform_url: text("platform_url"),
    platform_post_id: text("platform_post_id"),
    error_message: text("error_message"),
    attempted_at_ms: integer("attempted_at_ms"),
    syndicated_at_ms: integer("syndicated_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_post: index("syndication_posts_post_idx").on(t.blog_post_id),
    by_target: index("syndication_posts_target_idx").on(
      t.syndication_target_id,
    ),
    by_status: index("syndication_posts_status_idx").on(t.status),
    unique_post_target: index("syndication_posts_post_target_idx").on(
      t.blog_post_id,
      t.syndication_target_id,
    ),
  }),
);

export type SyndicationPostRow = typeof syndicationPosts.$inferSelect;
export type SyndicationPostInsert = typeof syndicationPosts.$inferInsert;
