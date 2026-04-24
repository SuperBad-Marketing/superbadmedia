import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const CONTENT_TYPES = [
  "announcement",
  "anti_motivation",
  "portfolio",
  "tips",
  "testimonial",
  "behind_the_scenes",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const ASPECT_RATIOS = [
  "portrait",
  "square",
  "landscape",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const RENDER_STATUSES = [
  "draft",
  "rendering",
  "rendered",
  "failed",
] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

export const contentStudioPosts = sqliteTable(
  "content_studio_posts",
  {
    id: text("id").primaryKey(),
    brief: text("brief").notNull(),
    content_type: text("content_type", { enum: CONTENT_TYPES }).notNull(),
    template_id: text("template_id").notNull(),

    generated_copy_json: text("generated_copy_json", { mode: "json" }),
    correction_history_json: text("correction_history_json", { mode: "json" }),

    status: text("status", { enum: RENDER_STATUSES })
      .notNull()
      .default("draft"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_type: index("csp_type_idx").on(t.content_type),
    by_status: index("csp_status_idx").on(t.status),
    by_created: index("csp_created_idx").on(t.created_at_ms),
  }),
);

export type ContentStudioPostRow = typeof contentStudioPosts.$inferSelect;
export type ContentStudioPostInsert = typeof contentStudioPosts.$inferInsert;

export const contentStudioRenders = sqliteTable(
  "content_studio_renders",
  {
    id: text("id").primaryKey(),
    post_id: text("post_id")
      .notNull()
      .references(() => contentStudioPosts.id, { onDelete: "cascade" }),
    aspect_ratio: text("aspect_ratio", { enum: ASPECT_RATIOS }).notNull(),
    platforms: text("platforms").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    cloudinary_public_id: text("cloudinary_public_id"),
    cloudinary_url: text("cloudinary_url"),
    render_status: text("render_status", { enum: RENDER_STATUSES })
      .notNull()
      .default("rendering"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_post: index("csr_post_idx").on(t.post_id),
  }),
);

export type ContentStudioRenderRow = typeof contentStudioRenders.$inferSelect;
