"use server";

import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  recurring_expenses,
  RECURRING_FREQUENCIES,
  type RecurringFrequency,
  type RecurringExpenseRow,
} from "@/lib/db/schema/recurring-expenses";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/db/schema/expenses";
import { logActivity } from "@/lib/activity-log";

type ActionResult = { ok: true } | { ok: false; error: string };

interface CreateRecurringInput {
  vendor: string;
  category: string;
  amount_inc_gst_dollars: number;
  gst_amount_dollars: number | null;
  frequency: string;
  next_fire_date: string;
}

export async function createRecurringExpenseAction(
  input: CreateRecurringInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory)) {
    return { ok: false, error: "Invalid category" };
  }
  if (!RECURRING_FREQUENCIES.includes(input.frequency as RecurringFrequency)) {
    return { ok: false, error: "Invalid frequency" };
  }
  if (!input.vendor.trim()) {
    return { ok: false, error: "Vendor is required" };
  }
  if (input.amount_inc_gst_dollars <= 0) {
    return { ok: false, error: "Amount must be positive" };
  }
  if (!input.next_fire_date) {
    return { ok: false, error: "Next fire date is required" };
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  const amountCents = Math.round(input.amount_inc_gst_dollars * 100);
  const gstCents =
    input.gst_amount_dollars != null
      ? Math.round(input.gst_amount_dollars * 100)
      : null;

  await db.insert(recurring_expenses).values({
    id,
    vendor: input.vendor.trim(),
    category: input.category as ExpenseCategory,
    amount_inc_gst: amountCents,
    gst_amount: gstCents,
    frequency: input.frequency as RecurringFrequency,
    next_fire_date: input.next_fire_date,
    status: "active",
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    kind: "finance_recurring_created",
    body: `Recurring expense created: ${input.vendor.trim()} — $${input.amount_inc_gst_dollars.toFixed(2)} ${input.frequency}.`,
    meta: { recurring_expense_id: id, frequency: input.frequency },
  });

  revalidatePath("/lite/finance/recurring");
  return { ok: true };
}

interface UpdateRecurringInput {
  id: string;
  vendor: string;
  category: string;
  amount_inc_gst_dollars: number;
  gst_amount_dollars: number | null;
  frequency: string;
  next_fire_date: string;
}

export async function updateRecurringExpenseAction(
  input: UpdateRecurringInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory)) {
    return { ok: false, error: "Invalid category" };
  }
  if (!RECURRING_FREQUENCIES.includes(input.frequency as RecurringFrequency)) {
    return { ok: false, error: "Invalid frequency" };
  }
  if (!input.vendor.trim()) {
    return { ok: false, error: "Vendor is required" };
  }
  if (input.amount_inc_gst_dollars <= 0) {
    return { ok: false, error: "Amount must be positive" };
  }

  const existing = await db
    .select()
    .from(recurring_expenses)
    .where(eq(recurring_expenses.id, input.id))
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, error: "Recurring expense not found" };
  }

  const amountCents = Math.round(input.amount_inc_gst_dollars * 100);
  const gstCents =
    input.gst_amount_dollars != null
      ? Math.round(input.gst_amount_dollars * 100)
      : null;

  await db
    .update(recurring_expenses)
    .set({
      vendor: input.vendor.trim(),
      category: input.category as ExpenseCategory,
      amount_inc_gst: amountCents,
      gst_amount: gstCents,
      frequency: input.frequency as RecurringFrequency,
      next_fire_date: input.next_fire_date,
      updated_at_ms: Date.now(),
    })
    .where(eq(recurring_expenses.id, input.id));

  await logActivity({
    kind: "finance_expense_updated",
    body: `Recurring expense updated: ${input.vendor.trim()} — $${input.amount_inc_gst_dollars.toFixed(2)} ${input.frequency}.`,
    meta: { recurring_expense_id: input.id },
  });

  revalidatePath("/lite/finance/recurring");
  return { ok: true };
}

export async function toggleRecurringStatusAction(
  id: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" };
  }

  const existing = await db
    .select()
    .from(recurring_expenses)
    .where(eq(recurring_expenses.id, id))
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, error: "Recurring expense not found" };
  }

  const newStatus = existing[0].status === "active" ? "paused" : "active";

  await db
    .update(recurring_expenses)
    .set({ status: newStatus, updated_at_ms: Date.now() })
    .where(eq(recurring_expenses.id, id));

  await logActivity({
    kind: "finance_recurring_paused",
    body: `Recurring expense ${newStatus}: ${existing[0].vendor}.`,
    meta: { recurring_expense_id: id, new_status: newStatus },
  });

  revalidatePath("/lite/finance/recurring");
  return { ok: true };
}

export async function getRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  return db
    .select()
    .from(recurring_expenses)
    .orderBy(desc(recurring_expenses.created_at_ms));
}
