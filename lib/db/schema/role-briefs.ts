import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const ROLE_BRIEF_STATUSES = [
  "draft",
  "open",
  "paused",
  "filled",
] as const;
export type RoleBriefStatus = (typeof ROLE_BRIEF_STATUSES)[number];

export const ROLE_BRIEF_ENGAGEMENT_TYPES = [
  "contractor",
  "employee",
] as const;
export type RoleBriefEngagementType =
  (typeof ROLE_BRIEF_ENGAGEMENT_TYPES)[number];

export const RATE_UNITS = ["per_hour", "per_day", "per_project"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

export const role_briefs = sqliteTable(
  "role_briefs",
  {
    id: text("id").primaryKey(),
    role_name: text("role_name").notNull(),
    engagement_type: text("engagement_type", {
      enum: ROLE_BRIEF_ENGAGEMENT_TYPES,
    })
      .notNull()
      .default("contractor"),
    status: text("status", { enum: ROLE_BRIEF_STATUSES })
      .notNull()
      .default("draft"),

    rate_min_aud: integer("rate_min_aud"),
    rate_max_aud: integer("rate_max_aud"),
    rate_unit: text("rate_unit", { enum: RATE_UNITS }),
    target_hours_per_week: integer("target_hours_per_week"),
    location_pref_city: text("location_pref_city"),
    remote_ok: integer("remote_ok", { mode: "boolean" })
      .notNull()
      .default(true),
    open_count: integer("open_count").notNull().default(1),

    reference_urls_json: text("reference_urls_json", { mode: "json" }),
    reference_signals_json: text("reference_signals_json", { mode: "json" }),
    style_summary: text("style_summary"),
    extracted_tags_json: text("extracted_tags_json", { mode: "json" }),
    style_do_list_json: text("style_do_list_json", { mode: "json" }),
    style_avoid_list_json: text("style_avoid_list_json", { mode: "json" }),
    discovery_search_hints_json: text("discovery_search_hints_json", {
      mode: "json",
    }),
    andy_overrides: text("andy_overrides"),

    last_regenerated_at_ms: integer("last_regenerated_at_ms"),
    last_discovery_run_at_ms: integer("last_discovery_run_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_status: index("role_briefs_status_idx").on(t.status),
    by_engagement: index("role_briefs_engagement_type_idx").on(
      t.engagement_type,
    ),
  }),
);

export type RoleBriefRow = typeof role_briefs.$inferSelect;
export type RoleBriefInsert = typeof role_briefs.$inferInsert;
