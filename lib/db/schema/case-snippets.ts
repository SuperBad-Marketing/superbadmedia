import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Anonymised proof points auto-drafted from real client milestones.
 * Owner: Lead Generation spec §17.
 * Consumers: outreach draft generator (§8.2).
 */

export const CASE_SNIPPET_MILESTONE_TYPES = [
  "shoot_completion",
  "retainer_90d",
] as const;
export type CaseSnippetMilestoneType =
  (typeof CASE_SNIPPET_MILESTONE_TYPES)[number];

export const CASE_SNIPPET_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type CaseSnippetStatus = (typeof CASE_SNIPPET_STATUSES)[number];

export const caseSnippets = sqliteTable(
  "case_snippets",
  {
    id: text("id").primaryKey(),

    company_id: text("company_id")
      .notNull()
      .references(() => companies.id),
    milestone_type: text("milestone_type", {
      enum: CASE_SNIPPET_MILESTONE_TYPES,
    }).notNull(),
    vertical: text("vertical").notNull(),
    location: text("location"),

    headline: text("headline").notNull(),
    paragraph: text("paragraph").notNull(),
    metrics_line: text("metrics_line"),

    status: text("status", { enum: CASE_SNIPPET_STATUSES })
      .notNull()
      .default("pending"),
    approved_at: integer("approved_at", { mode: "timestamp_ms" }),
    auto_approved: integer("auto_approved", { mode: "boolean" })
      .notNull()
      .default(false),

    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    by_status_vertical: index("case_snippets_status_vertical_idx").on(
      t.status,
      t.vertical,
      t.created_at,
    ),
    by_company: index("case_snippets_company_idx").on(t.company_id),
  }),
);

export type CaseSnippetRow = typeof caseSnippets.$inferSelect;
export type CaseSnippetInsert = typeof caseSnippets.$inferInsert;
