import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Reusable skeletons for Quote Builder drafts. Andy saves a completed
 * quote as a template via "Save as template" in the QB-2 editor.
 * `default_line_items_json` stores an array of `{ catalogue_item_id, qty,
 * override_price_cents_inc_gst }` references — catalogue content is
 * snapshotted per-quote at send time (see `quotes.catalogue_snapshot_json`).
 */
export const QUOTE_TEMPLATE_STRUCTURES = [
  "retainer",
  "project",
  "mixed",
] as const;
export type QuoteTemplateStructure = (typeof QUOTE_TEMPLATE_STRUCTURES)[number];

export const quote_templates = sqliteTable(
  "quote_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    structure: text("structure", { enum: QUOTE_TEMPLATE_STRUCTURES }).notNull(),
    term_length_months: integer("term_length_months"),
    default_sections_json: text("default_sections_json", { mode: "json" }),
    default_line_items_json: text("default_line_items_json", { mode: "json" }),
    usage_count: integer("usage_count").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    deleted_at_ms: integer("deleted_at_ms"),
  },
  (t) => ({
    by_structure: index("quote_templates_structure_idx").on(t.structure),
  }),
);

export type QuoteTemplateRow = typeof quote_templates.$inferSelect;
export type QuoteTemplateInsert = typeof quote_templates.$inferInsert;
