import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const SUGGESTION_TYPES = ["add", "update", "remove", "mismatch"] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export const SUGGESTION_SOURCES = [
  "braindump",
  "deal_won",
  "pricing_change",
  "case_study_published",
  "content_milestone",
  "manual",
] as const;
export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];

export const SUGGESTION_STATUSES = [
  "pending",
  "approved",
  "dismissed",
  "expired",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const business_profile_suggestions = sqliteTable(
  "business_profile_suggestions",
  {
    id: text("id").primaryKey(),
    section_key: text("section_key").notNull(),
    field_path: text("field_path"),
    suggestion_type: text("suggestion_type", {
      enum: SUGGESTION_TYPES,
    }).notNull(),
    source: text("source", { enum: SUGGESTION_SOURCES }).notNull(),
    source_entity_id: text("source_entity_id"),
    title: text("title").notNull(),
    detail: text("detail", { mode: "json" }).notNull(),
    status: text("status", { enum: SUGGESTION_STATUSES })
      .notNull()
      .default("pending"),
    surfaced_in_brief: integer("surfaced_in_brief", { mode: "boolean" })
      .notNull()
      .default(false),
    created_at_ms: integer("created_at_ms").notNull(),
    resolved_at_ms: integer("resolved_at_ms"),
  },
  (t) => ({
    by_status_created: index("bps_sugg_status_created_idx").on(
      t.status,
      t.created_at_ms,
    ),
  }),
);

export type BusinessProfileSuggestionRow =
  typeof business_profile_suggestions.$inferSelect;
