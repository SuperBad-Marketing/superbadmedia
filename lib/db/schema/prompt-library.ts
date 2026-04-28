import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const PROMPT_CATEGORIES = [
  "cinematic",
  "composite",
  "animated",
  "static",
  "general",
] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const promptLibrary = sqliteTable(
  "prompt_library",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    prompt_text: text("prompt_text").notNull(),
    category: text("category", { enum: PROMPT_CATEGORIES }).notNull(),
    engine: text("engine"),
    tags_json: text("tags_json", { mode: "json" }),
    use_count: integer("use_count").notNull().default(0),
    last_used_at_ms: integer("last_used_at_ms"),
    source_job_id: text("source_job_id"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_category: index("pl_category_idx").on(t.category),
    by_use_count: index("pl_use_count_idx").on(t.use_count),
  }),
);

export type PromptLibraryRow = typeof promptLibrary.$inferSelect;
export type PromptLibraryInsert = typeof promptLibrary.$inferInsert;
