"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, Pause, Play } from "lucide-react";

import { houseSpring } from "@/lib/design-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RecurringExpenseRow } from "@/lib/db/schema/recurring-expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/db/schema/expenses";
import { RECURRING_FREQUENCIES } from "@/lib/db/schema/recurring-expenses";
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  toggleRecurringStatusAction,
} from "@/lib/finance/recurring-actions";

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

function frequencyLabel(f: string): string {
  switch (f) {
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annual":
      return "Annual";
    default:
      return f;
  }
}

export interface RecurringExpensesClientProps {
  recurring: RecurringExpenseRow[];
}

export function RecurringExpensesClient({
  recurring: initialRecurring,
}: RecurringExpensesClientProps) {
  const prefersReducedMotion = useReducedMotion();
  const spring = prefersReducedMotion ? { duration: 0 } : houseSpring;

  const [recurring, setRecurring] =
    React.useState<RecurringExpenseRow[]>(initialRecurring);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const [vendor, setVendor] = React.useState("");
  const [category, setCategory] = React.useState<string>("software_subscriptions");
  const [amountStr, setAmountStr] = React.useState("");
  const [gstStr, setGstStr] = React.useState("");
  const [frequency, setFrequency] = React.useState<string>("monthly");
  const [nextFireDate, setNextFireDate] = React.useState("");

  function resetForm() {
    setVendor("");
    setCategory("software_subscriptions");
    setAmountStr("");
    setGstStr("");
    setFrequency("monthly");
    setNextFireDate("");
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    const today = new Date().toISOString().slice(0, 10);
    setNextFireDate(today);
    setModalOpen(true);
  }

  function openEdit(row: RecurringExpenseRow) {
    setEditingId(row.id);
    setVendor(row.vendor);
    setCategory(row.category);
    setAmountStr((row.amount_inc_gst / 100).toString());
    setGstStr(row.gst_amount != null ? (row.gst_amount / 100).toString() : "");
    setFrequency(row.frequency);
    setNextFireDate(row.next_fire_date);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const amount = parseFloat(amountStr);
    const gst = gstStr ? parseFloat(gstStr) : null;

    if (editingId) {
      const result = await updateRecurringExpenseAction({
        id: editingId,
        vendor,
        category,
        amount_inc_gst_dollars: amount,
        gst_amount_dollars: gst,
        frequency,
        next_fire_date: nextFireDate,
      });
      if (result.ok) {
        setRecurring((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? {
                  ...r,
                  vendor,
                  category: category as ExpenseCategory,
                  amount_inc_gst: Math.round(amount * 100),
                  gst_amount: gst != null ? Math.round(gst * 100) : null,
                  frequency: frequency as RecurringExpenseRow["frequency"],
                  next_fire_date: nextFireDate,
                  updated_at_ms: Date.now(),
                }
              : r,
          ),
        );
      }
    } else {
      const result = await createRecurringExpenseAction({
        vendor,
        category,
        amount_inc_gst_dollars: amount,
        gst_amount_dollars: gst,
        frequency,
        next_fire_date: nextFireDate,
      });
      if (result.ok) {
        setRecurring((prev) => [
          {
            id: crypto.randomUUID(),
            vendor,
            category: category as ExpenseCategory,
            amount_inc_gst: Math.round(amount * 100),
            gst_amount: gst != null ? Math.round(gst * 100) : null,
            frequency: frequency as RecurringExpenseRow["frequency"],
            next_fire_date: nextFireDate,
            status: "active" as const,
            created_at_ms: Date.now(),
            updated_at_ms: Date.now(),
          },
          ...prev,
        ]);
      }
    }

    setSubmitting(false);
    setModalOpen(false);
    resetForm();
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    const result = await toggleRecurringStatusAction(id);
    if (result.ok) {
      setRecurring((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: r.status === "active" ? ("paused" as const) : ("active" as const),
                updated_at_ms: Date.now(),
              }
            : r,
        ),
      );
    }
    setTogglingId(null);
  }

  return (
    <>
      {recurring.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="bg-muted/40 flex flex-col items-center rounded-xl border border-dashed py-16"
        >
          <p className="text-muted-foreground mb-4 text-sm">
            No recurring expenses declared yet.
          </p>
          <Button onClick={openNew} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add recurring expense
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openNew} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Next fire</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {recurring.map((row) => (
                    <motion.tr
                      key={row.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring}
                      className="hover:bg-muted/30 border-b transition-colors last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{row.vendor}</td>
                      <td className="px-4 py-3">
                        {EXPENSE_CATEGORY_LABELS[row.category as ExpenseCategory] ??
                          row.category}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatAud(row.amount_inc_gst)}
                      </td>
                      <td className="px-4 py-3">
                        {frequencyLabel(row.frequency)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(row.next_fire_date)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            row.status === "active" ? "default" : "secondary"
                          }
                        >
                          {row.status === "active" ? "Active" : "Paused"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={togglingId === row.id}
                            onClick={() => handleToggle(row.id)}
                          >
                            {row.status === "active" ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit recurring expense" : "New recurring expense"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="re-vendor">Vendor</Label>
              <Input
                id="re-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Adobe, Anthropic"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="re-category">Category</Label>
                <Select value={category} onValueChange={(v) => { if (v) setCategory(v); }}>
                  <SelectTrigger id="re-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="re-frequency">Frequency</Label>
                <Select value={frequency} onValueChange={(v) => { if (v) setFrequency(v); }}>
                  <SelectTrigger id="re-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {frequencyLabel(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="re-amount">Amount (AUD inc GST)</Label>
                <Input
                  id="re-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="49.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="re-gst">GST amount (optional)</Label>
                <Input
                  id="re-gst"
                  type="number"
                  step="0.01"
                  min="0"
                  value={gstStr}
                  onChange={(e) => setGstStr(e.target.value)}
                  placeholder="Auto"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="re-next-fire">Next fire date</Label>
              <Input
                id="re-next-fire"
                type="date"
                value={nextFireDate}
                onChange={(e) => setNextFireDate(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Add recurring"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
