import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const FINANCE_EXPORT_STATUSES = [
  "pending",
  "generating",
  "ready",
  "failed",
  "purged",
] as const;
export type FinanceExportStatus = (typeof FINANCE_EXPORT_STATUSES)[number];

export const finance_exports = sqliteTable("finance_exports", {
  id: text("id").primaryKey(),
  period_start: text("period_start").notNull(),
  period_end: text("period_end").notNull(),
  period_label: text("period_label").notNull(),
  status: text("status", { enum: FINANCE_EXPORT_STATUSES })
    .notNull()
    .default("pending"),
  file_path: text("file_path"),
  filename: text("filename"),
  file_size_bytes: integer("file_size_bytes"),
  error_message: text("error_message"),
  requested_at_ms: integer("requested_at_ms").notNull(),
  completed_at_ms: integer("completed_at_ms"),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type FinanceExportRow = typeof finance_exports.$inferSelect;
export type FinanceExportInsert = typeof finance_exports.$inferInsert;
