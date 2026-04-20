"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, desc, and, gte, lte } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  expenses,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseRow,
} from "@/lib/db/schema/expenses";
import { logActivity } from "@/lib/activity-log";

type ActionResult = { ok: true } | { ok: false; error: string };

interface CreateExpenseInput {
  amount_inc_gst_dollars: number;
  gst_amount_dollars: number | null;
  category: string;
  vendor: string;
  description: string;
  expense_date: string;
}

export async function createExpenseAction(
  input: CreateExpenseInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory)) {
    return { ok: false, error: "Invalid category" };
  }
  if (!input.vendor.trim()) {
    return { ok: false, error: "Vendor is required" };
  }
  if (input.amount_inc_gst_dollars <= 0) {
    return { ok: false, error: "Amount must be positive" };
  }
  if (!input.expense_date) {
    return { ok: false, error: "Date is required" };
  }

  const now = Date.now();
  const id = randomUUID();
  const amountCents = Math.round(input.amount_inc_gst_dollars * 100);
  const gstCents =
    input.gst_amount_dollars != null
      ? Math.round(input.gst_amount_dollars * 100)
      : null;

  await db.insert(expenses).values({
    id,
    amount_inc_gst: amountCents,
    gst_amount: gstCents,
    category: input.category as ExpenseCategory,
    vendor: input.vendor.trim(),
    description: input.description.trim() || null,
    expense_date: input.expense_date,
    source: "manual",
    source_ref: null,
    status: "confirmed",
    manual_override: false,
    receipt_path: null,
    candidate_id: null,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    kind: "finance_expense_created",
    body: `Manual expense: ${input.vendor.trim()} — $${input.amount_inc_gst_dollars.toFixed(2)}`,
    meta: { expense_id: id, category: input.category },
  });

  revalidatePath("/lite/finance");
  return { ok: true };
}

interface UpdateExpenseInput {
  id: string;
  amount_inc_gst_dollars: number;
  gst_amount_dollars: number | null;
  category: string;
  vendor: string;
  description: string;
  expense_date: string;
}

export async function updateExpenseAction(
  input: UpdateExpenseInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory)) {
    return { ok: false, error: "Invalid category" };
  }
  if (!input.vendor.trim()) {
    return { ok: false, error: "Vendor is required" };
  }
  if (input.amount_inc_gst_dollars <= 0) {
    return { ok: false, error: "Amount must be positive" };
  }

  const amountCents = Math.round(input.amount_inc_gst_dollars * 100);
  const gstCents =
    input.gst_amount_dollars != null
      ? Math.round(input.gst_amount_dollars * 100)
      : null;

  const existing = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, input.id))
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, error: "Expense not found" };
  }

  const isRollup =
    existing[0].source === "observatory_rollup" ||
    existing[0].source === "stripe_fees";

  await db
    .update(expenses)
    .set({
      amount_inc_gst: amountCents,
      gst_amount: gstCents,
      category: input.category as ExpenseCategory,
      vendor: input.vendor.trim(),
      description: input.description.trim() || null,
      expense_date: input.expense_date,
      manual_override: isRollup ? true : existing[0].manual_override,
      updated_at_ms: Date.now(),
    })
    .where(eq(expenses.id, input.id));

  await logActivity({
    kind: "finance_expense_updated",
    body: `Expense updated: ${input.vendor.trim()} — $${input.amount_inc_gst_dollars.toFixed(2)}`,
    meta: { expense_id: input.id, category: input.category },
  });

  revalidatePath("/lite/finance");
  return { ok: true };
}

export async function confirmExpenseAction(
  id: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  const existing = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, error: "Expense not found" };
  }
  if (existing[0].status !== "pending_review") {
    return { ok: false, error: "Expense is not pending review" };
  }

  await db
    .update(expenses)
    .set({ status: "confirmed", updated_at_ms: Date.now() })
    .where(eq(expenses.id, id));

  await logActivity({
    kind: "finance_expense_confirmed",
    body: `Expense confirmed: ${existing[0].vendor} — $${(existing[0].amount_inc_gst / 100).toFixed(2)}`,
    meta: { expense_id: id },
  });

  revalidatePath("/lite/finance");
  return { ok: true };
}

export async function bulkConfirmExpensesAction(
  ids: string[],
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  for (const id of ids) {
    await db
      .update(expenses)
      .set({ status: "confirmed", updated_at_ms: Date.now() })
      .where(
        and(eq(expenses.id, id), eq(expenses.status, "pending_review")),
      );
  }

  await logActivity({
    kind: "finance_expense_confirmed",
    body: `Bulk confirmed ${ids.length} expense(s)`,
    meta: { expense_ids: ids },
  });

  revalidatePath("/lite/finance");
  return { ok: true };
}

export async function getRecentExpenses(limit = 20): Promise<ExpenseRow[]> {
  return db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expense_date), desc(expenses.created_at_ms))
    .limit(limit);
}

export async function getExpensesByDateRange(
  startDate: string,
  endDate: string,
): Promise<ExpenseRow[]> {
  return db
    .select()
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, startDate),
        lte(expenses.expense_date, endDate),
      ),
    )
    .orderBy(desc(expenses.expense_date));
}

export async function getVendorSuggestions(): Promise<string[]> {
  const rows = await db
    .select({ vendor: expenses.vendor })
    .from(expenses)
    .groupBy(expenses.vendor)
    .orderBy(expenses.vendor);
  return rows.map((r) => r.vendor);
}
