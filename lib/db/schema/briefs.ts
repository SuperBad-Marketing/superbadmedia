import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { tasks } from "./tasks";

export const BRIEF_TYPES = ["lean", "structured"] as const;
export type BriefType = (typeof BRIEF_TYPES)[number];

export const BRIEF_STATUSES = [
  "pending",
  "matched",
  "unmatched",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const BRIEF_SOURCES = ["public", "portal", "admin"] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];

export const BRIEF_KINDS = ["shoot", "edit", "shoot_and_edit"] as const;
export type BriefKind = (typeof BRIEF_KINDS)[number];

export const BRIEF_BUDGET_RANGES = [
  "under_1k",
  "1k_3k",
  "3k_5k",
  "5k_10k",
  "10k_plus",
] as const;
export type BriefBudgetRange = (typeof BRIEF_BUDGET_RANGES)[number];

export const BRIEF_MATCH_METHODS = [
  "auto",
  "suggested",
  "manual",
  "portal",
] as const;
export type BriefMatchMethod = (typeof BRIEF_MATCH_METHODS)[number];

export const briefs = sqliteTable(
  "briefs",
  {
    id: text("id").primaryKey(),
    reference_number: text("reference_number").notNull().unique(),
    brief_type: text("brief_type", { enum: BRIEF_TYPES }).notNull(),
    status: text("status", { enum: BRIEF_STATUSES }).notNull().default("pending"),
    source: text("source", { enum: BRIEF_SOURCES }).notNull(),

    business_name: text("business_name").notNull(),
    contact_name: text("contact_name").notNull(),
    contact_email: text("contact_email").notNull(),

    company_id: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    match_confidence: integer("match_confidence"),
    match_method: text("match_method", { enum: BRIEF_MATCH_METHODS }),
    matched_at_ms: integer("matched_at_ms"),
    matched_by: text("matched_by"),

    description: text("description").notNull(),
    delivery_date_ms: integer("delivery_date_ms").notNull(),

    project_title: text("project_title"),
    brief_kind: text("brief_kind", { enum: BRIEF_KINDS }),
    style_references: text("style_references"),
    key_messages: text("key_messages"),
    target_audience: text("target_audience"),
    deliverables_breakdown: text("deliverables_breakdown"),
    location_details: text("location_details"),
    talent_notes: text("talent_notes"),
    budget_range: text("budget_range", { enum: BRIEF_BUDGET_RANGES }),
    additional_notes: text("additional_notes"),
    attachments_json: text("attachments_json", { mode: "json" })
      .$type<Array<{ filename: string; url: string; size_bytes: number }>>()
      .default([]),

    auto_task_id: text("auto_task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company: index("briefs_company_idx").on(t.company_id),
    by_status: index("briefs_status_idx").on(t.status),
    by_delivery: index("briefs_delivery_idx").on(t.delivery_date_ms),
    by_reference: index("briefs_reference_idx").on(t.reference_number),
  }),
);

export const brief_task_links = sqliteTable(
  "brief_task_links",
  {
    id: text("id").primaryKey(),
    brief_id: text("brief_id")
      .notNull()
      .references(() => briefs.id, { onDelete: "cascade" }),
    task_id: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    unique_link: uniqueIndex("brief_task_links_unique_idx").on(
      t.brief_id,
      t.task_id,
    ),
    by_brief: index("brief_task_links_brief_idx").on(t.brief_id),
    by_task: index("brief_task_links_task_idx").on(t.task_id),
  }),
);

export type BriefRow = typeof briefs.$inferSelect;
export type BriefInsert = typeof briefs.$inferInsert;
export type BriefTaskLinkRow = typeof brief_task_links.$inferSelect;
