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

          <div
            className="overflow-hidden rounded-[12px]"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    { label: "Date", align: "left" as const },
                    { label: "Vendor", align: "left" as const },
                    { label: "Category", align: "left" as const },
                    { label: "Amount", align: "right" as const },
                    { label: "GST", align: "right" as const },
                    { label: "Source", align: "left" as const },
                    { label: "Status", align: "left" as const },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{
                        letterSpacing: "2px",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                        textAlign: h.align,
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
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
                      className="cursor-pointer transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{
                        borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                      }}
                      onClick={() => handleEdit(exp)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(253, 245, 230, 0.02)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        className="whitespace-nowrap font-[family-name:var(--font-body)] text-[13px] tabular-nums text-[color:var(--color-neutral-400)]"
                        style={{ padding: "12px 14px" }}
                      >
                        {formatDate(exp.expense_date)}
                      </td>
                      <td
                        className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]"
                        style={{ padding: "12px 14px" }}
                      >
                        {exp.vendor}
                      </td>
                      <td
                        className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]"
                        style={{ padding: "12px 14px" }}
                      >
                        {EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category}
                      </td>
                      <td
                        className="text-right font-[family-name:var(--font-body)] text-[13px] tabular-nums font-medium text-[color:var(--color-brand-cream)]"
                        style={{ padding: "12px 14px" }}
                      >
                        {formatAud(exp.amount_inc_gst)}
                      </td>
                      <td
                        className="text-right font-[family-name:var(--font-body)] text-[13px] tabular-nums text-[color:var(--color-neutral-400)]"
                        style={{ padding: "12px 14px" }}
                      >
                        {exp.gst_amount != null ? formatAud(exp.gst_amount) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Badge variant="secondary" className="text-xs">
                          {sourceLabel(exp.source)}
                        </Badge>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
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
