import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { user } from "./user";

/* ------------------------------------------------------------------ */
/* Campaign objectives & status enums                                  */
/* ------------------------------------------------------------------ */

export const CAMPAIGN_OBJECTIVES = [
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "conversions",
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const FUNNEL_STAGES = ["top", "middle", "bottom"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "paused",
  "completed",
  "failed",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const AD_SET_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
] as const;
export type AdSetStatus = (typeof AD_SET_STATUSES)[number];

export const AD_STATUSES = [
  "draft",
  "active",
  "paused",
  "rejected",
  "completed",
] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export const AUDIENCE_TYPES = [
  "broad",
  "interest",
  "custom_engagement",
  "custom_website",
  "custom_list",
  "lookalike",
] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export const SCALING_MODES = [
  "off",
  "to_cap",
  "indefinite",
] as const;
export type ScalingMode = (typeof SCALING_MODES)[number];

/* ------------------------------------------------------------------ */
/* Meta ad accounts                                                    */
/* ------------------------------------------------------------------ */

export const metaAdAccounts = sqliteTable("meta_ad_accounts", {
  id: text("id").primaryKey(),
  meta_account_id: text("meta_account_id").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("AUD"),
  timezone: text("timezone").notNull().default("Australia/Melbourne"),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  access_token_encrypted: text("access_token_encrypted"),
  pixel_id: text("pixel_id"),
  pixel_installed: integer("pixel_installed", { mode: "boolean" })
    .notNull()
    .default(false),
  created_at_ms: integer("created_at_ms").notNull(),
  updated_at_ms: integer("updated_at_ms").notNull(),
});

/* ------------------------------------------------------------------ */
/* Campaigns — top-level container                                     */
/* ------------------------------------------------------------------ */

export const metaCampaigns = sqliteTable(
  "meta_campaigns",
  {
    id: text("id").primaryKey(),
    meta_campaign_id: text("meta_campaign_id"),

    ad_account_id: text("ad_account_id")
      .notNull()
      .references(() => metaAdAccounts.id),
    company_id: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    objective: text("objective", { enum: CAMPAIGN_OBJECTIVES }).notNull(),
    funnel_stage: text("funnel_stage", { enum: FUNNEL_STAGES }).notNull(),
    status: text("status", { enum: CAMPAIGN_STATUSES })
      .notNull()
      .default("draft"),

    daily_budget_cents: integer("daily_budget_cents").notNull(),
    lifetime_budget_cents: integer("lifetime_budget_cents"),
    total_spent_cents: integer("total_spent_cents").notNull().default(0),

    start_date_ms: integer("start_date_ms"),
    end_date_ms: integer("end_date_ms"),

    scaling_mode: text("scaling_mode", { enum: SCALING_MODES })
      .notNull()
      .default("off"),
    scaling_daily_cap_cents: integer("scaling_daily_cap_cents"),
    scaling_velocity_pct: integer("scaling_velocity_pct").notNull().default(20),
    scaling_roas_floor: real("scaling_roas_floor"),
    human_checkpoint_enabled: integer("human_checkpoint_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    human_checkpoint_spend_cents: integer("human_checkpoint_spend_cents"),

    strategy_notes: text("strategy_notes"),
    ai_strategy_json: text("ai_strategy_json", { mode: "json" }),
    content_pool_tag: text("content_pool_tag"),

    created_by_user_id: text("created_by_user_id").references(() => user.id),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("meta_campaigns_account_idx").on(table.ad_account_id),
    index("meta_campaigns_status_idx").on(table.status),
    index("meta_campaigns_company_idx").on(table.company_id),
  ],
);

/* ------------------------------------------------------------------ */
/* Ad sets — audience + budget allocation within a campaign            */
/* ------------------------------------------------------------------ */

export const metaAdSets = sqliteTable(
  "meta_ad_sets",
  {
    id: text("id").primaryKey(),
    meta_adset_id: text("meta_adset_id"),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => metaCampaigns.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    status: text("status", { enum: AD_SET_STATUSES })
      .notNull()
      .default("draft"),
    funnel_stage: text("funnel_stage", { enum: FUNNEL_STAGES }).notNull(),

    audience_type: text("audience_type", { enum: AUDIENCE_TYPES }).notNull(),
    audience_config_json: text("audience_config_json", { mode: "json" }),
    meta_audience_id: text("meta_audience_id"),

    daily_budget_cents: integer("daily_budget_cents").notNull(),
    bid_strategy: text("bid_strategy", {
      enum: ["lowest_cost", "cost_cap", "bid_cap"],
    })
      .notNull()
      .default("lowest_cost"),
    bid_amount_cents: integer("bid_amount_cents"),

    placements_json: text("placements_json", { mode: "json" }),

    age_min: integer("age_min"),
    age_max: integer("age_max"),
    genders_json: text("genders_json", { mode: "json" }),
    locations_json: text("locations_json", { mode: "json" }),
    interests_json: text("interests_json", { mode: "json" }),

    optimization_goal: text("optimization_goal"),
    primary_metric: text("primary_metric"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("meta_ad_sets_campaign_idx").on(table.campaign_id),
    index("meta_ad_sets_status_idx").on(table.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Ads — individual creative units within an ad set                    */
/* ------------------------------------------------------------------ */

export const metaAds = sqliteTable(
  "meta_ads",
  {
    id: text("id").primaryKey(),
    meta_ad_id: text("meta_ad_id"),
    ad_set_id: text("ad_set_id")
      .notNull()
      .references(() => metaAdSets.id, { onDelete: "cascade" }),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => metaCampaigns.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    status: text("status", { enum: AD_STATUSES }).notNull().default("draft"),

    creative_type: text("creative_type", {
      enum: ["image", "video", "carousel"],
    }).notNull(),
    creative_source: text("creative_source", {
      enum: ["content_studio", "upload"],
    }).notNull(),
    content_studio_post_id: text("content_studio_post_id"),
    asset_url: text("asset_url"),
    thumbnail_url: text("thumbnail_url"),

    headline: text("headline"),
    primary_text: text("primary_text"),
    description: text("description"),
    cta_type: text("cta_type"),
    destination_url: text("destination_url"),

    is_variation: integer("is_variation", { mode: "boolean" })
      .notNull()
      .default(false),
    variation_group: text("variation_group"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("meta_ads_adset_idx").on(table.ad_set_id),
    index("meta_ads_campaign_idx").on(table.campaign_id),
    index("meta_ads_status_idx").on(table.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Campaign metrics snapshots — synced from Meta Insights API          */
/* ------------------------------------------------------------------ */

export const metaCampaignMetrics = sqliteTable(
  "meta_campaign_metrics",
  {
    id: text("id").primaryKey(),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => metaCampaigns.id, { onDelete: "cascade" }),
    ad_set_id: text("ad_set_id").references(() => metaAdSets.id, {
      onDelete: "cascade",
    }),
    ad_id: text("ad_id").references(() => metaAds.id, {
      onDelete: "cascade",
    }),

    date_ms: integer("date_ms").notNull(),
    granularity: text("granularity", { enum: ["daily", "hourly"] })
      .notNull()
      .default("daily"),

    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    link_clicks: integer("link_clicks").notNull().default(0),
    spend_cents: integer("spend_cents").notNull().default(0),

    cpm_cents: integer("cpm_cents"),
    cpc_cents: integer("cpc_cents"),
    ctr_pct: real("ctr_pct"),

    conversions: integer("conversions").notNull().default(0),
    conversion_value_cents: integer("conversion_value_cents")
      .notNull()
      .default(0),
    roas: real("roas"),
    cpa_cents: integer("cpa_cents"),

    video_views: integer("video_views").notNull().default(0),
    video_views_p25: integer("video_views_p25").notNull().default(0),
    video_views_p50: integer("video_views_p50").notNull().default(0),
    video_views_p75: integer("video_views_p75").notNull().default(0),
    video_views_p100: integer("video_views_p100").notNull().default(0),

    engagement_total: integer("engagement_total").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    saves: integer("saves").notNull().default(0),

    leads: integer("leads").notNull().default(0),
    lead_cost_cents: integer("lead_cost_cents"),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("meta_metrics_campaign_idx").on(table.campaign_id),
    index("meta_metrics_date_idx").on(table.date_ms),
    index("meta_metrics_ad_idx").on(table.ad_id),
  ],
);

/* ------------------------------------------------------------------ */
/* Performance benchmarks — what "good" looks like per stage           */
/* ------------------------------------------------------------------ */

export const metaPerformanceBenchmarks = sqliteTable(
  "meta_performance_benchmarks",
  {
    id: text("id").primaryKey(),
    funnel_stage: text("funnel_stage", { enum: FUNNEL_STAGES }).notNull(),
    objective: text("objective", { enum: CAMPAIGN_OBJECTIVES }).notNull(),
    vertical: text("vertical"),

    primary_metric: text("primary_metric").notNull(),
    good_threshold: real("good_threshold").notNull(),
    scale_threshold: real("scale_threshold").notNull(),
    kill_threshold: real("kill_threshold").notNull(),
    metric_unit: text("metric_unit").notNull(),
    metric_direction: text("metric_direction", {
      enum: ["higher_is_better", "lower_is_better"],
    }).notNull(),

    min_data_days: integer("min_data_days").notNull().default(3),
    min_impressions: integer("min_impressions").notNull().default(1000),
    min_conversions: integer("min_conversions"),

    notes: text("notes"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("meta_benchmarks_stage_idx").on(table.funnel_stage, table.objective),
  ],
);

/* ------------------------------------------------------------------ */
/* Optimization log — audit trail of autonomous decisions              */
/* ------------------------------------------------------------------ */

export const metaOptimizationLog = sqliteTable(
  "meta_optimization_log",
  {
    id: text("id").primaryKey(),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => metaCampaigns.id, { onDelete: "cascade" }),
    ad_set_id: text("ad_set_id").references(() => metaAdSets.id),
    ad_id: text("ad_id").references(() => metaAds.id),

    action: text("action", {
      enum: [
        "scale_budget",
        "reduce_budget",
        "pause_ad",
        "pause_adset",
        "pause_campaign",
        "resume",
        "create_lookalike",
        "checkpoint_requested",
        "checkpoint_approved",
        "checkpoint_rejected",
        "report_generated",
      ],
    }).notNull(),

    reason: text("reason").notNull(),
    details_json: text("details_json", { mode: "json" }),

    old_budget_cents: integer("old_budget_cents"),
    new_budget_cents: integer("new_budget_cents"),
    metric_value: real("metric_value"),
    benchmark_threshold: real("benchmark_threshold"),

    applied: integer("applied", { mode: "boolean" }).notNull().default(true),
    requires_approval: integer("requires_approval", { mode: "boolean" })
      .notNull()
      .default(false),
    approved_at_ms: integer("approved_at_ms"),
    approved_by_user_id: text("approved_by_user_id").references(() => user.id),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("meta_opt_log_campaign_idx").on(table.campaign_id),
    index("meta_opt_log_action_idx").on(table.action),
    index("meta_opt_log_created_idx").on(table.created_at_ms),
  ],
);

/* ------------------------------------------------------------------ */
/* Campaign reports — automated daily/weekly summaries                 */
/* ------------------------------------------------------------------ */

export const metaCampaignReports = sqliteTable(
  "meta_campaign_reports",
  {
    id: text("id").primaryKey(),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => metaCampaigns.id, { onDelete: "cascade" }),

    report_type: text("report_type", { enum: ["daily", "weekly", "monthly"] })
      .notNull(),
    period_start_ms: integer("period_start_ms").notNull(),
    period_end_ms: integer("period_end_ms").notNull(),

    summary_json: text("summary_json", { mode: "json" }).notNull(),
    highlights: text("highlights"),
    actions_taken: text("actions_taken"),
    recommendations: text("recommendations"),

    total_spend_cents: integer("total_spend_cents").notNull().default(0),
    total_impressions: integer("total_impressions").notNull().default(0),
    total_clicks: integer("total_clicks").notNull().default(0),
    total_conversions: integer("total_conversions").notNull().default(0),
    period_roas: real("period_roas"),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("meta_reports_campaign_idx").on(table.campaign_id),
    index("meta_reports_type_idx").on(table.report_type),
  ],
);

/* ------------------------------------------------------------------ */
/* Content pool tags — scope audiences to specific content             */
/* ------------------------------------------------------------------ */

export const metaContentPoolTags = sqliteTable(
  "meta_content_pool_tags",
  {
    id: text("id").primaryKey(),
    tag: text("tag").notNull(),
    content_type: text("content_type", {
      enum: ["content_studio_post", "instagram_media", "upload"],
    }).notNull(),
    content_id: text("content_id").notNull(),
    campaign_id: text("campaign_id").references(() => metaCampaigns.id, {
      onDelete: "set null",
    }),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("meta_pool_tags_tag_idx").on(table.tag),
    index("meta_pool_tags_content_idx").on(table.content_id),
  ],
);

/* ------------------------------------------------------------------ */
/* Type exports                                                        */
/* ------------------------------------------------------------------ */

export type MetaAdAccountRow = typeof metaAdAccounts.$inferSelect;
export type MetaCampaignRow = typeof metaCampaigns.$inferSelect;
export type MetaAdSetRow = typeof metaAdSets.$inferSelect;
export type MetaAdRow = typeof metaAds.$inferSelect;
export type MetaCampaignMetricsRow = typeof metaCampaignMetrics.$inferSelect;
export type MetaPerformanceBenchmarkRow = typeof metaPerformanceBenchmarks.$inferSelect;
export type MetaOptimizationLogRow = typeof metaOptimizationLog.$inferSelect;
export type MetaCampaignReportRow = typeof metaCampaignReports.$inferSelect;
