"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { InvoiceStatus } from "@/lib/db/schema/invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceDetailDrawer } from "./invoice-detail-drawer";
import type { InvoiceDetail } from "@/lib/invoicing/detail-query";
import type { InvoiceIndexSummaryValue } from "@/lib/invoicing/index-query";

export type InvoiceIndexFilter =
  | "all"
  | "draft"
  | "sent"
  | "overdue"
  | "paid"
  | "void";

export interface InvoiceIndexRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total_cents_inc_gst: number;
  issue_date_ms: number;
  due_at_ms: number;
  paid_at_ms: number | null;
  company_id: string;
  company_name: string;
}

export type InvoiceIndexSummary = InvoiceIndexSummaryValue;

interface Props {
  rows: InvoiceIndexRow[];
  summary: InvoiceIndexSummary;
  initialFilter: InvoiceIndexFilter;
  initialFocusedId: string | null;
  initialDetail: InvoiceDetail | null;
  /** When rendered inside the company billing tab, suppress summary cards. */
  hideSummary?: boolean;
  /** Filter tab bar visibility (off on company tab per spec §4.2). */
  hideFilters?: boolean;
}

const TABS: { id: InvoiceIndexFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

export function InvoiceIndexClient(props: Props) {
  const {
    rows,
    summary,
    initialFilter,
    initialFocusedId,
    initialDetail,
    hideSummary,
    hideFilters,
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = React.useState<InvoiceIndexFilter>(initialFilter);
  const [search, setSearch] = React.useState("");
  const drawerOpen = initialFocusedId !== null;

  React.useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  function updateFilter(next: InvoiceIndexFilter) {
    setFilter(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") {
      params.delete("filter");
    } else {
      params.set("filter", next);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  function openInvoice(id: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("invoice", id);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function closeDrawer() {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("invoice");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?", { scroll: false });
  }

  const visible = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!s) return true;
      return (
        r.invoice_number.toLowerCase().includes(s) ||
        r.company_name.toLowerCase().includes(s)
      );
    });
  }, [rows, filter, search]);

  return (
    <div className="space-y-5 px-4 pb-10">
      {!hideSummary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Outstanding" cents={summary.outstanding_cents} />
          <SummaryCard
            label="Overdue"
            cents={summary.overdue_cents}
            tone={summary.overdue_cents > 0 ? "alert" : undefined}
          />
          <SummaryCard
            label="Paid this month"
            cents={summary.paid_this_month_cents}
          />
          <SummaryCard label="Paid this FY" cents={summary.paid_this_fy_cents} />
        </div>
      )}

      {!hideFilters && (
        <div
          role="tablist"
          aria-label="Filter invoices by status"
          className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1"
        >
          {TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                aria-controls="invoice-list"
                type="button"
                onClick={() => updateFilter(tab.id)}
                data-testid={`invoice-filter-${tab.id}`}
                className={cn(
                  "relative rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="invoice-filter-active"
                    className="absolute inset-0 rounded-sm bg-background shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client or invoice number"
          className="max-w-sm"
          aria-label="Search invoices"
        />
        <span className="text-xs text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
      </div>

      <div id="invoice-list" className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2 text-right">Total inc-GST</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No invoices match.
                </td>
              </tr>
            )}
            <AnimatePresence initial={false}>
              {visible.map((r) => (
                <motion.tr
                  key={r.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => openInvoice(r.id)}
                  className="cursor-pointer border-t border-border hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.invoice_number}
                  </td>
                  <td className="px-3 py-2">{r.company_name}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCents(r.total_cents_inc_gst)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(r.issue_date_ms)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(r.due_at_ms)}
                  </td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={r.status} />
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <InvoiceDetailDrawer
        open={drawerOpen}
        detail={initialDetail}
        onClose={closeDrawer}
      />
    </div>
  );
}

function SummaryCard({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number;
  tone?: "alert";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-heading text-2xl font-semibold",
          tone === "alert" && "text-[#c1202d]",
        )}
      >
        {formatCents(cents)}
      </div>
    </Card>
  );
}
