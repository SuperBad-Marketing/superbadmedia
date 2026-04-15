import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * SaaS product catalogue row. One row per Lite SaaS product; tiers + usage
 * dimensions hang off it. Locked by SB-1 per spec §11.1.
 */
export const SAAS_PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type SaasProductStatus = (typeof SAAS_PRODUCT_STATUSES)[number];

export const saas_products = sqliteTable(
  "saas_products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull().unique(),
    status: text("status", { enum: SAAS_PRODUCT_STATUSES })
      .notNull()
      .default("draft"),
    demo_enabled: integer("demo_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    demo_config: text("demo_config", { mode: "json" }),
    menu_config: text("menu_config", { mode: "json" }),
    product_config_schema: text("product_config_schema", { mode: "json" }),
    stripe_product_id: text("stripe_product_id"),
    display_order: integer("display_order").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_status: index("saas_products_status_idx").on(t.status, t.display_order),
  }),
);

export type SaasProductRow = typeof saas_products.$inferSelect;
export type SaasProductInsert = typeof saas_products.$inferInsert;
