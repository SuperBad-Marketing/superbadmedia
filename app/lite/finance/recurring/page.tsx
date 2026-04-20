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
  const activeCount = recurring.filter((r) => r.status === "active").length;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Finance ·{" "}
          <a
            href="/lite/finance"
            className="transition-colors duration-150 hover:text-[color:var(--color-brand-cream)]"
          >
            Recurring
          </a>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Recurring Expenses
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Declared costs, booked automatically each period.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {recurring.length === 0
              ? "nothing declared yet."
              : `${activeCount} active, ${recurring.length - activeCount} paused.`}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <a
            href="/lite/finance"
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-150 hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.5px" }}
          >
            ← Back to Finance
          </a>
        </div>
      </header>
      <div className="px-4 pb-10">
        <RecurringExpensesClient recurring={recurring} />
      </div>
    </div>
  );
}
