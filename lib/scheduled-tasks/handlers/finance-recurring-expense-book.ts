import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  recurring_expenses,
  type RecurringExpenseRow,
} from "@/lib/db/schema/recurring-expenses";
import { expenses } from "@/lib/db/schema/expenses";
import { logActivity } from "@/lib/activity-log";

const handleRecurringExpenseBook: TaskHandler = async (_task) => {
  const today = new Date().toISOString().slice(0, 10);

  const dueRecurring = await db
    .select()
    .from(recurring_expenses)
    .where(
      and(
        eq(recurring_expenses.status, "active"),
        lte(recurring_expenses.next_fire_date, today),
      ),
    );

  let booked = 0;

  for (const rec of dueRecurring) {
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(expenses).values({
      id,
      amount_inc_gst: rec.amount_inc_gst,
      gst_amount: rec.gst_amount,
      category: rec.category,
      vendor: rec.vendor,
      description: `Recurring: ${rec.vendor}`,
      expense_date: rec.next_fire_date,
      source: "recurring",
      source_ref: rec.id,
      status: "pending_review",
      manual_override: false,
      receipt_path: null,
      candidate_id: null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    const nextDate = advanceFireDate(
      rec.next_fire_date,
      rec.frequency,
    );

    await db
      .update(recurring_expenses)
      .set({
        next_fire_date: nextDate,
        updated_at_ms: now,
      })
      .where(eq(recurring_expenses.id, rec.id));

    booked++;
  }

  if (booked > 0) {
    await logActivity({
      kind: "finance_recurring_booked",
      body: `Booked ${booked} recurring expense(s) for ${today}.`,
      meta: { date: today, count: booked },
    });
  }
};

function advanceFireDate(
  currentDate: string,
  frequency: RecurringExpenseRow["frequency"],
): string {
  const d = new Date(currentDate + "T00:00:00Z");
  switch (frequency) {
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

export const FINANCE_RECURRING_EXPENSE_BOOK_HANDLERS: HandlerMap = {
  recurring_expense_book: handleRecurringExpenseBook,
};

export { advanceFireDate };
