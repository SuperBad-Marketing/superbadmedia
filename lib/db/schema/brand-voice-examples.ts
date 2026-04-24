import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const BRAND_VOICE_SURFACES = ["outreach"] as const;
export type BrandVoiceSurface = (typeof BRAND_VOICE_SURFACES)[number];

export const brand_voice_examples = sqliteTable(
  "brand_voice_examples",
  {
    id: text("id").primaryKey(),
    surface: text("surface").notNull(),
    title: text("title").notNull(),
    body_markdown: text("body_markdown").notNull(),
    sort_order: integer("sort_order").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_surface_order: index("brand_voice_examples_surface_order_idx").on(
      t.surface,
      t.sort_order,
    ),
  }),
);

export type BrandVoiceExampleRow = typeof brand_voice_examples.$inferSelect;
export type BrandVoiceExampleInsert = typeof brand_voice_examples.$inferInsert;
