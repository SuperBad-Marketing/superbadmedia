import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { deals } from "./deals";
import { quotes } from "./quotes";

/**
 * Branded Invoicing — invoice row (BI-1). State machine enforced via
 * `lib/invoicing/transitions.ts#transitionInvoiceStatus()`; direct
 * mutation of `status` outside that helper is a bug.
 *
 * All monetary columns are integer cents. `total_cents_inc_gst` is the
 * canonical total. `total_cents_ex_gst` + `gst_cents` are derived at
 * generation time and snapshot the company's GST applicability via the
 * boolean `gst_applicable`.
 *
 * Invoice number format `SB-INV-YYYY-NNNN` — year-scoped sequence in
 * `sequences` table, allocated by `lib/invoicing/sequences.ts`.
 */
export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "overdue",
  "paid",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_PAID_VIA = ["bank_transfer", "stripe"] as const;
export type InvoicePaidVia = (typeof INVOICE_PAID_VIA)[number];

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_cents_inc_gst: number;
  line_total_cents_inc_gst: number;
  is_recurring: boolean;
}

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    invoice_number: text("invoice_number").notNull().unique(),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    quote_id: text("quote_id").references(() => quotes.id, {
      onDelete: "set null",
    }),
    token: text("token").notNull().unique(),
    status: text("status", { enum: INVOICE_STATUSES })
      .notNull()
      .default("draft"),

    // billing cycle (null for manual non-cycle invoices)
    cycle_index: integer("cycle_index"),
    cycle_start_ms: integer("cycle_start_ms"),
    cycle_end_ms: integer("cycle_end_ms"),

    // dates (ms)
    issue_date_ms: integer("issue_date_ms").notNull(),
    due_at_ms: integer("due_at_ms").notNull(),
    paid_at_ms: integer("paid_at_ms"),
    paid_via: text("paid_via", { enum: INVOICE_PAID_VIA }),
    stripe_payment_intent_id: text("stripe_payment_intent_id"),

    // totals (integer cents)
    total_cents_inc_gst: integer("total_cents_inc_gst").notNull(),
    total_cents_ex_gst: integer("total_cents_ex_gst").notNull(),
    gst_cents: integer("gst_cents").notNull(),
    gst_applicable: integer("gst_applicable", { mode: "boolean" }).notNull(),

    // content
    line_items_json: text("line_items_json", { mode: "json" }).notNull(),
    scope_summary: text("scope_summary"),

    // supersede (self-ref; FK wired via raw SQL migration to dodge Drizzle
    // forward-reference)
    supersedes_invoice_id: text("supersedes_invoice_id"),

    // email threading + reminders
    thread_message_id: text("thread_message_id"),
    reminder_count: integer("reminder_count").notNull().default(0),
    last_reminder_at_ms: integer("last_reminder_at_ms"),

    // review window (auto invoices only)
    auto_send_at_ms: integer("auto_send_at_ms"),

    // audit
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company_status: index("invoices_company_status_idx").on(
      t.company_id,
      t.status,
    ),
    by_status: index("invoices_status_idx").on(t.status),
    by_due: index("invoices_due_idx").on(t.due_at_ms, t.status),
    by_deal: index("invoices_deal_idx").on(t.deal_id),
  }),
);

export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;
