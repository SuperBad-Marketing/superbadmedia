"use client";

import type { MtdSummary } from "@/lib/observatory/queries/dashboard";

function formatAud(value: number): string {
  return `$${value.toFixed(2)}`;
}

function thresholdColor(
  mtd: number,
  thresholds: Array<number | null>,
): string {
  const active = thresholds.filter((t): t is number => t != null).sort((a, b) => a - b);
  if (active.length === 0) return "var(--color-success)";
  if (mtd >= active[active.length - 1]) return "var(--color-error)";
  if (active.length >= 2 && mtd >= active[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

function projectionBarPercent(
  value: number,
  thresholds: Array<number | null>,
): number {
  const active = thresholds.filter((t): t is number => t != null).sort((a, b) => a - b);
  const maxRef = active.length > 0 ? active[active.length - 1] * 1.3 : value * 1.5;
  if (maxRef <= 0) return 0;
  return Math.min((value / maxRef) * 100, 100);
}

export function PlatformStatusPanel({ mtd }: { mtd: MtdSummary }) {
  const fillColor = thresholdColor(mtd.total_aud, mtd.thresholds);
  const mtdPercent = projectionBarPercent(mtd.total_aud, mtd.thresholds);
  const projPercent = projectionBarPercent(mtd.projection_aud, mtd.thresholds);

  const activeThresholds = mtd.thresholds
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  const barMax =
    activeThresholds.length > 0
      ? activeThresholds[activeThresholds.length - 1] * 1.3
      : Math.max(mtd.projection_aud, mtd.total_aud) * 1.5;

  const weekTotal = mtd.daily_totals.slice(-7).reduce((s, d) => s + d.total, 0);
  const prevWeekTotal = mtd.daily_totals.slice(-14, -7).reduce((s, d) => s + d.total, 0);
  const weekDelta =
    prevWeekTotal > 0
      ? ((weekTotal - prevWeekTotal) / prevWeekTotal) * 100
      : 0;

  return (
    <section
      className="rounded-[var(--radius-generous)] p-5"
      style={{ background: "var(--color-surface-1)" }}
    >
      <h2
        className="font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
      >
        Platform Status
      </h2>

      <div className="mt-4 grid grid-cols-3 gap-6">
        {/* MTD spend */}
        <div>
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            MTD Spend
          </div>
          <div
            className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none"
            style={{ color: fillColor }}
          >
            {formatAud(mtd.total_aud)}
          </div>
          <div
            className="mt-1 text-[12px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Day {mtd.days_elapsed} of {mtd.days_in_month}
          </div>
        </div>

        {/* Projection */}
        <div>
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Projected
          </div>
          <div
            className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none"
            style={{ color: "var(--color-neutral-700)" }}
          >
            {formatAud(mtd.projection_aud)}
          </div>
          <div
            className="mt-1 text-[12px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Linear run-rate
          </div>
        </div>

        {/* Weekly delta */}
        <div>
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Week vs Prior
          </div>
          <div
            className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none"
            style={{
              color:
                weekDelta > 20
                  ? "var(--color-warning)"
                  : weekDelta < -20
                    ? "var(--color-success)"
                    : "var(--color-neutral-700)",
            }}
          >
            {weekDelta >= 0 ? "+" : ""}
            {weekDelta.toFixed(0)}%
          </div>
          <div
            className="mt-1 text-[12px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {formatAud(weekTotal)} this week
          </div>
        </div>
      </div>

      {/* Threshold bar */}
      <div className="mt-5">
        <div
          className="relative h-3 w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-surface-2)" }}
        >
          {/* MTD fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{
              width: `${mtdPercent}%`,
              background: fillColor,
            }}
          />
          {/* Projection dashed line */}
          {mtd.projection_aud > mtd.total_aud && (
            <div
              className="absolute inset-y-0"
              style={{
                left: `${mtdPercent}%`,
                width: `${Math.max(projPercent - mtdPercent, 0)}%`,
                borderRight: `2px dashed var(--color-neutral-500)`,
                opacity: 0.5,
              }}
            />
          )}
          {/* Threshold ticks */}
          {activeThresholds.map((t) => {
            const pct = barMax > 0 ? (t / barMax) * 100 : 0;
            return (
              <div
                key={t}
                className="absolute inset-y-0 w-[2px]"
                style={{
                  left: `${pct}%`,
                  background: "var(--color-neutral-700)",
                  opacity: 0.6,
                }}
                title={`Threshold: ${formatAud(t)}`}
              />
            );
          })}
        </div>
        {activeThresholds.length > 0 && (
          <div className="mt-1 flex justify-between">
            <span
              className="text-[10px]"
              style={{ color: "var(--color-neutral-500)" }}
            >
              $0
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--color-neutral-500)" }}
            >
              {formatAud(activeThresholds[activeThresholds.length - 1])}
            </span>
          </div>
        )}
      </div>

      {/* Sparkline — daily totals */}
      {mtd.daily_totals.length > 1 && (
        <div className="mt-4">
          <DailySparkline data={mtd.daily_totals} />
        </div>
      )}
    </section>
  );
}

function DailySparkline({
  data,
}: {
  data: Array<{ date: string; total: number }>;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const width = 320;
  const height = 40;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data
    .map((d, i) => `${i * step},${height - (d.total / max) * (height - 4)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxWidth: 320, height: 40 }}
      role="img"
      aria-label="Daily spend sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-brand-red)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
