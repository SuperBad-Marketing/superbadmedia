import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { candidates } from "./candidates";

export const CONTRACTOR_INVOICE_STATUSES = [
  "submitted",
  "approved",
  "paid",
  "rejected",
] as const;
export type ContractorInvoiceStatus =
  (typeof CONTRACTOR_INVOICE_STATUSES)[number];

export const contractor_invoices = sqliteTable(
  "contractor_invoices",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    amount_aud: integer("amount_aud").notNull(),
    reference: text("reference").notNull(),
    pdf_filename: text("pdf_filename"),
    notes: text("notes"),
    status: text("status", { enum: CONTRACTOR_INVOICE_STATUSES })
      .notNull()
      .default("submitted"),
    submitted_at_ms: integer("submitted_at_ms").notNull(),
    reviewed_at_ms: integer("reviewed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_candidate: index("contractor_invoices_candidate_idx").on(t.candidate_id),
    by_status: index("contractor_invoices_status_idx").on(t.status),
  }),
);

export type ContractorInvoiceRow = typeof contractor_invoices.$inferSelect;
export type ContractorInvoiceInsert = typeof contractor_invoices.$inferInsert;
