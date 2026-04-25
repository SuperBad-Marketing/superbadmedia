import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const VIDEO_TYPES = [
  "cinematic",
  "motion_design",
  "product_showcase",
  "social_short",
  "talking_head",
] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

export const VIDEO_ENGINES = ["higgsfield", "remotion"] as const;
export type VideoEngine = (typeof VIDEO_ENGINES)[number];

export const VIDEO_STATUSES = [
  "draft",
  "queued",
  "generating",
  "ready",
  "failed",
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const videoJobs = sqliteTable(
  "video_jobs",
  {
    id: text("id").primaryKey(),
    video_type: text("video_type", { enum: VIDEO_TYPES }).notNull(),
    engine: text("engine", { enum: VIDEO_ENGINES }).notNull(),
    status: text("status", { enum: VIDEO_STATUSES }).notNull().default("draft"),

    initial_prompt: text("initial_prompt").notNull(),
    resolved_prompt: text("resolved_prompt"),
    brief_json: text("brief_json", { mode: "json" }),

    // Brand context
    brand_source: text("brand_source").notNull().default("superbad"),
    client_id: text("client_id"),
    ad_hoc_brand_json: text("ad_hoc_brand_json", { mode: "json" }),

    // Generation details
    external_job_id: text("external_job_id"),
    model_used: text("model_used"),
    duration_sec: integer("duration_sec"),
    aspect_ratio: text("aspect_ratio"),
    credits_used: integer("credits_used"),

    // Output
    output_url: text("output_url"),
    thumbnail_url: text("thumbnail_url"),
    error_message: text("error_message"),

    // Metadata
    created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    queued_at: integer("queued_at", { mode: "timestamp_ms" }),
    completed_at: integer("completed_at", { mode: "timestamp_ms" }),
    generation_ms: integer("generation_ms"),

    content_studio_post_id: text("content_studio_post_id"),
  },
  (t) => ({
    by_status: index("video_jobs_status_idx").on(t.status, t.created_at),
    by_client: index("video_jobs_client_idx").on(t.client_id),
  }),
);

export type VideoJobRow = typeof videoJobs.$inferSelect;
export type VideoJobInsert = typeof videoJobs.$inferInsert;
