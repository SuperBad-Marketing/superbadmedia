"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DollarSignIcon, FilmIcon, SparklesIcon, LayersIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

export interface MonthlyCostData {
  month: string;
  higgsfield: number;
  remotion: number;
  composite: number;
  totalJobs: number;
  totalCostAud: number;
}

interface CostDashboardProps {
  data: MonthlyCostData[];
  loading: boolean;
}

export function CostDashboard({ data, loading }: CostDashboardProps) {
  const shouldReduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: "var(--color-neutral-800)",
          border: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <div
          className="font-[family-name:var(--font-body)] text-[13px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Loading cost data...
        </div>
      </div>
    );
  }

  const current = data[0];
  const previous = data[1];
  const totalAllTime = data.reduce((sum, d) => sum + d.totalCostAud, 0);
  const delta =
    current && previous && previous.totalCostAud > 0
      ? ((current.totalCostAud - previous.totalCostAud) / previous.totalCostAud) * 100
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DollarSignIcon
          className="size-3.5"
          style={{ color: "var(--color-brand-orange)" }}
        />
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Generation costs
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="This month"
          value={current ? `$${current.totalCostAud.toFixed(2)}` : "$0.00"}
          detail={current ? `${current.totalJobs} renders` : "0 renders"}
          delta={delta}
          shouldReduceMotion={shouldReduceMotion ?? false}
          delay={0}
        />
        <StatCard
          label="All time"
          value={`$${totalAllTime.toFixed(2)}`}
          detail={`${data.reduce((s, d) => s + d.totalJobs, 0)} total renders`}
          shouldReduceMotion={shouldReduceMotion ?? false}
          delay={0.03}
        />
        <StatCard
          label="Avg per render"
          value={
            current && current.totalJobs > 0
              ? `$${(current.totalCostAud / current.totalJobs).toFixed(2)}`
              : "$0.00"
          }
          detail="Higgsfield jobs only"
          shouldReduceMotion={shouldReduceMotion ?? false}
          delay={0.06}
        />
      </div>

      {/* Engine breakdown for current month */}
      {current && current.totalJobs > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <span
            className="mb-3 block font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            This month by engine
          </span>
          <div className="space-y-2">
            <EngineRow
              icon={FilmIcon}
              label="Cinematic (Higgsfield)"
              count={current.higgsfield}
              cost={current.higgsfield * 0.75}
              color="var(--color-brand-orange)"
            />
            <EngineRow
              icon={SparklesIcon}
              label="Animated (Remotion)"
              count={current.remotion}
              cost={0}
              color="#7BAE7E"
            />
            <EngineRow
              icon={LayersIcon}
              label="Composite"
              count={current.composite}
              cost={current.composite * 0.8}
              color="var(--color-brand-pink)"
            />
          </div>
        </div>
      )}

      {/* Monthly bars */}
      {data.length > 1 && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <span
            className="mb-3 block font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Monthly trend
          </span>
          <div className="flex items-end gap-1" style={{ height: 64 }}>
            {data
              .slice()
              .reverse()
              .map((d, i) => {
                const maxCost = Math.max(...data.map((x) => x.totalCostAud), 1);
                const height = (d.totalCostAud / maxCost) * 100;
                return (
                  <div
                    key={d.month}
                    className="group relative flex-1"
                    style={{ height: "100%" }}
                  >
                    <div
                      className="absolute bottom-0 w-full rounded-t"
                      style={{
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor:
                          i === data.length - 1
                            ? "var(--color-brand-orange)"
                            : "rgba(242, 140, 82, 0.3)",
                      }}
                    />
                    <div
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-[family-name:var(--font-body)] text-[8px] tabular-nums"
                      style={{ color: "var(--color-neutral-600)" }}
                    >
                      {d.month.slice(5)}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  delta,
  shouldReduceMotion,
  delay,
}: {
  label: string;
  value: string;
  detail: string;
  delta?: number | null;
  shouldReduceMotion: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { ...houseSpring, delay }
      }
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-neutral-800)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="font-[family-name:var(--font-display)] text-[24px] tabular-nums leading-none"
          style={{ color: "var(--color-brand-cream)" }}
        >
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <span
            className="font-[family-name:var(--font-body)] text-[11px] tabular-nums"
            style={{
              color: delta <= 0 ? "#7BAE7E" : "var(--color-brand-orange)",
            }}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(0)}%
          </span>
        )}
      </div>
      <div
        className="mt-1 font-[family-name:var(--font-body)] text-[11px]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {detail}
      </div>
    </motion.div>
  );
}

function EngineRow({
  icon: Icon,
  label,
  count,
  cost,
  color,
}: {
  icon: typeof FilmIcon;
  label: string;
  count: number;
  cost: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="size-3" style={{ color }} />
        <span
          className="font-[family-name:var(--font-body)] text-[12px]"
          style={{ color: "var(--color-neutral-400)" }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="font-[family-name:var(--font-body)] text-[11px] tabular-nums"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {count} job{count !== 1 ? "s" : ""}
        </span>
        <span
          className="font-[family-name:var(--font-body)] text-[12px] tabular-nums font-medium"
          style={{ color }}
        >
          ${cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
