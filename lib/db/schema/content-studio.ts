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
  "portrait_3x4",
  "portrait_4x5",
  "landscape_16x9",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const RENDER_STATUSES = [
  "draft",
  "rendering",
  "rendered",
  "failed",
] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

export const RENDER_TYPES = ["static", "motion"] as const;
export type RenderType = (typeof RENDER_TYPES)[number];

export const RENDER_FORMATS = ["png", "mp4", "webm"] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

export const contentStudioPosts = sqliteTable(
  "content_studio_posts",
  {
    id: text("id").primaryKey(),
    brief: text("brief").notNull(),
    content_type: text("content_type", { enum: CONTENT_TYPES }).notNull(),
    template_id: text("template_id").notNull(),

    slide_count: integer("slide_count").notNull().default(1),
    generated_copy_json: text("generated_copy_json", { mode: "json" }),
    correction_history_json: text("correction_history_json", { mode: "json" }),

    status: text("status", { enum: RENDER_STATUSES })
      .notNull()
      .default("draft"),

    motion_enabled: integer("motion_enabled").notNull().default(0),
    motion_template_id: text("motion_template_id"),
    palette_id: text("palette_id"),
    animation_params_json: text("animation_params_json"),
    primary_aspect_ratio: text("primary_aspect_ratio"),
    inspiration_refs_json: text("inspiration_refs_json"),

    font_pairing_id: text("font_pairing_id"),
    static_palette_id: text("static_palette_id"),
    custom_palette_json: text("custom_palette_json"),
    motion_duration_frames: integer("motion_duration_frames"),
    promoted_from_post_id: text("promoted_from_post_id"),

    source_braindump_id: text("source_braindump_id"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_type: index("csp_type_idx").on(t.content_type),
    by_status: index("csp_status_idx").on(t.status),
    by_created: index("csp_created_idx").on(t.created_at_ms),
    by_braindump: index("csp_braindump_idx").on(t.source_braindump_id),
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
    slide_index: integer("slide_index").notNull().default(0),
    aspect_ratio: text("aspect_ratio", { enum: ASPECT_RATIOS }).notNull(),
    platforms: text("platforms").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    cloudinary_public_id: text("cloudinary_public_id"),
    cloudinary_url: text("cloudinary_url"),
    render_status: text("render_status", { enum: RENDER_STATUSES })
      .notNull()
      .default("rendering"),
    render_type: text("render_type", { enum: RENDER_TYPES })
      .notNull()
      .default("static"),
    format: text("format", { enum: RENDER_FORMATS })
      .notNull()
      .default("png"),
    video_job_id: text("video_job_id"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_post: index("csr_post_idx").on(t.post_id),
  }),
);

export type ContentStudioRenderRow = typeof contentStudioRenders.$inferSelect;
