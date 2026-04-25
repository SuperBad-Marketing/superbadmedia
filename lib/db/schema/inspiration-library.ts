import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const SOURCE_TYPES = ["link", "upload"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const inspirationLibrary = sqliteTable("inspiration_library", {
  id: text("id").primaryKey(),
  source_type: text("source_type", { enum: SOURCE_TYPES }).notNull(),
  source_url: text("source_url").notNull(),
  thumbnail_url: text("thumbnail_url"),
  title: text("title"),
  description: text("description"),
  tags: text("tags"),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type InspirationLibraryRow = typeof inspirationLibrary.$inferSelect;
export type InspirationLibraryInsert = typeof inspirationLibrary.$inferInsert;
