import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { getRecurringExpenses } from "@/lib/finance/recurring-actions";
import { RecurringExpensesClient } from "@/components/lite/finance/recurring-expenses-client";

export const metadata: Metadata = {
  title: "SuperBad — Recurring Expenses",
  robots: { index: false, follow: false },
};

export default async function RecurringExpensesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const recurring = await getRecurringExpenses();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Recurring Expenses
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Declared recurring costs booked automatically each period.
          </p>
        </div>
        <a
          href="/lite/finance"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors"
        >
          Back to Finance
        </a>
      </div>

      <RecurringExpensesClient recurring={recurring} />
    </div>
  );
}
