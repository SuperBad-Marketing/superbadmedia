import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Catalogue of priced deliverables referenced by Quote Builder drafts.
 * Categories, units and seed rows are authored in the Quote Builder content
 * mini-session (spec §12.1). Schema is locked here (QB-1); pricing behaviour
 * ("snapshot-on-add" into `quotes.catalogue_snapshot_json`) lives in the
 * QB-2 editor.
 */
export const CATALOGUE_ITEM_UNITS = [
  "hour",
  "day",
  "project",
  "month",
  "piece",
] as const;
export type CatalogueItemUnit = (typeof CATALOGUE_ITEM_UNITS)[number];

export const catalogue_items = sqliteTable(
  "catalogue_items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unit: text("unit", { enum: CATALOGUE_ITEM_UNITS }).notNull(),
    base_price_cents_inc_gst: integer("base_price_cents_inc_gst").notNull(),
    tier_rank: integer("tier_rank"),
    description: text("description"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    deleted_at_ms: integer("deleted_at_ms"),
  },
  (t) => ({
    by_category: index("catalogue_items_category_idx").on(t.category),
    by_tier_rank: index("catalogue_items_tier_rank_idx").on(t.tier_rank),
  }),
);

export type CatalogueItemRow = typeof catalogue_items.$inferSelect;
export type CatalogueItemInsert = typeof catalogue_items.$inferInsert;
