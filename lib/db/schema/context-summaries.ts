import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { contacts } from "./contacts";

export const context_summaries = sqliteTable(
  "context_summaries",
  {
    id: text("id").primaryKey(),
    contact_id: text("contact_id")
      .notNull()
      .unique()
      .references(() => contacts.id, { onDelete: "cascade" }),
    conversation_summary: text("conversation_summary"),
    summary_generated_at_ms: integer("summary_generated_at_ms"),
    draft_content: text("draft_content"),
    draft_channel: text("draft_channel"),
    draft_nudge_history: text("draft_nudge_history", { mode: "json" })
      .$type<string[]>(),
    draft_generated_at_ms: integer("draft_generated_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_contact: index("context_summaries_contact_idx").on(t.contact_id),
  }),
);

export type ContextSummaryRow = typeof context_summaries.$inferSelect;
export type ContextSummaryInsert = typeof context_summaries.$inferInsert;
