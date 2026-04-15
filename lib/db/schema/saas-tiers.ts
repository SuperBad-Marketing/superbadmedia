import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { saas_products } from "./saas-products";

/**
 * SaaS tier: a priced offering within a product. `tier_rank` semantics
 * per `project_saas_popcorn_pricing` — 1=small (capture), 2=medium
 * (default), 3=large (revenue lift). Three Stripe Price IDs are
 * populated by `lib/billing/stripe-product-sync.ts` on publish.
 */
export const saas_tiers = sqliteTable(
  "saas_tiers",
  {
    id: text("id").primaryKey(),
    product_id: text("product_id")
      .notNull()
      .references(() => saas_products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tier_rank: integer("tier_rank").notNull(),
    monthly_price_cents_inc_gst: integer("monthly_price_cents_inc_gst").notNull(),
    setup_fee_cents_inc_gst: integer("setup_fee_cents_inc_gst")
      .notNull()
      .default(0),
    feature_flags: text("feature_flags", { mode: "json" }),
    stripe_monthly_price_id: text("stripe_monthly_price_id"),
    stripe_annual_price_id: text("stripe_annual_price_id"),
    stripe_upfront_price_id: text("stripe_upfront_price_id"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_product: index("saas_tiers_product_idx").on(t.product_id, t.tier_rank),
  }),
);

export type SaasTierRow = typeof saas_tiers.$inferSelect;
export type SaasTierInsert = typeof saas_tiers.$inferInsert;
