import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const LLM_CALL_TYPES = [
  "summary_regeneration",
  "action_item_extraction",
  "draft_generation",
  "draft_nudge",
  "draft_reformat",
] as const;
export type LlmCallType = (typeof LLM_CALL_TYPES)[number];

export const llm_usage_log = sqliteTable(
  "llm_usage_log",
  {
    id: text("id").primaryKey(),
    call_type: text("call_type", { enum: LLM_CALL_TYPES }).notNull(),
    contact_id: text("contact_id"),
    model: text("model").notNull(),
    input_tokens: integer("input_tokens").notNull(),
    output_tokens: integer("output_tokens").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_type: index("llm_usage_log_type_idx").on(t.call_type, t.created_at_ms),
    by_contact: index("llm_usage_log_contact_idx").on(t.contact_id),
  }),
);

export type LlmUsageLogRow = typeof llm_usage_log.$inferSelect;
export type LlmUsageLogInsert = typeof llm_usage_log.$inferInsert;
