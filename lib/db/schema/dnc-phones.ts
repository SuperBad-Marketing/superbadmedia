import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const DNC_PHONE_REASONS = [
  "manual_block",
  "stop_reply",
  "complaint",
  "legal_request",
] as const;
export type DncPhoneReason = (typeof DNC_PHONE_REASONS)[number];

export const dnc_phones = sqliteTable("dnc_phones", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  reason: text("reason", { enum: DNC_PHONE_REASONS }).notNull(),
  source_note: text("source_note"),
  added_at_ms: integer("added_at_ms").notNull(),
});

export type DncPhoneRow = typeof dnc_phones.$inferSelect;
export type DncPhoneInsert = typeof dnc_phones.$inferInsert;
