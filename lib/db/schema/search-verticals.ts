import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const searchVerticals = sqliteTable(
  "search_verticals",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull(),
    location_lat: real("location_lat").notNull(),
    location_lng: real("location_lng").notNull(),
    radius_km: integer("radius_km").notNull(),
    country_code: text("country_code").notNull().default("AU"),
    standing_brief: text("standing_brief"),

    weight: integer("weight").notNull().default(5),
    is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),

    last_searched_at: integer("last_searched_at", { mode: "timestamp_ms" }),
    search_count: integer("search_count").notNull().default(0),

    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    by_active_searched: index("search_verticals_active_searched_idx").on(
      t.is_active,
      t.last_searched_at,
    ),
  }),
);

export type SearchVerticalRow = typeof searchVerticals.$inferSelect;
export type SearchVerticalInsert = typeof searchVerticals.$inferInsert;
