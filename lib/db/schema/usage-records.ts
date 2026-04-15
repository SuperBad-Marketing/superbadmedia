import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { saas_products } from "./saas-products";

/**
 * Append-only log of usage events for a SaaS subscription. Queried by
 * `checkUsageLimit()` (SB-7) to tally against `saas_tier_limits` for
 * the current billing period.
 */
export const usage_records = sqliteTable(
  "usage_records",
  {
    id: text("id").primaryKey(),
    contact_id: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    product_id: text("product_id")
      .notNull()
      .references(() => saas_products.id, { onDelete: "cascade" }),
    dimension_key: text("dimension_key").notNull(),
    billing_period_start_ms: integer("billing_period_start_ms").notNull(),
    recorded_at_ms: integer("recorded_at_ms").notNull(),
  },
  (t) => ({
    by_lookup: index("usage_records_lookup_idx").on(
      t.contact_id,
      t.product_id,
      t.dimension_key,
      t.billing_period_start_ms,
    ),
  }),
);

export type UsageRecordRow = typeof usage_records.$inferSelect;
export type UsageRecordInsert = typeof usage_records.$inferInsert;
