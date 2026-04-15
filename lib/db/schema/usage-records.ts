import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { saas_products } from "./saas-products";

/**
 * Append-only log of usage events for a SaaS subscription. Queried by
 * `checkUsageLimit()` (SB-7) to tally against `saas_tier_limits` for
 * the current billing period.
 *
 * `amount` lets a single event cost more than one unit (e.g. a
 * multi-record batch). `idempotency_key` makes `recordUsage()` safe to
 * retry — the unique partial index rejects duplicate keys while leaving
 * keyless rows (legacy or non-idempotent call-sites) alone.
 * `billing_period_end_ms` pins the period boundary at write time so
 * queries don't have to re-derive it from the deal's anchor.
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
    amount: integer("amount").notNull().default(1),
    idempotency_key: text("idempotency_key"),
    billing_period_start_ms: integer("billing_period_start_ms").notNull(),
    billing_period_end_ms: integer("billing_period_end_ms"),
    recorded_at_ms: integer("recorded_at_ms").notNull(),
  },
  (t) => ({
    by_lookup: index("usage_records_lookup_idx").on(
      t.contact_id,
      t.product_id,
      t.dimension_key,
      t.billing_period_start_ms,
    ),
    by_idempotency_key: uniqueIndex("usage_records_idempotency_key_idx").on(
      t.idempotency_key,
    ),
  }),
);

export type UsageRecordRow = typeof usage_records.$inferSelect;
export type UsageRecordInsert = typeof usage_records.$inferInsert;
