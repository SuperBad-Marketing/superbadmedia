import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const AMBIENT_SLOTS = [
  "empty_state",
  "error_page",
  "loading_copy",
  "success_toast",
  "placeholder_text",
  "morning_brief_narrative",
] as const;

export type AmbientSlot = (typeof AMBIENT_SLOTS)[number];

export const ambient_copy_cache = sqliteTable(
  "ambient_copy_cache",
  {
    id: text("id").primaryKey(),
    slot: text("slot", { enum: AMBIENT_SLOTS }).notNull(),
    context_hash: text("context_hash").notNull(),
    generated_text: text("generated_text").notNull(),
    drift_check_score: integer("drift_check_score"),
    generated_at_ms: integer("generated_at_ms").notNull(),
    expires_at_ms: integer("expires_at_ms"),
  },
  (t) => ({
    by_slot_hash: index("acc_slot_hash_idx").on(t.slot, t.context_hash),
  }),
);

export type AmbientCopyCacheRow = typeof ambient_copy_cache.$inferSelect;
export type AmbientCopyCacheInsert = typeof ambient_copy_cache.$inferInsert;
