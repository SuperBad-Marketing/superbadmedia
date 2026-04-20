import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "./expenses";

export const RECURRING_FREQUENCIES = [
  "monthly",
  "quarterly",
  "annual",
] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_STATUSES = ["active", "paused"] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

export const recurring_expenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey(),
  vendor: text("vendor").notNull(),
  category: text("category", { enum: EXPENSE_CATEGORIES }).notNull(),
  amount_inc_gst: integer("amount_inc_gst").notNull(),
  gst_amount: integer("gst_amount"),
  frequency: text("frequency", { enum: RECURRING_FREQUENCIES }).notNull(),
  next_fire_date: text("next_fire_date").notNull(),
  status: text("status", { enum: RECURRING_STATUSES }).notNull().default("active"),
  created_at_ms: integer("created_at_ms").notNull(),
  updated_at_ms: integer("updated_at_ms").notNull(),
});

export type RecurringExpenseRow = typeof recurring_expenses.$inferSelect;
export type RecurringExpenseInsert = typeof recurring_expenses.$inferInsert;
