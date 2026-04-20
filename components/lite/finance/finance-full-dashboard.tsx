"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  AlertTriangle,
  Plus,
} from "lucide-react";
import Link from "next/link";

import { houseSpring } from "@/lib/design-tokens";
import { Badge } from "@/components/ui/badge";
import type {
  DashboardData,
  TransactionRow,
} from "@/lib/finance/dashboard-data";
import type { NarrativeOutput } from "@/lib/finance/narrative-prompt";
import type { FinanceMetrics } from "@/lib/db/schema/finance-snapshots";
import { ExpenseModal } from "./expense-modal";

function formatAud(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return dollars.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatAudFull(cents: number): string {
  return (cents / 100).toLocaleString("en-AU", {
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
  });
}

function momDelta(
  current: number,
  prev: number | null,
): { percent: number; direction: "up" | "down" | "flat" } | null {
  if (prev == null || prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return { percent: 0, direction: "flat" };
  return { percent: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

function DeltaBadge({
  delta,
}: {
  delta: { percent: number; direction: "up" | "down" | "flat" } | null;
}) {
  if (!delta) return null;
  const Icon =
    delta.direction === "up"
      ? TrendingUp
      : delta.direction === "down"
        ? TrendingDown
        : Minus;
  const color =
    delta.direction === "up"
      ? "text-[color:var(--color-semantic-success)]"
      : delta.direction === "down"
        ? "text-[color:var(--color-brand-red)]"
        : "text-[color:var(--color-neutral-500)]";
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] ${color}`}>
      <Icon className="h-3 w-3" />
      {delta.percent}% vs last month
    </span>
  );
}

function ProjectionChart({
  projection,
}: {
  projection: DashboardData["projection"];
}) {
  if (!projection) {
    return (
      <div className="flex h-full items-center justify-center text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
        Nothing contracted and nothing in the pipeline.
      </div>
    );
  }

  const contracted = projection.contracted_curve;
  const pipeline = projection.pipeline_weighted_curve;
  const decay = projection.decay_adjusted_curve;

  if (contracted.length === 0) return null;

  const allValues = [
    ...contracted.map((d) => d.cents),
    ...pipeline.map((d) => d.cents),
    ...decay.map((d) => d.cents),
  ];
  const maxVal = Math.max(...allValues, 1);

  const width = contracted.length;
  const height = 120;
  const scaleY = (v: number) => height - (v / maxVal) * (height - 10);

  function toPath(curve: Array<{ cents: number }>): string {
    return curve
      .map((point, i) => {
        const x = (i / Math.max(curve.length - 1, 1)) * 100;
        const y = scaleY(point.cents);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  function toAreaPath(curve: Array<{ cents: number }>): string {
    const line = toPath(curve);
    return `${line} L 100 ${height} L 0 ${height} Z`;
  }

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <path
        d={toAreaPath(contracted)}
        fill="rgba(123, 174, 126, 0.15)"
        stroke="none"
      />
      <path
        d={toPath(contracted)}
        fill="none"
        stroke="var(--color-semantic-success)"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={toPath(pipeline)}
        fill="none"
        stroke="var(--color-brand-pink)"
        strokeWidth="0.6"
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={toPath(decay)}
        fill="none"
        stroke="var(--color-neutral-500)"
        strokeWidth="0.4"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function NarrativeCard({
  narrative,
  narrativeStale,
}: {
  narrative: NarrativeOutput | null;
  narrativeStale: boolean;
}) {
  if (!narrative || !narrative.paragraph_text) {
    return (
      <div
        className="rounded-[12px] px-6 py-5"
        style={{
          background: "var(--color-surface-1)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
          Narrative unavailable. Next snapshot will generate one.
        </p>
      </div>
    );
  }

  let text = narrative.paragraph_text;
  const refs = narrative.number_references ?? [];

  const segments: Array<{ text: string; isRef: boolean; link?: string }> = [];
  let remaining = text;

  for (const ref of refs) {
    const idx = remaining.indexOf(ref.token);
    if (idx === -1) continue;
    if (idx > 0) {
      segments.push({ text: remaining.slice(0, idx), isRef: false });
    }
    segments.push({ text: ref.token, isRef: true, link: ref.link_path });
    remaining = remaining.slice(idx + ref.token.length);
  }
  if (remaining) {
    segments.push({ text: remaining, isRef: false });
  }

  if (segments.length === 0) {
    segments.push({ text, isRef: false });
  }

  return (
    <div
      className="rounded-[12px] px-6 py-5"
      style={{
        background: "var(--color-surface-1)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      {narrativeStale && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[color:var(--color-neutral-500)]">
          <AlertTriangle className="h-3 w-3" />
          Narrative may be stale
        </div>
      )}
      <p className="font-[family-name:var(--font-narrative)] text-[18px] leading-[1.6] text-[color:var(--color-brand-cream)]">
        {segments.map((seg, i) =>
          seg.isRef ? (
            <Link
              key={i}
              href={seg.link ?? "#"}
              className="text-[color:var(--color-brand-pink)] underline decoration-[color:var(--color-brand-pink)]/30 underline-offset-2 transition-colors duration-150 hover:text-[color:var(--color-brand-cream)]"
            >
              {seg.text}
            </Link>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sublabel,
  href,
  children,
}: {
  label: string;
  value: string;
  sublabel?: string;
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[12px] px-5 py-4 transition-colors duration-[180ms]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-none tabular-nums text-[color:var(--color-brand-cream)]">
        {value}
      </div>
      {sublabel && (
        <div className="mt-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          {sublabel}
        </div>
      )}
      {children}
    </Link>
  );
}

interface FinanceFullDashboardProps {
  data: DashboardData;
  vendorSuggestions: string[];
  pendingReviewCount: number;
  rangeLabel: string;
}

export function FinanceFullDashboard({
  data,
  vendorSuggestions,
  pendingReviewCount,
  rangeLabel,
}: FinanceFullDashboardProps) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState(null);
  const reducedMotion = useReducedMotion();

  const m = data.metrics;
  const delta = m
    ? momDelta(m.revenue_mtd_cents, data.prevMetrics?.revenue_mtd_cents ?? null)
    : null;

  return (
    <>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        className="space-y-5"
      >
        {/* Headline: P&L + Projection side-by-side */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* P&L tile */}
          <div
            className="rounded-[12px] px-6 py-5"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "2px" }}
            >
              {rangeLabel} P&L
            </div>
            {m ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-300)]">
                    Revenue
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[28px] tabular-nums text-[color:var(--color-semantic-success)]">
                    {formatAudFull(m.revenue_mtd_cents)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-300)]">
                    Expenses
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[24px] tabular-nums text-[color:var(--color-neutral-400)]">
                    −{formatAudFull(m.expenses_mtd_cents)}
                  </span>
                </div>
                <div
                  className="border-t pt-3"
                  style={{
                    borderColor: "rgba(253, 245, 230, 0.08)",
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                      Net
                    </span>
                    <span
                      className={`font-[family-name:var(--font-display)] text-[28px] tabular-nums ${
                        m.net_cents >= 0
                          ? "text-[color:var(--color-semantic-success)]"
                          : "text-[color:var(--color-brand-red)]"
                      }`}
                    >
                      {m.net_cents < 0 ? "−" : ""}
                      {formatAudFull(Math.abs(m.net_cents))}
                    </span>
                  </div>
                  <DeltaBadge delta={delta} />
                </div>
              </div>
            ) : (
              <div className="mt-4 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
                No data yet. Snapshot generates at 6am daily.
              </div>
            )}
          </div>

          {/* Projection chart */}
          <div
            className="rounded-[12px] px-6 py-5"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "2px" }}
              >
                90-Day Projection
              </div>
              <div className="flex gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[color:var(--color-semantic-success)]">
                  <span className="inline-block h-[2px] w-3 rounded-full bg-[color:var(--color-semantic-success)]" />
                  Contracted
                </span>
                <span className="flex items-center gap-1 text-[color:var(--color-brand-pink)]">
                  <span className="inline-block h-[2px] w-3 rounded-full bg-[color:var(--color-brand-pink)]" />
                  Pipeline
                </span>
              </div>
            </div>
            <div className="h-[140px]">
              <ProjectionChart projection={data.projection} />
            </div>
          </div>
        </div>

        {/* Narrative card */}
        <NarrativeCard
          narrative={data.narrative}
          narrativeStale={data.narrativeStale}
        />

        {/* Metric tiles: 2x2 on md, 4-col on lg, stacked on mobile */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="MRR"
            value={m ? formatAud(m.mrr_cents) : "—"}
            sublabel={
              data.mrrRunway
                ? `Runs to ${data.mrrRunway}`
                : m && m.mrr_cents > 0
                  ? "Month-to-month"
                  : undefined
            }
            href="/lite/finance/mrr"
          />
          <MetricTile
            label="Outstanding"
            value={m ? formatAud(m.outstanding_invoices_cents) : "—"}
            sublabel={
              data.outstandingInvoiceCount > 0
                ? `${data.outstandingInvoiceCount} invoice${data.outstandingInvoiceCount !== 1 ? "s" : ""}${data.overdueInvoiceCount > 0 ? ` · ${data.overdueInvoiceCount} overdue` : ""}`
                : undefined
            }
            href="/lite/finance/outstanding"
          />
          <MetricTile
            label="Top Expenses"
            value={
              data.topExpenseCategories.length > 0
                ? formatAud(
                    data.topExpenseCategories.reduce(
                      (s, c) => s + c.total_cents,
                      0,
                    ),
                  )
                : "—"
            }
            href="/lite/finance/expenses"
          >
            {data.topExpenseCategories.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {data.topExpenseCategories.slice(0, 3).map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]"
                  >
                    <span className="truncate">{cat.label}</span>
                    <span className="tabular-nums">{formatAud(cat.total_cents)}</span>
                  </div>
                ))}
              </div>
            )}
          </MetricTile>
          <MetricTile
            label="Tax Provision"
            value={m ? formatAud(m.yours_to_spend_cents) : "—"}
            sublabel="Yours to spend"
            href="/lite/finance"
          >
            {m && (
              <div className="mt-2 space-y-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                <div className="flex justify-between">
                  <span>GST owed</span>
                  <span className="tabular-nums">
                    {formatAud(m.gst_owed_cents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax provisioned</span>
                  <span className="tabular-nums">
                    {formatAud(m.income_tax_provisioned_cents)}
                  </span>
                </div>
              </div>
            )}
          </MetricTile>
        </div>

        {/* Pending review banner */}
        {pendingReviewCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm">
            <Badge
              variant="outline"
              className="border-amber-500/50 text-amber-600"
            >
              {pendingReviewCount}
            </Badge>
            <span>
              {pendingReviewCount === 1 ? "expense" : "expenses"} pending review
            </span>
            <Link
              href="/lite/finance/expenses?status=pending_review"
              className="ml-auto font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Review →
            </Link>
          </div>
        )}

        {/* Recent transactions */}
        {data.recentTransactions.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "2px" }}
              >
                Recent Transactions
              </h2>
              <Link
                href="/lite/finance/recent"
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "1.5px" }}
              >
                View all →
              </Link>
            </div>
            <div
              className="overflow-hidden rounded-[12px]"
              style={{
                background: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
              }}
            >
              {data.recentTransactions.map((tx, i) => (
                <Link
                  key={tx.id}
                  href={tx.link}
                  className="flex items-center justify-between px-5 py-3 transition-colors duration-[180ms] hover:bg-[rgba(253,245,230,0.02)]"
                  style={{
                    borderBottom:
                      i < data.recentTransactions.length - 1
                        ? "1px solid rgba(253, 245, 230, 0.05)"
                        : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        tx.type === "income"
                          ? "bg-[color:var(--color-semantic-success)]"
                          : "bg-[color:var(--color-neutral-500)]"
                      }`}
                    />
                    <div>
                      <div className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]">
                        {tx.counterparty}
                      </div>
                      <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                        {tx.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-[family-name:var(--font-body)] text-[13px] tabular-nums ${
                        tx.type === "income"
                          ? "text-[color:var(--color-semantic-success)]"
                          : "text-[color:var(--color-neutral-400)]"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "−"}
                      {formatAud(tx.amount_cents)}
                    </div>
                    <div className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
                      {formatDate(tx.date)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* FAB — persistent quick-add expense */}
      <motion.button
        type="button"
        onClick={() => {
          setEditingExpense(null);
          setModalOpen(true);
        }}
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
