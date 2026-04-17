"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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
  /** When rendered inside the company billing tab, suppress tfoot totals. */
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

/** An overdue invoice past this many days of its due date is "dormant overdue" (§10 stale affordance). */
const STALE_DAYS = 14;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCentsCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
  const [now] = React.useState(() => Date.now());
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

  const isEmpty = rows.length === 0;

  return (
    <div className="space-y-5 px-4 pb-10">
      {!hideFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter invoices by status"
            className="inline-flex items-center gap-1 rounded-[10px] p-1"
            style={{
              background: "rgba(15, 15, 14, 0.45)",
              boxShadow: "var(--surface-highlight)",
            }}
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
                  className="relative rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    letterSpacing: "1.5px",
                    color: active
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="invoice-filter-active"
                      className="absolute inset-0 rounded-md"
                      style={{
                        background: "var(--color-surface-2)",
                        boxShadow: "var(--surface-highlight)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client or number"
              aria-label="Search invoices"
              className="h-9 w-64 rounded-md bg-transparent px-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
              style={{
                border: "1px solid rgba(253, 245, 230, 0.05)",
                background: "rgba(15, 15, 14, 0.45)",
              }}
            />
            <span
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] tabular-nums"
              style={{ letterSpacing: "1.5px" }}
            >
              {visible.length} / {rows.length}
            </span>
          </div>
        </div>
      )}

      {isEmpty ? (
        <EmptyInvoices />
      ) : (
        <div
          id="invoice-list"
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
                  { label: "Invoice", align: "left" as const },
                  { label: "Client", align: "left" as const },
                  { label: "Total", align: "right" as const },
                  { label: "Issued", align: "left" as const },
                  { label: "Due", align: "left" as const },
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
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]"
                  >
                    Nothing matches that filter.
                  </td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {visible.map((r) => {
                  const isStale =
                    r.status === "overdue" &&
                    now - r.due_at_ms > STALE_MS;
                  return (
                    <motion.tr
                      key={r.id}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => openInvoice(r.id)}
                      className="group cursor-pointer transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{
                        background: "transparent",
                      }}
                      whileHover={{
                        backgroundColor: "rgba(253, 245, 230, 0.025)",
                      }}
                    >
                      <td
                        className="font-[family-name:var(--font-label)] text-[11px] tabular-nums"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color: isStale
                            ? "var(--color-neutral-500)"
                            : "var(--color-brand-cream)",
                          letterSpacing: "1px",
                          borderLeft: isStale
                            ? "1px dashed rgba(244, 160, 176, 0.35)"
                            : "1px solid transparent",
                        }}
                      >
                        {r.invoice_number}
                      </td>
                      <td
                        className="font-[family-name:var(--font-body)] text-[13px]"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color: isStale
                            ? "var(--color-neutral-500)"
                            : "var(--color-brand-cream)",
                          fontWeight: isStale ? 400 : 500,
                        }}
                      >
                        {isStale ? (
                          <span>
                            <span
                              aria-hidden
                              style={{
                                color: "var(--color-brand-pink)",
                                marginRight: 6,
                              }}
                            >
                              ·
                            </span>
                            {r.company_name}
                          </span>
                        ) : (
                          r.company_name
                        )}
                      </td>
                      <td
                        className="font-[family-name:var(--font-label)] tabular-nums"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color:
                            r.status === "paid"
                              ? "var(--color-success)"
                              : isStale
                                ? "var(--color-neutral-500)"
                                : "var(--color-brand-cream)",
                          letterSpacing: "1px",
                          textAlign: "right",
                          fontSize: "13px",
                        }}
                      >
                        {formatCents(r.total_cents_inc_gst)}
                      </td>
                      <td
                        className="font-[family-name:var(--font-body)] text-[12px] italic"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color: "var(--color-neutral-500)",
                        }}
                      >
                        {formatDate(r.issue_date_ms)}
                      </td>
                      <td
                        className="font-[family-name:var(--font-body)] text-[12px] italic"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color: "var(--color-neutral-500)",
                        }}
                      >
                        {isStale
                          ? `dormant · ${formatDate(r.due_at_ms)}`
                          : formatDate(r.due_at_ms)}
                      </td>
                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        }}
                      >
                        <InvoiceStatusBadge status={r.status} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
            {!hideSummary && (
              <tfoot>
                <tr>
                  <td
                    colSpan={2}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "1.8px",
                      padding: "18px 14px",
                      borderTop: "1px solid rgba(253, 245, 230, 0.06)",
                    }}
                  >
                    Outstanding
                  </td>
                  <td
                    className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]"
                    style={{
                      letterSpacing: "1px",
                      padding: "18px 14px",
                      borderTop: "1px solid rgba(253, 245, 230, 0.06)",
                      textAlign: "right",
                      fontSize: "14px",
                    }}
                  >
                    {formatCentsCompact(summary.outstanding_cents)}
                  </td>
                  <td
                    colSpan={3}
                    className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
                    style={{
                      padding: "18px 14px",
                      borderTop: "1px solid rgba(253, 245, 230, 0.06)",
                    }}
                  >
                    sent + overdue, GST-inclusive
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
                    style={{
                      letterSpacing: "1.8px",
                      padding: "14px",
                    }}
                  >
                    Overdue
                  </td>
                  <td
                    className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-orange)]"
                    style={{
                      letterSpacing: "1px",
                      padding: "14px",
                      textAlign: "right",
                      fontSize: "14px",
                    }}
                  >
                    {formatCentsCompact(summary.overdue_cents)}
                  </td>
                  <td
                    colSpan={3}
                    className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]"
                    style={{ padding: "14px" }}
                  >
                    past due
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      padding: "20px 14px",
                      background:
                        "linear-gradient(135deg, rgba(123, 174, 126, 0.18), rgba(244, 160, 176, 0.05) 60%, rgba(34, 34, 31, 0) 95%)",
                      borderTop: "1px solid rgba(123, 174, 126, 0.25)",
                    }}
                  >
                    <div
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-success)]"
                      style={{ letterSpacing: "2px" }}
                    >
                      Paid · FY
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "12px 14px 18px",
                      textAlign: "right",
                      background:
                        "linear-gradient(135deg, rgba(123, 174, 126, 0.18), rgba(244, 160, 176, 0.05) 60%, rgba(34, 34, 31, 0) 95%)",
                      borderTop: "1px solid rgba(123, 174, 126, 0.25)",
                    }}
                  >
                    <div
                      className="font-[family-name:var(--font-display)] tabular-nums text-[color:var(--color-brand-cream)]"
                      style={{
                        fontSize: "32px",
                        lineHeight: 1,
                        letterSpacing: "-0.3px",
                      }}
                    >
                      {formatCentsCompact(summary.paid_this_fy_cents)}
                    </div>
                  </td>
                  <td
                    colSpan={3}
                    className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]"
                    style={{
                      padding: "14px",
                      background:
                        "linear-gradient(135deg, rgba(123, 174, 126, 0.18), rgba(244, 160, 176, 0.05) 60%, rgba(34, 34, 31, 0) 95%)",
                      borderTop: "1px solid rgba(123, 174, 126, 0.25)",
                    }}
                  >
                    {formatCentsCompact(summary.paid_this_month_cents)} this month.
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <InvoiceDetailDrawer
        open={drawerOpen}
        detail={initialDetail}
        onClose={closeDrawer}
      />
    </div>
  );
}

function EmptyInvoices() {
  return (
    <div
      className="rounded-[12px] px-8 py-10 text-center"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <p
        className="font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.2px" }}
      >
        No invoices yet.
      </p>
      <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
        clean slate — or you haven&apos;t sent one.
      </p>
    </div>
  );
}
