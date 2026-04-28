"use client";

import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { PackageData } from "@/app/lite/portal/[token]/package/actions";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCadence(cadence: string | null): string {
  switch (cadence) {
    case "monthly":
      return "monthly";
    case "annual_monthly":
      return "annual (paid monthly)";
    case "annual_upfront":
      return "annual (paid upfront)";
    default:
      return "monthly";
  }
}

function stateDisplay(state: string): { label: string; color: string } {
  switch (state) {
    case "active_current":
      return { label: "active", color: "var(--color-semantic-success)" };
    case "past_due":
      return { label: "past due", color: "var(--color-semantic-warning)" };
    case "paused":
      return { label: "paused", color: "var(--color-neutral-500)" };
    case "cancel_scheduled_preterm":
      return { label: "cancelling", color: "var(--color-semantic-warning)" };
    case "cancelled_paid_remainder":
    case "cancelled_buyout":
    case "cancelled_post_term":
      return { label: "cancelled", color: "var(--color-semantic-error)" };
    case "ended_gracefully":
      return { label: "ended", color: "var(--color-neutral-500)" };
    default:
      return { label: state.replace(/_/g, " "), color: "var(--color-neutral-500)" };
  }
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ms));
}

function DetailRow({
  label,
  value,
  index,
}: {
  label: string;
  value: React.ReactNode;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { ...houseSpring, delay: 0.12 + index * 0.05 }
      }
      className="flex items-baseline justify-between border-b border-[rgba(253,245,230,0.04)] py-4 last:border-0"
    >
      <span className="font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1.5px] text-[var(--color-neutral-500)]">
        {label}
      </span>
      <span className="text-right text-[15px] text-[var(--color-brand-cream)]">
        {value}
      </span>
    </motion.div>
  );
}

export function PackageView({ data }: { data: PackageData }) {
  const shouldReduceMotion = useReducedMotion();
  const state = stateDisplay(data.subscriptionState);

  const typeLabel =
    data.dealType === "saas" && data.productName
      ? data.productName
      : data.dealType === "project"
        ? "project"
        : "retainer";

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "type", value: typeLabel },
  ];

  if (data.dealType === "saas" && data.tierName) {
    rows.push({ label: "tier", value: data.tierName });
  }

  if (data.valueCents != null) {
    rows.push({
      label: "value",
      value: (
        <span>
          {formatCents(data.valueCents)}
          <span className="ml-1 text-[13px] text-[var(--color-neutral-500)]">
            / {data.billingCadence === "annual_upfront" ? "year" : "month"}
          </span>
        </span>
      ),
    });
  }

  rows.push({ label: "billing", value: formatCadence(data.billingCadence) });

  rows.push({
    label: "status",
    value: (
      <span className="inline-flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: state.color }}
        />
        {state.label}
      </span>
    ),
  });

  if (data.committedUntilMs) {
    rows.push({
      label: "commitment",
      value: `until ${formatDate(data.committedUntilMs)}`,
    });
  }

  if (data.pauseUsed) {
    rows.push({
      label: "pause",
      value: (
        <span className="text-[var(--color-neutral-500)]">
          used this period
        </span>
      ),
    });
  }

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
            your plan
          </span>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-3xl leading-none text-[var(--color-brand-cream)] sm:text-4xl">
            Package
          </h1>
        </div>
        <span className="font-[family-name:var(--font-playfair-display)] text-[14px] italic text-[var(--color-neutral-500)] sm:text-[15px]">
          your subscription and billing.
        </span>
      </motion.div>

      <div className="pb-12 pt-6">
        {rows.map((row, i) => (
          <DetailRow key={row.label} label={row.label} value={row.value} index={i} />
        ))}
      </div>
    </div>
  );
}
