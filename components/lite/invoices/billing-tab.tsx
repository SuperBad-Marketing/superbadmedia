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
} from "@/app/lite/admin/invoices/actions";

interface Props {
  companyId: string;
  companyName: string;
  paymentTermsDays: number;
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
    bankDetails,
    rows,
    focusedInvoiceId,
    focusedDetail,
  } = props;
  const router = useRouter();
  const [terms, setTerms] = React.useState(paymentTermsDays);
  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

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
