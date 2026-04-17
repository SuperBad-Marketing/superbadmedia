import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

/**
 * Content Engine — topic queue (CE-1). Each row is a keyword-researched
 * topic candidate. Status lifecycle: `queued` → `generating` → `generated`
 * (or `vetoed` / `skipped`). Engine selects from the top un-vetoed topic.
 *
 * Hiring Pipeline claimable columns (spec §14.0) allow trial-task
 * assignment via `claimInternalContentItem()` / `releaseContentItem()`.
 * Atomicity via `UPDATE ... WHERE claimed_by IS NULL`.
 */
export const CONTENT_TOPIC_STATUSES = [
  "queued",
  "vetoed",
  "generating",
  "generated",
  "skipped",
] as const;
export type ContentTopicStatus = (typeof CONTENT_TOPIC_STATUSES)[number];

export const contentTopics = sqliteTable(
  "content_topics",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    rankability_score: integer("rankability_score"),
    content_gaps: text("content_gaps", { mode: "json" }),
    outline: text("outline", { mode: "json" }),
    serp_snapshot: text("serp_snapshot", { mode: "json" }),
    status: text("status", { enum: CONTENT_TOPIC_STATUSES })
      .notNull()
      .default("queued"),
    vetoed_at_ms: integer("vetoed_at_ms"),

    // Hiring Pipeline claimable columns (§14.0)
    claimed_by: text("claimed_by"),
    claimed_at_ms: integer("claimed_at_ms"),
    claim_budget_cap_aud: integer("claim_budget_cap_aud"),
    claim_released_at_ms: integer("claim_released_at_ms"),
    claim_released_reason: text("claim_released_reason"),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_company_status: index("content_topics_company_status_idx").on(
      t.company_id,
      t.status,
    ),
    by_status: index("content_topics_status_idx").on(t.status),
  }),
);

export type ContentTopicRow = typeof contentTopics.$inferSelect;
export type ContentTopicInsert = typeof contentTopics.$inferInsert;
