import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { blogPosts } from "./blog-posts";

/**
 * Content Engine — rejection chat thread per blog post (CE-1). Same
 * user/assistant role pattern as other chat surfaces. Persistent iteration
 * history — subscriber types feedback, Claude regenerates, updated draft
 * replaces the original.
 */
export const BLOG_FEEDBACK_ROLES = ["user", "assistant"] as const;
export type BlogFeedbackRole = (typeof BLOG_FEEDBACK_ROLES)[number];

export const blogPostFeedback = sqliteTable(
  "blog_post_feedback",
  {
    id: text("id").primaryKey(),
    blog_post_id: text("blog_post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    role: text("role", { enum: BLOG_FEEDBACK_ROLES }).notNull(),
    content: text("content").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_post: index("blog_post_feedback_post_idx").on(t.blog_post_id),
  }),
);

export type BlogPostFeedbackRow = typeof blogPostFeedback.$inferSelect;
export type BlogPostFeedbackInsert = typeof blogPostFeedback.$inferInsert;
