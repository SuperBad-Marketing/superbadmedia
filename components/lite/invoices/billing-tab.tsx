"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  InvoiceIndexClient,
  type InvoiceIndexRow,
} from "./invoice-index-client";
import type { InvoiceDetail } from "@/lib/invoicing/detail-query";
import {
  createManualInvoiceAction,
  updateCompanyPaymentTermsAction,
  updateBillingModeAction,
  updateDealValueAction,
} from "@/app/lite/admin/invoices/actions";

interface Props {
  companyId: string;
  companyName: string;
  paymentTermsDays: number;
  billingMode: "stripe" | "manual";
  retainerValueCents: number | null;
  dealId: string | null;
  bankDetails: {
    account_name: string;
    bsb: string;
    account_number: string;
  };
  rows: InvoiceIndexRow[];
  focusedInvoiceId: string | null;
  focusedDetail: InvoiceDetail | null;
}

const TERM_OPTIONS = [7, 14, 30, 60] as const;

export function BillingTab(props: Props) {
  const {
    companyId,
    companyName,
    paymentTermsDays,
    billingMode,
    retainerValueCents,
    dealId,
    bankDetails,
    rows,
    focusedInvoiceId,
    focusedDetail,
  } = props;
  const router = useRouter();
  const [terms, setTerms] = React.useState(paymentTermsDays);
  const [mode, setMode] = React.useState(billingMode);
  const [saving, setSaving] = React.useState(false);
  const [savingMode, setSavingMode] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [editingValue, setEditingValue] = React.useState(false);
  const [valueDollars, setValueDollars] = React.useState(
    retainerValueCents != null ? String(retainerValueCents / 100) : "",
  );
  const [savingValue, setSavingValue] = React.useState(false);

  async function onTermsChange(next: number) {
    const prior = terms;
    setTerms(next);
    setSaving(true);
    const res = await updateCompanyPaymentTermsAction({
      companyId,
      paymentTermsDays: next as 7 | 14 | 30 | 60,
    });
    setSaving(false);
    if (!res.ok) {
      setTerms(prior);
      toast.error(res.error);
      return;
    }
    toast.success(`Payment terms updated to ${next} days.`);
    router.refresh();
  }

  async function onBillingModeToggle() {
    const next = mode === "stripe" ? "manual" : "stripe";
    const prior = mode;
    setMode(next);
    setSavingMode(true);
    const res = await updateBillingModeAction({ companyId, billingMode: next });
    setSavingMode(false);
    if (!res.ok) {
      setMode(prior);
      toast.error(res.error);
      return;
    }
    toast.success(
      next === "manual"
        ? "Switched to manual billing. Invoices generate but payments won't be triggered."
        : "Switched to Stripe billing. Payments will be triggered automatically.",
    );
    router.refresh();
  }

  async function onSaveValue() {
    if (!dealId) return;
    const cents = Math.round(Number(valueDollars) * 100);
    if (isNaN(cents) || cents < 0) {
      toast.error("Enter a valid dollar amount.");
      return;
    }
    setSavingValue(true);
    const res = await updateDealValueAction({
      dealId,
      companyId,
      valueCents: cents,
    });
    setSavingValue(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEditingValue(false);
    toast.success("Retainer value updated.");
    router.refresh();
  }

  async function onNewInvoice() {
    setCreating(true);
    const res = await createManualInvoiceAction({ companyId });
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Draft invoice created.");
    router.push(`/lite/admin/invoices?invoice=${res.invoiceId}`);
  }

  const summaryStub = {
    outstanding_cents: 0,
    overdue_cents: 0,
    paid_this_month_cents: 0,
    paid_this_fy_cents: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4">
        <h2 className="font-heading text-lg font-semibold">
          Billing · {companyName}
        </h2>
        <Button onClick={onNewInvoice} disabled={creating}>
          {creating ? "Creating…" : "New invoice"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Billing mode
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={mode === "manual"}
              disabled={savingMode}
              onClick={onBillingModeToggle}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50"
              style={{
                backgroundColor: mode === "manual"
                  ? "var(--color-brand-orange)"
                  : "var(--color-neutral-600)",
              }}
            >
              <span
                className="block size-4 rounded-full bg-white transition-transform"
                style={{
                  transform: mode === "manual" ? "translateX(24px)" : "translateX(4px)",
                }}
              />
            </button>
            <span className="text-sm">
              {mode === "manual" ? "Manual billing" : "Stripe billing"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {mode === "manual"
              ? "Invoices generate but payments aren't triggered automatically."
              : "Payments are triggered via Stripe when invoices are sent."}
          </p>
        </Card>

        {dealId && (
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Retainer / package value
            </div>
            {editingValue ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm">$</span>
                <input
                  type="number"
                  value={valueDollars}
                  onChange={(e) => setValueDollars(e.target.value)}
                  className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  placeholder="0"
                  min={0}
                  step={1}
                />
                <span className="text-xs text-muted-foreground">/mo</span>
                <Button size="sm" onClick={onSaveValue} disabled={savingValue}>
                  {savingValue ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingValue(false);
                    setValueDollars(
                      retainerValueCents != null ? String(retainerValueCents / 100) : "",
                    );
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-lg font-medium">
                  {retainerValueCents != null
                    ? `$${(retainerValueCents / 100).toLocaleString("en-AU")} /mo`
                    : "Not set"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditingValue(true)}>
                  Edit
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Payment terms
          </div>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={terms}
              disabled={saving}
              onChange={(e) => onTermsChange(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              aria-label="Payment terms in days"
            >
              {TERM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
            {saving && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Applied to new invoices for this client. Existing invoices keep their
            original terms.
          </p>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Bank details (read-only)
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="font-mono">{bankDetails.account_name}</dd>
            <dt className="text-muted-foreground">BSB</dt>
            <dd className="font-mono">{bankDetails.bsb}</dd>
            <dt className="text-muted-foreground">Number</dt>
            <dd className="font-mono">{bankDetails.account_number}</dd>
          </dl>
        </Card>
      </div>

      <InvoiceIndexClient
        rows={rows}
        summary={summaryStub}
        initialFilter="all"
        initialFocusedId={focusedInvoiceId}
        initialDetail={focusedDetail}
        hideSummary
        hideFilters
      />
    </div>
  );
}
