"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseRow,
} from "@/lib/db/schema/expenses";
import {
  createExpenseAction,
  updateExpenseAction,
} from "@/lib/finance/actions";

interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseRow | null;
  vendorSuggestions?: string[];
}

const GST_RATE = 0.1;

const DEFAULT_GST_CATEGORIES: ExpenseCategory[] = [
  "software_subscriptions",
  "equipment",
  "travel",
  "accountant_legal",
];

function defaultGstForCategory(
  category: ExpenseCategory,
  amountCents: number,
): number | null {
  if (DEFAULT_GST_CATEGORIES.includes(category)) {
    return Math.round(amountCents * (GST_RATE / (1 + GST_RATE)));
  }
  if (category === "api_costs") return null;
  if (category === "payment_processing") return Math.round(amountCents * (GST_RATE / (1 + GST_RATE)));
  return null;
}

function todayString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export function ExpenseModal({
  open,
  onOpenChange,
  expense,
  vendorSuggestions = [],
}: ExpenseModalProps) {
  const isEdit = !!expense;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [amount, setAmount] = React.useState("");
  const [gst, setGst] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory>("other");
  const [vendor, setVendor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [expenseDate, setExpenseDate] = React.useState(todayString());
  const [showProcessingOverride, setShowProcessingOverride] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      if (expense) {
        setAmount((expense.amount_inc_gst / 100).toFixed(2));
        setGst(expense.gst_amount != null ? (expense.gst_amount / 100).toFixed(2) : "");
        setCategory(expense.category);
        setVendor(expense.vendor);
        setDescription(expense.description ?? "");
        setExpenseDate(expense.expense_date);
      } else {
        setAmount("");
        setGst("");
        setCategory("other");
        setVendor("");
        setDescription("");
        setExpenseDate(todayString());
      }
      setError(null);
      setShowProcessingOverride(false);
    }
  }, [open, expense]);

  function handleCategoryChange(val: string) {
    const cat = val as ExpenseCategory;
    setCategory(cat);
    setShowProcessingOverride(false);

    if (!isEdit && amount) {
      const cents = Math.round(parseFloat(amount) * 100);
      const gstDefault = defaultGstForCategory(cat, cents);
      setGst(gstDefault != null ? (gstDefault / 100).toFixed(2) : "");
    }
  }

  function handleAmountBlur() {
    if (!isEdit && amount) {
      const cents = Math.round(parseFloat(amount) * 100);
      const gstDefault = defaultGstForCategory(category, cents);
      if (gstDefault != null && !gst) {
        setGst((gstDefault / 100).toFixed(2));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (category === "payment_processing" && !showProcessingOverride && !isEdit) {
      setShowProcessingOverride(true);
      return;
    }

    setPending(true);
    const amountDollars = parseFloat(amount);
    const gstDollars = gst ? parseFloat(gst) : null;

    const result = isEdit
      ? await updateExpenseAction({
          id: expense!.id,
          amount_inc_gst_dollars: amountDollars,
          gst_amount_dollars: gstDollars,
          category,
          vendor,
          description,
          expense_date: expenseDate,
        })
      : await createExpenseAction({
          amount_inc_gst_dollars: amountDollars,
          gst_amount_dollars: gstDollars,
          category,
          vendor,
          description,
          expense_date: expenseDate,
        });

    setPending(false);
    if (result.ok) {
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this expense entry." : "All amounts in AUD inc. GST."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-amount">Amount (AUD inc. GST)</Label>
              <Input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={handleAmountBlur}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(val) => { if (val) handleCategoryChange(val); }}>
              <SelectTrigger>
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

          {category === "payment_processing" && !isEdit && !showProcessingOverride && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              Stripe fees roll up automatically each day. Type a fee only if
              you&rsquo;re correcting a drift.
            </div>
          )}

          {category === "payment_processing" && showProcessingOverride && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              Manual override active. This entry will be marked so automatic
              rollups won&rsquo;t overwrite it.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-vendor">Vendor</Label>
            <Input
              id="exp-vendor"
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Adobe, Vercel"
              required
              list="vendor-suggestions"
            />
            {vendorSuggestions.length > 0 && (
              <datalist id="vendor-suggestions">
                {vendorSuggestions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-gst">GST amount (AUD)</Label>
            <Input
              id="exp-gst"
              type="number"
              step="0.01"
              min="0"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
              placeholder="Auto-calculated or enter manually"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-desc">Description (optional)</Label>
            <Input
              id="exp-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-liner"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            {category === "payment_processing" && !showProcessingOverride && !isEdit ? (
              <Button type="submit" disabled={pending}>
                I know, let me override
              </Button>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Update" : "Save"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
