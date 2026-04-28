"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { houseSpring } from "@/lib/design-tokens";
import type { PortalInvoice } from "@/app/lite/portal/[token]/invoices/actions";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function statusBadge(status: string): { label: string; bg: string; text: string } {
  switch (status) {
    case "paid":
      return {
        label: "paid",
        bg: "rgba(123,174,126,0.15)",
        text: "var(--color-semantic-success)",
      };
    case "sent":
      return {
        label: "sent",
        bg: "rgba(253,245,230,0.06)",
        text: "var(--color-brand-cream)",
      };
    case "overdue":
      return {
        label: "overdue",
        bg: "rgba(242,140,82,0.15)",
        text: "var(--color-semantic-warning)",
      };
    case "void":
      return {
        label: "void",
        bg: "rgba(128,127,115,0.15)",
        text: "var(--color-neutral-500)",
      };
    default:
      return {
        label: status,
        bg: "rgba(253,245,230,0.06)",
        text: "var(--color-neutral-500)",
      };
  }
}

function InvoiceCard({
  invoice,
  index,
}: {
  invoice: PortalInvoice;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const badge = statusBadge(invoice.status);

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { ...houseSpring, delay: Math.min(index * 0.05, 0.3) }
      }
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full items-center justify-between border-b border-[rgba(253,245,230,0.04)] px-1 py-5 text-left transition-colors hover:bg-[rgba(253,245,230,0.02)]"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-[family-name:var(--font-righteous)] text-[13px] tracking-wide text-[var(--color-brand-cream)]">
            {invoice.invoiceNumber}
          </span>
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[1px]"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
          <span className="text-[12px] text-[var(--color-neutral-500)]">
            {formatDate(invoice.issueDateMs)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[15px] tabular-nums text-[var(--color-brand-cream)]">
            {formatCents(invoice.totalCentsIncGst)}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`text-[var(--color-neutral-500)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="overflow-hidden"
          >
            <div className="border-b border-[rgba(253,245,230,0.04)] bg-[rgba(253,245,230,0.02)] px-4 py-5">
              {invoice.scopeSummary && (
                <p className="mb-4 font-[family-name:var(--font-playfair-display)] text-[13px] italic text-[var(--color-neutral-500)]">
                  {invoice.scopeSummary}
                </p>
              )}

              <div className="space-y-2">
                {invoice.lineItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between text-[13px]"
                  >
                    <span className="text-[var(--color-brand-cream)]/80">
                      {item.description}
                      {item.quantity > 1 && (
                        <span className="ml-1 text-[var(--color-neutral-500)]">
                          &times;{item.quantity}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-[var(--color-brand-cream)]">
                      {formatCents(item.line_total_cents_inc_gst)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-baseline justify-between border-t border-[rgba(253,245,230,0.06)] pt-3">
                <span className="text-[11px] uppercase tracking-[1px] text-[var(--color-neutral-500)]">
                  total {invoice.gstApplicable ? "(inc. GST)" : ""}
                </span>
                <span className="text-[15px] tabular-nums text-[var(--color-brand-cream)]">
                  {formatCents(invoice.totalCentsIncGst)}
                </span>
              </div>

              {invoice.gstApplicable && invoice.gstCents > 0 && (
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-[1px] text-[var(--color-neutral-500)]">
                    gst included
                  </span>
                  <span className="text-[12px] tabular-nums text-[var(--color-neutral-500)]">
                    {formatCents(invoice.gstCents)}
                  </span>
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 text-[12px] text-[var(--color-neutral-500)]">
                {invoice.status === "paid" && invoice.paidAtMs && (
                  <span>paid {formatDate(invoice.paidAtMs)}</span>
                )}
                {(invoice.status === "sent" || invoice.status === "overdue") && (
                  <span>due {formatDate(invoice.dueAtMs)}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InvoicesEmpty() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p
        className="text-center font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]"
        data-ambient-slot="portal_invoices_empty"
      >
        no invoices yet. when there are, they&rsquo;ll appear here.
      </p>
    </div>
  );
}

export function PortalInvoicesList({
  invoices,
}: {
  invoices: PortalInvoice[];
}) {
  const shouldReduceMotion = useReducedMotion();

  const totalOutstanding = invoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.totalCentsIncGst, 0);

  return (
    <div className="mx-auto max-w-[780px] px-4 md:px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="flex flex-col gap-2 border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10 sm:flex-row sm:items-end sm:justify-between sm:gap-0"
      >
        <div>
          <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
            finance
          </span>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-3xl leading-none text-[var(--color-brand-cream)] sm:text-4xl">
            Invoices
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {invoices.length > 0 && (
            <span className="text-xs text-[var(--color-neutral-500)]">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
            </span>
          )}
          {totalOutstanding > 0 && (
            <span className="font-[family-name:var(--font-playfair-display)] text-[14px] italic text-[var(--color-semantic-warning)] sm:text-[15px]">
              {formatCents(totalOutstanding)} outstanding
            </span>
          )}
          {invoices.length > 0 && totalOutstanding === 0 && (
            <span className="font-[family-name:var(--font-playfair-display)] text-[14px] italic text-[var(--color-neutral-500)] sm:text-[15px]">
              all settled.
            </span>
          )}
        </div>
      </motion.div>

      {invoices.length === 0 ? (
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { ...houseSpring, delay: 0.15 }
          }
        >
          <InvoicesEmpty />
        </motion.div>
      ) : (
        <div className="pb-12 pt-2">
          {invoices.map((inv, i) => (
            <InvoiceCard key={inv.id} invoice={inv} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
