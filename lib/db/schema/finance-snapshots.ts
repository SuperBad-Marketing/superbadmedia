import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const finance_snapshots = sqliteTable("finance_snapshots", {
  snapshot_date: text("snapshot_date").primaryKey(),
  metrics_json: text("metrics_json", { mode: "json" }),
  projection_json: text("projection_json", { mode: "json" }),
  narrative_text: text("narrative_text"),
  narrative_generated_at_ms: integer("narrative_generated_at_ms"),
  narrative_callouts: text("narrative_callouts", { mode: "json" }),
  stale_flags: text("stale_flags", { mode: "json" }),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type FinanceSnapshotRow = typeof finance_snapshots.$inferSelect;
export type FinanceSnapshotInsert = typeof finance_snapshots.$inferInsert;

export interface FinanceMetrics {
  revenue_mtd_cents: number;
  expenses_mtd_cents: number;
  net_cents: number;
  mrr_cents: number;
  outstanding_invoices_cents: number;
  gst_owed_cents: number;
  income_tax_provisioned_cents: number;
  yours_to_spend_cents: number;
  stripe_balance_cents: number;
}

export interface FinanceProjection {
  contracted_curve: Array<{ date: string; cents: number }>;
  pipeline_weighted_curve: Array<{ date: string; cents: number }>;
  decay_adjusted_curve: Array<{ date: string; cents: number }>;
}
