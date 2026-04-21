"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { AnomalyListItem } from "@/lib/observatory/queries/dashboard";

const TIER_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  severe: {
    bg: "rgba(178, 40, 72, 0.18)",
    color: "var(--color-error)",
    label: "SEVERE",
  },
  mid: {
    bg: "rgba(242, 140, 82, 0.18)",
    color: "var(--color-warning)",
    label: "MID",
  },
  low: {
    bg: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
    label: "LOW",
  },
};

function TierBadge({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.low;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}

function formatAud(value: number): string {
  return `$${value.toFixed(2)}`;
}

function AnomalyRow({ anomaly }: { anomaly: AnomalyListItem }) {
  return (
    <Link
      href={`/lite/observatory/anomalies/${anomaly.id}`}
      className="flex items-center gap-4 rounded-[var(--radius-default)] px-3 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <TierBadge tier={anomaly.tier} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className="truncate font-[family-name:var(--font-mono)] text-[13px]"
            style={{ color: "var(--color-neutral-900)" }}
          >
            {anomaly.job}
          </span>
          <span
            className="shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
          >
            {anomaly.detector.replace("_", " ")}
          </span>
        </div>
        {anomaly.diagnosis_snippet && (
          <p
            className="mt-0.5 truncate text-[13px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {anomaly.diagnosis_snippet}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div
          className="font-[family-name:var(--font-mono)] text-[13px]"
          style={{ color: "var(--color-neutral-700)" }}
        >
          {formatAud(anomaly.observed_value)}
        </div>
        <div
          className="text-[11px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {anomaly.fire_count}× ·{" "}
          {formatTimestamp(anomaly.last_fired_at_ms, undefined, {
            format: "relative",
          })}
        </div>
      </div>
    </Link>
  );
}

export function AnomaliesPanel({
  active,
  resolved,
}: {
  active: AnomalyListItem[];
  resolved: AnomalyListItem[];
}) {
  const [showResolved, setShowResolved] = useState(false);

  return (
    <section
      className="rounded-[var(--radius-generous)] p-5"
      style={{ background: "var(--color-surface-1)" }}
    >
      <div className="flex items-baseline justify-between">
        <h2
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          Live Anomalies
        </h2>
        <span
          className="text-[12px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {active.length} open
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {active.length === 0 && (
          <p
            className="py-6 text-center font-[family-name:var(--font-serif)] text-[14px] italic"
            style={{ color: "var(--color-neutral-500)" }}
          >
            No anomalies this week. Everything inside the bands.
          </p>
        )}
        {active.map((a) => (
          <AnomalyRow key={a.id} anomaly={a} />
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-surface-2)] pt-3">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
          </button>
          {showResolved && (
            <div className="mt-2 flex flex-col gap-1 opacity-60">
              {resolved.map((a) => (
                <AnomalyRow key={a.id} anomaly={a} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
