import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const EXPENSE_CATEGORIES = [
  "software_subscriptions",
  "api_costs",
  "payment_processing",
  "ads",
  "contractors",
  "equipment",
  "travel",
  "accountant_legal",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software_subscriptions: "Software subscriptions",
  api_costs: "API costs",
  payment_processing: "Payment processing",
  ads: "Ads",
  contractors: "Contractors",
  equipment: "Equipment",
  travel: "Travel",
  accountant_legal: "Accountant / legal",
  other: "Other",
};

export const EXPENSE_SOURCES = [
  "manual",
  "recurring",
  "observatory_rollup",
  "stripe_fees",
] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const EXPENSE_STATUSES = ["pending_review", "confirmed"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    amount_inc_gst: integer("amount_inc_gst").notNull(),
    gst_amount: integer("gst_amount"),
    category: text("category", { enum: EXPENSE_CATEGORIES }).notNull(),
    vendor: text("vendor").notNull(),
    description: text("description"),
    expense_date: text("expense_date").notNull(),
    source: text("source", { enum: EXPENSE_SOURCES }).notNull().default("manual"),
    source_ref: text("source_ref"),
    status: text("status", { enum: EXPENSE_STATUSES }).notNull().default("confirmed"),
    manual_override: integer("manual_override", { mode: "boolean" }).notNull().default(false),
    receipt_path: text("receipt_path"),
    candidate_id: text("candidate_id"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_date: index("expenses_date_idx").on(t.expense_date),
    by_category_date: index("expenses_category_date_idx").on(t.category, t.expense_date),
    by_source_ref: uniqueIndex("expenses_source_ref_idx").on(t.source, t.source_ref),
  }),
);

export type ExpenseRow = typeof expenses.$inferSelect;
export type ExpenseInsert = typeof expenses.$inferInsert;
