import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { saas_products } from "./saas-products";

/**
 * A countable dimension (e.g. `api_calls`, `active_campaigns`) that a
 * product enforces tier limits on. Keyed per product so different
 * products can reuse the same `dimension_key` without collision.
 */
export const saas_usage_dimensions = sqliteTable(
  "saas_usage_dimensions",
  {
    id: text("id").primaryKey(),
    product_id: text("product_id")
      .notNull()
      .references(() => saas_products.id, { onDelete: "cascade" }),
    dimension_key: text("dimension_key").notNull(),
    display_name: text("display_name").notNull(),
    display_order: integer("display_order").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_product_key: uniqueIndex("saas_usage_dimensions_product_key_idx").on(
      t.product_id,
      t.dimension_key,
    ),
  }),
);

export type SaasUsageDimensionRow = typeof saas_usage_dimensions.$inferSelect;
export type SaasUsageDimensionInsert =
  typeof saas_usage_dimensions.$inferInsert;
