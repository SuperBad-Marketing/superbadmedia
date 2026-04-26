import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const instagram_accounts = sqliteTable(
  "instagram_accounts",
  {
    id: text("id").primaryKey(),
    instagram_user_id: text("instagram_user_id").notNull(),
    username: text("username").notNull(),
    account_type: text("account_type", { enum: ["own", "client"] as const })
      .notNull()
      .default("own"),
    company_id: text("company_id"),
    access_token: text("access_token").notNull(),
    token_expires_at_ms: integer("token_expires_at_ms"),
    connected_at_ms: integer("connected_at_ms").notNull(),
    status: text("status", {
      enum: ["active", "disconnected", "revoked"] as const,
    })
      .notNull()
      .default("active"),
  },
  (t) => ({
    by_status: index("ig_accounts_status_idx").on(t.status),
    by_type: index("ig_accounts_type_idx").on(t.account_type),
  }),
);

export type InstagramAccountRow = typeof instagram_accounts.$inferSelect;
export type InstagramAccountInsert = typeof instagram_accounts.$inferInsert;

export const instagram_metrics_snapshots = sqliteTable(
  "instagram_metrics_snapshots",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    snapshot_date: text("snapshot_date").notNull(),
    followers: integer("followers"),
    follows: integer("follows"),
    reach: integer("reach"),
    impressions: integer("impressions"),
    profile_views: integer("profile_views"),
    website_clicks: integer("website_clicks"),
    synced_at_ms: integer("synced_at_ms").notNull(),
  },
  (t) => ({
    by_account_date: index("ig_metrics_account_date_idx").on(
      t.account_id,
      t.snapshot_date,
    ),
  }),
);

export type InstagramMetricsSnapshotRow =
  typeof instagram_metrics_snapshots.$inferSelect;

export const instagram_media = sqliteTable(
  "instagram_media",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    ig_media_id: text("ig_media_id").notNull(),
    media_type: text("media_type", {
      enum: [
        "IMAGE",
        "VIDEO",
        "CAROUSEL_ALBUM",
        "REEL",
        "STORY",
      ] as const,
    }).notNull(),
    source_post_id: text("source_post_id"),
    caption: text("caption"),
    permalink: text("permalink"),
    thumbnail_url: text("thumbnail_url"),
    published_at_ms: integer("published_at_ms").notNull(),
    engagement_score: real("engagement_score"),
    likes: integer("likes"),
    comments_count: integer("comments_count"),
    saves: integer("saves"),
    shares: integer("shares"),
    reach: integer("reach"),
    impressions: integer("impressions"),
    video_views: integer("video_views"),
    video_avg_watch_ms: integer("video_avg_watch_ms"),
    boost_status: text("boost_status", {
      enum: ["none", "recommended", "boosted", "completed"] as const,
    })
      .notNull()
      .default("none"),
    boost_budget_cents: integer("boost_budget_cents"),
    boost_start_ms: integer("boost_start_ms"),
    boost_end_ms: integer("boost_end_ms"),
    last_synced_at_ms: integer("last_synced_at_ms").notNull(),
  },
  (t) => ({
    by_account: index("ig_media_account_idx").on(t.account_id),
    by_published: index("ig_media_published_idx").on(t.published_at_ms),
    by_ig_media: index("ig_media_ig_id_idx").on(t.ig_media_id),
    by_source_post: index("ig_media_source_post_idx").on(t.source_post_id),
  }),
);

export type InstagramMediaRow = typeof instagram_media.$inferSelect;
export type InstagramMediaInsert = typeof instagram_media.$inferInsert;

export const instagram_audience_snapshots = sqliteTable(
  "instagram_audience_snapshots",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    snapshot_date: text("snapshot_date").notNull(),
    age_gender_json: text("age_gender_json", { mode: "json" }),
    top_cities_json: text("top_cities_json", { mode: "json" }),
    top_countries_json: text("top_countries_json", { mode: "json" }),
    online_hours_json: text("online_hours_json", { mode: "json" }),
    synced_at_ms: integer("synced_at_ms").notNull(),
  },
  (t) => ({
    by_account_date: index("ig_audience_account_date_idx").on(
      t.account_id,
      t.snapshot_date,
    ),
  }),
);

export type InstagramAudienceSnapshotRow =
  typeof instagram_audience_snapshots.$inferSelect;

