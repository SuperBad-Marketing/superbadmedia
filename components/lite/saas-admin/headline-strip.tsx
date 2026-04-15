"use client";

/**
 * SaaS admin headlines strip — shared between the products index and the
 * per-product detail Overview. Spec §8.1 + §8.3. SB-10.
 *
 * Pure-presentational: receives a `SaasHeadlineSignals` payload and
 * renders five signal tiles (active subscribers / MRR / new / churn /
 * near-cap) plus a second row carrying past-due + MRR delta. Fade-in on
 * mount on `houseSpring` per `feedback_motion_is_universal`.
 */

import { motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";
import type { SaasHeadlineSignals } from "@/lib/saas-products/headline-signals";

function formatCents(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedCents(cents: number): string {
  if (cents === 0) return "$0";
  const sign = cents > 0 ? "+" : "−";
  return `${sign}${formatCents(Math.abs(cents))}`;
}

function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct * 100).toFixed(1)}%`;
}

function deltaTone(delta: number): string {
  if (delta > 0) return "text-emerald-700 dark:text-emerald-400";
  if (delta < 0) return "text-rose-700 dark:text-rose-400";
  return "text-muted-foreground";
}

export interface HeadlineStripProps {
  signals: SaasHeadlineSignals;
  /** When true, caller rendered the strip inside a product Overview context. */
  scoped?: boolean;
}

export function HeadlineStrip({ signals, scoped }: HeadlineStripProps) {
  const {
    activeSubscribers,
    mrrCents,
    newThisWindow,
    churnThisWindow,
    mrrDeltaCents,
    mrrDeltaPct,
    pastDueCount,
    nearCapCount,
    windowDays,
  } = signals;

  const windowLabel =
    windowDays === 30
      ? "this month"
      : windowDays === 7
        ? "this week"
        : `last ${windowDays} days`;

  return (
    <motion.section
      aria-label={scoped ? "Product health" : "SaaS health"}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      className="px-4 pb-4"
      data-testid="headline-strip"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Active subscribers"
          value={String(activeSubscribers)}
        />
        <Tile label="Total MRR" value={formatCents(mrrCents)} />
        <Tile label={`New ${windowLabel}`} value={String(newThisWindow)} />
        <Tile label={`Churn ${windowLabel}`} value={String(churnThisWindow)} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label="Past due"
          value={String(pastDueCount)}
          tone={pastDueCount > 0 ? "warn" : undefined}
        />
        <Tile
          label="Near cap"
          value={String(nearCapCount)}
          tone={nearCapCount > 0 ? "watch" : undefined}
        />
        <Tile
          label={`MRR delta ${windowLabel}`}
          value={formatSignedCents(mrrDeltaCents)}
          hint={formatPct(mrrDeltaPct)}
          valueClassName={deltaTone(mrrDeltaCents)}
        />
      </div>
    </motion.section>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warn" | "watch";
  valueClassName?: string;
}) {
  const borderClass =
    tone === "warn"
      ? "border-rose-500/30 bg-rose-500/5"
      : tone === "watch"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card";
  return (
    <div
      className={`rounded-lg border ${borderClass} p-4 shadow-sm`}
    >
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 font-heading text-2xl font-semibold ${
          valueClassName ?? ""
        }`}
      >
        {value}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
