import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sfxLibrary = sqliteTable("sfx_library", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  file_url: text("file_url").notNull(),
  color: text("color").notNull().default("#9B51E0"),
  cloudinary_public_id: text("cloudinary_public_id"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type SfxLibraryRow = typeof sfxLibrary.$inferSelect;
export type SfxLibraryInsert = typeof sfxLibrary.$inferInsert;