export const instagram_strategy_reports = sqliteTable(
  "instagram_strategy_reports",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    report_type: text("report_type", {
      enum: ["weekly_digest", "realtime_alert"] as const,
    }).notNull(),
    generated_at_ms: integer("generated_at_ms").notNull(),
    period_start_ms: integer("period_start_ms"),
    period_end_ms: integer("period_end_ms"),
    summary_text: text("summary_text").notNull(),
    recommendations_json: text("recommendations_json", { mode: "json" }),
    content_ideas_json: text("content_ideas_json", { mode: "json" }),
    metrics_snapshot_json: text("metrics_snapshot_json", { mode: "json" }),
  },
  (t) => ({
    by_account: index("ig_strategy_account_idx").on(t.account_id),
    by_type: index("ig_strategy_type_idx").on(t.report_type),
  }),
);

export type InstagramStrategyReportRow =
  typeof instagram_strategy_reports.$inferSelect;

export const instagram_replies = sqliteTable(
  "instagram_replies",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    ig_comment_id: text("ig_comment_id"),
    ig_conversation_id: text("ig_conversation_id"),
    ig_message_id: text("ig_message_id"),
    reply_type: text("reply_type", {
      enum: ["comment", "dm"] as const,
    }).notNull(),
    inbound_text: text("inbound_text").notNull(),
    inbound_author: text("inbound_author"),
    classification: text("classification", {
      enum: [
        "lead",
        "complaint",
        "collab",
        "question",
        "praise",
        "spam",
        "simple",
      ] as const,
    }),
    draft_text: text("draft_text").notNull(),
    final_text: text("final_text"),
    status: text("status", {
      enum: [
        "pending_review",
        "approved",
        "sent",
        "escalated",
        "skipped",
      ] as const,
    }).notNull(),
    sent_at_ms: integer("sent_at_ms"),
    escalated_at_ms: integer("escalated_at_ms"),
    created_deal_id: text("created_deal_id"),
    feedback: text("feedback"),
    feedback_sentiment: text("feedback_sentiment", {
      enum: ["positive", "negative"] as const,
    }),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_account: index("ig_replies_account_idx").on(t.account_id),
    by_status: index("ig_replies_status_idx").on(t.status),
  }),
);

export type InstagramReplyRow = typeof instagram_replies.$inferSelect;

export const instagram_voice_corrections = sqliteTable(
  "instagram_voice_corrections",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    reply_id: text("reply_id").notNull(),
    reply_type: text("reply_type", {
      enum: ["comment", "dm"] as const,
    }).notNull(),
    ai_draft: text("ai_draft").notNull(),
    andy_version: text("andy_version").notNull(),
    correction_note: text("correction_note"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_account: index("ig_corrections_account_idx").on(t.account_id),
  }),
);

export type InstagramVoiceCorrectionRow =
  typeof instagram_voice_corrections.$inferSelect;

export const CONTENT_PLAN_STATUSES = [
  "awaiting_review",
  "partially_approved",
  "all_approved",
  "expired",
] as const;
export type ContentPlanStatus = (typeof CONTENT_PLAN_STATUSES)[number];

export const PLAN_SLOT_CONTENT_TYPES = [
  "carousel",
  "single",
  "reel",
  "story",
] as const;
export type PlanSlotContentType = (typeof PLAN_SLOT_CONTENT_TYPES)[number];

export interface ContentPlanSlot {
  index: number;
  suggested_date: string;
  day_of_week: string;
  content_type: PlanSlotContentType;
  topic: string;
  caption_direction: string;
  approved: boolean;
  task_id: string | null;
}

export const instagram_content_plans = sqliteTable(
  "instagram_content_plans",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id")
      .notNull()
      .references(() => instagram_accounts.id, { onDelete: "cascade" }),
    strategy_report_id: text("strategy_report_id"),
    week_start_date: text("week_start_date").notNull(),
    week_end_date: text("week_end_date").notNull(),
    theme_summary: text("theme_summary").notNull(),
    slots_json: text("slots_json", { mode: "json" })
      .$type<ContentPlanSlot[]>()
      .notNull(),
    status: text("status", { enum: CONTENT_PLAN_STATUSES })
      .notNull()
      .default("awaiting_review"),
    nudge_sent: integer("nudge_sent", { mode: "boolean" })
      .notNull()
      .default(false),
    reviewed_at_ms: integer("reviewed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    unique_account_week: uniqueIndex("ig_plans_account_week_idx").on(
      t.account_id,
      t.week_start_date,
    ),
    by_status: index("ig_plans_status_idx").on(t.status),
  }),
);

export type InstagramContentPlanRow =
  typeof instagram_content_plans.$inferSelect;
export type InstagramContentPlanInsert =
  typeof instagram_content_plans.$inferInsert;
