"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";

import { houseSpring } from "@/lib/design-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExpenseRow } from "@/lib/db/schema/expenses";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/db/schema/expenses";
import { ExpenseModal } from "./expense-modal";

function formatAud(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sourceLabel(source: string): string {
  switch (source) {
    case "manual":
      return "Manual";
    case "recurring":
      return "Recurring";
    case "observatory_rollup":
      return "API rollup";
    case "stripe_fees":
      return "Stripe fees";
    default:
      return source;
  }
}

export interface FinanceDashboardClientProps {
  expenses: ExpenseRow[];
  vendorSuggestions: string[];
  pendingReviewCount: number;
  hasStripeConnection: boolean;
}

export function FinanceDashboardClient({
  expenses,
  vendorSuggestions,
  pendingReviewCount,
  hasStripeConnection,
}: FinanceDashboardClientProps) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<ExpenseRow | null>(null);
  const reducedMotion = useReducedMotion();

  function handleEdit(expense: ExpenseRow) {
    setEditingExpense(expense);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingExpense(null);
    setModalOpen(true);
  }

  return (
    <>
      {expenses.length > 0 && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
        >
          {pendingReviewCount > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm">
              <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                {pendingReviewCount}
              </Badge>
              <span>
                {pendingReviewCount === 1 ? "expense" : "expenses"} pending review
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Vendor</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">GST</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {expenses.map((exp) => (
                    <motion.tr
                      key={exp.id}
                      layout
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                      onClick={() => handleEdit(exp)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(exp.expense_date)}
                      </td>
                      <td className="px-3 py-2">{exp.vendor}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatAud(exp.amount_inc_gst)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {exp.gst_amount != null ? formatAud(exp.gst_amount) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-xs">
                          {sourceLabel(exp.source)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {exp.status === "pending_review" ? (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 text-xs">
                            Review
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Confirmed
                          </Badge>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* FAB — persistent quick-add */}
      <motion.button
        type="button"
        onClick={handleAdd}
        aria-label="Add expense"
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        whileHover={reducedMotion ? {} : { scale: 1.08 }}
        whileTap={reducedMotion ? {} : { scale: 0.95 }}
        transition={houseSpring}
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <ExpenseModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingExpense(null);
        }}
        expense={editingExpense}
        vendorSuggestions={vendorSuggestions}
      />
    </>
  );
}
