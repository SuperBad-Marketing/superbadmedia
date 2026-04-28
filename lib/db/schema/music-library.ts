import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const MUSIC_MOODS = [
  "warm",
  "bold",
  "minimal",
  "dark",
  "upbeat",
  "cinematic",
  "ambient",
] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export const musicLibrary = sqliteTable(
  "music_library",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    artist: text("artist"),
    file_url: text("file_url").notNull(),
    cloudinary_public_id: text("cloudinary_public_id"),
    duration_sec: integer("duration_sec"),
    bpm: integer("bpm"),
    mood: text("mood", { enum: MUSIC_MOODS }),
    tags_json: text("tags_json", { mode: "json" }),
    use_count: integer("use_count").notNull().default(0),
    sort_order: integer("sort_order").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_mood: index("ml_mood_idx").on(t.mood),
    by_use: index("ml_use_idx").on(t.use_count),
  }),
);

export type MusicLibraryRow = typeof musicLibrary.$inferSelect;
export type MusicLibraryInsert = typeof musicLibrary.$inferInsert;
