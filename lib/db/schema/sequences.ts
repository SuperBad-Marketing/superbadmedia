import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Atomic counter store. One row per monotonically-increasing number
 * series (`quote_number`, later `invoice_number`). Allocation helpers
 * live per-feature (e.g. `lib/quote-builder/sequences.ts`) so format
 * concerns (`SB-YYYY-NNNN`) stay out of the schema.
 *
 * Allocation is serialised by a SQL transaction that reads the current
 * value, increments, and writes back — see `allocateQuoteNumber()`.
 */
export const sequences = sqliteTable("sequences", {
  name: text("name").primaryKey(),
  current_value: integer("current_value").notNull().default(0),
});

export type SequenceRow = typeof sequences.$inferSelect;
