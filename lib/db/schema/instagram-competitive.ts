import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const WATCHED_ACCOUNT_CATEGORIES = [
  "photography_agency",
  "content_agency",
  "wildcard",
] as const;
export type WatchedAccountCategory =
  (typeof WATCHED_ACCOUNT_CATEGORIES)[number];

export const WATCHED_ACCOUNT_STATUSES = [
  "active",
  "paused",
  "removed",
] as const;

export const instagram_watched_accounts = sqliteTable(
  "instagram_watched_accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    display_name: text("display_name"),
    category: text("category", { enum: WATCHED_ACCOUNT_CATEGORIES })
      .notNull()
      .default("wildcard"),
    followers: integer("followers"),
    bio: text("bio"),
    profile_pic_url: text("profile_pic_url"),
    last_scraped_at_ms: integer("last_scraped_at_ms"),
    posts_scraped: integer("posts_scraped").notNull().default(0),
    avg_engagement_rate: real("avg_engagement_rate"),
    added_at_ms: integer("added_at_ms").notNull(),
    status: text("status", { enum: WATCHED_ACCOUNT_STATUSES })
      .notNull()
      .default("active"),
  },
  (t) => ({
    by_status: index("ig_watched_status_idx").on(t.status),
  }),
);

export type WatchedAccountRow =
  typeof instagram_watched_accounts.$inferSelect;
export type WatchedAccountInsert =
  typeof instagram_watched_accounts.$inferInsert;

export const COMPETITOR_POST_MEDIA_TYPES = [
  "IMAGE",
  "VIDEO",
  "CAROUSEL_ALBUM",
  "REEL",
] as const;

export const instagram_competitor_posts = sqliteTable(
  "instagram_competitor_posts",
  {
    id: text("id").primaryKey(),
    watched_account_id: text("watched_account_id")
      .notNull()
      .references(() => instagram_watched_accounts.id, { onDelete: "cascade" }),
    ig_permalink: text("ig_permalink"),
    media_type: text("media_type", { enum: COMPETITOR_POST_MEDIA_TYPES })
      .notNull()
      .default("IMAGE"),
    caption: text("caption"),
    image_url: text("image_url").notNull(),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    post_er: real("post_er").notNull().default(0),
    performance_score: real("performance_score").notNull().default(0),
    recency_weight: real("recency_weight").notNull().default(1),
    final_score: real("final_score").notNull().default(0),
    why_high: text("why_high"),
    published_at_ms: integer("published_at_ms").notNull(),
    scraped_at_ms: integer("scraped_at_ms").notNull(),
  },
  (t) => ({
    by_account: index("ig_comp_posts_account_idx").on(t.watched_account_id),
    by_score: index("ig_comp_posts_score_idx").on(t.final_score),
  }),
);

export type CompetitorPostRow =
  typeof instagram_competitor_posts.$inferSelect;
export type CompetitorPostInsert =
  typeof instagram_competitor_posts.$inferInsert;

export const INSPIRATION_REACTIONS = ["like", "dislike"] as const;
export type InspirationReaction = (typeof INSPIRATION_REACTIONS)[number];

export const instagram_inspiration_reactions = sqliteTable(
  "instagram_inspiration_reactions",
  {
    id: text("id").primaryKey(),
    competitor_post_id: text("competitor_post_id")
      .notNull()
      .references(() => instagram_competitor_posts.id, { onDelete: "cascade" }),
    reaction: text("reaction", { enum: INSPIRATION_REACTIONS }).notNull(),
    reacted_at_ms: integer("reacted_at_ms").notNull(),
  },
  (t) => ({
    unique_post: uniqueIndex("ig_insp_reaction_unique_idx").on(
      t.competitor_post_id,
    ),
  }),
);

export type InspirationReactionRow =
  typeof instagram_inspiration_reactions.$inferSelect;

export const instagram_taste_profiles = sqliteTable(
  "instagram_taste_profiles",
  {
    id: text("id").primaryKey(),
    generated_at_ms: integer("generated_at_ms").notNull(),
    reaction_count: integer("reaction_count").notNull().default(0),
    preferred_types_json: text("preferred_types_json", { mode: "json" }),
    preferred_styles_json: text("preferred_styles_json", { mode: "json" }),
    preferred_topics_json: text("preferred_topics_json", { mode: "json" }),
    anti_patterns_json: text("anti_patterns_json", { mode: "json" }),
    raw_analysis_text: text("raw_analysis_text"),
  },
);

export type TasteProfileRow = typeof instagram_taste_profiles.$inferSelect;

export interface EnhancedContentPlanSlot {
  index: number;
  suggested_date: string;
  day_of_week: string;
  content_type: "carousel" | "single" | "reel" | "story";
  topic: string;
  caption_direction: string;
  creation_steps: Array<{
    step: number;
    instruction: string;
    is_manual: boolean;
  }>;
  requires_manual_input: boolean;
  manual_input_description: string | null;
  status: "pending" | "approved" | "created" | "posted";
  task_id: string | null;
  ig_media_id: string | null;
  inspiration_post_ids: string[];
  estimated_minutes: number;
  approved: boolean;
}

export interface MoodSignal {
  energy: "high" | "medium" | "low";
  mood: string;
  confidence: number;
  extracted_at_ms: number;
}
