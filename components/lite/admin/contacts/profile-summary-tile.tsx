"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { SkeletonTile } from "@/components/lite/skeleton-tile";

interface ProfileSummaryTileProps {
  summary: string | null;
  summaryGeneratedAtMs: number | null;
  healthLabel: string;
  daysSinceLastContact: number;
  overdueYou: number;
  overdueThey: number;
  totalOpenItems: number;
  dealStage: string | null;
  hasUnsentDraft: boolean;
  lastContactDirection: "inbound" | "outbound" | null;
  loading?: boolean;
}

const HEALTH_COLORS: Record<string, { bg: string; color: string }> = {
  healthy: { bg: "rgba(123, 174, 126, 0.14)", color: "var(--color-success)" },
  cooling: { bg: "rgba(242, 140, 82, 0.14)", color: "var(--color-brand-orange)" },
  at_risk: { bg: "rgba(178, 40, 72, 0.14)", color: "var(--color-brand-red)" },
  stale: { bg: "rgba(128, 127, 115, 0.15)", color: "var(--color-neutral-500)" },
};

export function ProfileSummaryTile({
  summary,
  summaryGeneratedAtMs,
  healthLabel,
  daysSinceLastContact,
  overdueYou,
  overdueThey,
  totalOpenItems,
  dealStage,
  hasUnsentDraft,
  lastContactDirection,
  loading,
}: ProfileSummaryTileProps) {
  const reduced = useReducedMotion();

  if (loading) {
    return (
      <section
        aria-label="Context summary"
        className="rounded-[12px] p-5"
        style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Context summary
        </div>
        <div className="mt-3 space-y-2">
          <SkeletonTile className="h-4 w-full" />
          <SkeletonTile className="h-4 w-4/5" />
          <SkeletonTile className="h-4 w-3/5" />
        </div>
      </section>
    );
  }

  const health = HEALTH_COLORS[healthLabel] ?? HEALTH_COLORS.stale;

  const lastContactLabel = daysSinceLastContact === 0
    ? "today"
    : daysSinceLastContact === 1
      ? "1 day ago"
      : `${daysSinceLastContact} days ago`;

  return (
    <motion.section
      aria-label="Context summary"
      className="rounded-[12px] p-5"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0.01 } : { duration: 0.18, ease: "easeOut" }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        Context summary
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:gap-6">
        {/* Left — narrative */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.p
              key={summary ?? "empty"}
              className="font-[family-name:var(--font-body)] text-[14px] leading-[1.65] text-[color:var(--color-neutral-300)]"
              initial={reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? {} : { opacity: 0 }}
              transition={reduced ? { duration: 0.01 } : { duration: 0.3 }}
            >
              {summary ?? (
                <span className="italic text-[color:var(--color-neutral-500)]">
                  nothing here yet. they&apos;re a stranger.
                </span>
              )}
            </motion.p>
          </AnimatePresence>
          {summaryGeneratedAtMs && (
            <p className="mt-1.5 text-[10px] text-[color:var(--color-neutral-500)]">
              updated {formatRelativeTime(summaryGeneratedAtMs)}
            </p>
          )}
        </div>

        {/* Right — structured facts sidebar */}
        <div className="flex shrink-0 flex-col gap-2 sm:w-[180px] sm:border-l sm:border-[color:rgba(253,245,230,0.05)] sm:pl-5">
          <FactRow label="Last contact" value={lastContactLabel} />
          <FactRow
            label="Health"
            value={
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{ letterSpacing: "1.2px", background: health.bg, color: health.color }}
              >
                <span
                  aria-hidden
                  className="h-1 w-1 rounded-full"
                  style={{ background: "currentColor", opacity: 0.85 }}
                />
                {healthLabel.replace("_", " ")}
              </span>
            }
          />
          <FactRow
            label="Action items"
            value={totalOpenItems === 0
              ? "none"
              : `${overdueYou} yours, ${overdueThey} theirs`}
          />
          {dealStage && (
            <FactRow label="Deal" value={dealStage.replace(/_/g, " ")} />
          )}
          {hasUnsentDraft && (
            <FactRow
              label="Draft"
              value={
                <span className="flex items-center gap-1.5 text-[color:var(--color-brand-pink)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-brand-pink)] opacity-40" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-pink)]" />
                  </span>
                  unsent
                </span>
              }
            />
          )}
        </div>
      </div>
    </motion.section>
  );
}

function FactRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span
        className="shrink-0 font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.2px" }}
      >
        {label}
      </span>
      <span className="text-right text-[color:var(--color-neutral-300)]">
        {value}
      </span>
    </div>
  );
}

function formatRelativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
