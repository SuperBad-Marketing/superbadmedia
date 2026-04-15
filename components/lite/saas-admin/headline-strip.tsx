"use client";

/**
 * SaaS admin headlines strip — shared between the products index and the
 * per-product detail Overview. Spec §8.1 + §8.3. SB-10.
 *
 * Pure-presentational: receives a `SaasHeadlineSignals` payload and
 * renders five signal tiles (active subscribers / MRR / new / churn /
 * near-cap) plus a second row carrying past-due + MRR delta. Fade-in on
 * mount on `houseSpring` per `feedback_motion_is_universal`.
 *
 * Visual chrome rebuilt in admin-polish-2 against mockup-admin-interior.html
 * §6 summary cards — Righteous eyebrows (rule 02), BHS values (mockup §6
 * "big numbers are Black Han Sans"), surface-2 + --surface-highlight (rule
 * 03), brand tones for warn/watch (rule 04 / rule 05 adjacent).
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

function deltaToneColor(delta: number): string | undefined {
  if (delta > 0) return "var(--color-success)";
  if (delta < 0) return "var(--color-brand-pink)";
  return undefined;
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
          valueColor={deltaToneColor(mrrDeltaCents)}
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
  valueColor,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warn" | "watch";
  valueColor?: string;
}) {
  const toneStyle =
    tone === "warn"
      ? {
          background:
            "linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))",
          border: "1px solid rgba(178, 40, 72, 0.25)",
          boxShadow: "var(--surface-highlight)",
        }
      : tone === "watch"
        ? {
            background: "rgba(228, 176, 98, 0.08)",
            border: "1px solid rgba(228, 176, 98, 0.25)",
            boxShadow: "var(--surface-highlight)",
          }
        : {
            background: "var(--color-surface-2)",
            border: "1px solid transparent",
            boxShadow: "var(--surface-highlight)",
          };
  const labelColor =
    tone === "warn"
      ? "var(--color-brand-orange)"
      : tone === "watch"
        ? "var(--color-warning)"
        : "var(--color-neutral-500)";
  return (
    <div
      className="flex flex-col gap-1 rounded-[12px] px-5 py-[18px]"
      style={toneStyle}
    >
      <dt
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
        style={{ letterSpacing: "1.5px", color: labelColor }}
      >
        {label}
      </dt>
      <dd
        className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-none tabular-nums"
        style={{
          letterSpacing: "-0.2px",
          color: valueColor ?? "var(--color-brand-cream)",
        }}
      >
        {value}
      </dd>
      {hint ? (
        <p
          className="mt-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.2px" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
