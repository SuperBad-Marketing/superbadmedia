"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import type { CandidateStage } from "@/lib/db/schema/candidates";

export interface HiringCardCandidate {
  id: string;
  stage: CandidateStage;
  stage_before_archive: string | null;
  name: string;
  role_brief_id: string | null;
  role_name: string | null;
  source: string;
  location_city: string | null;
  rate_display: string | null;
  brief_match_score: number | null;
  portfolio_platforms: string[];
  is_stale: boolean;
  last_activity_label: string | null;
  followup_question: string | null;
  followup_reply: string | null;
  compliance_ok: boolean;
  compliance_missing: string[];
  trial_summary: string | null;
  trial_due_label: string | null;
  trial_disposition: string | null;
}

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };
const HOVER_INTENT_DELAY_MS = 300;

const SOURCE_LABELS: Record<string, string> = {
  auto_discovered: "Discovered",
  applied: "Applied",
  sourced: "Sourced",
  referred: "Referred",
};

const PLATFORM_LABELS: Record<string, string> = {
  vimeo: "Vi",
  behance: "Be",
  dribbble: "Dr",
  arena: "Ar",
  youtube: "YT",
  instagram: "IG",
  linkedin: "Li",
  tiktok: "TT",
  personal: "Web",
};

function scoreColor(score: number): string {
  if (score >= 0.8) return "var(--color-brand-pink)";
  if (score >= 0.5) return "var(--color-neutral-300)";
  return "var(--color-neutral-500)";
}

export function CandidateCard({
  candidate,
  isDragging,
  onSkipTrial,
}: {
  candidate: HiringCardCandidate;
  isDragging: boolean;
  onSkipTrial?: (candidateId: string) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHover = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(true), HOVER_INTENT_DELAY_MS);
  };
  const endHover = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHover(false);
  };

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const isStale = candidate.is_stale;

  return (
    <div
      data-slot="hiring-card"
      data-stale={isStale ? "true" : undefined}
      onMouseEnter={startHover}
      onMouseLeave={endHover}
      className={cn(
        "group relative flex flex-col gap-3 rounded-[12px] px-5 py-[18px]",
        "transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        !isStale && "hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]",
        isDragging && "opacity-40",
      )}
      style={{
        background: isStale ? "rgba(34, 34, 31, 0.5)" : "var(--color-surface-2)",
        border: isStale
          ? "1px dashed rgba(128, 127, 115, 0.35)"
          : "1px solid transparent",
        boxShadow: isStale ? "none" : "var(--surface-highlight)",
      }}
    >
      {isStale ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[12px]"
          style={{
            animation: "stale-halo 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite",
          }}
        />
      ) : null}

      {/* Tier 1 — always visible */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-[family-name:var(--font-body)] text-[16px] font-medium leading-[1.3] truncate",
              isStale
                ? "text-[color:var(--color-neutral-300)]"
                : "text-[color:var(--color-brand-cream)]",
            )}
          >
            {candidate.name}
          </div>
          {candidate.role_name ? (
            <div
              className={cn(
                "mt-1 text-[12px] italic line-clamp-1",
                isStale
                  ? "text-[color:var(--color-neutral-500)]"
                  : "text-[color:var(--color-brand-pink)]",
              )}
            >
              {candidate.role_name}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {candidate.portfolio_platforms.map((p) => (
            <span
              key={p}
              className="rounded-sm bg-[color:var(--color-surface-3)] px-1 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-400)]"
              style={{ letterSpacing: "1px" }}
            >
              {PLATFORM_LABELS[p] ?? p}
            </span>
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t pt-[10px] text-[12px] text-[color:var(--color-neutral-500)]"
        style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {candidate.rate_display ? (
            <span className="font-[family-name:var(--font-body)] tabular-nums text-[color:var(--color-neutral-300)]">
              {candidate.rate_display}
            </span>
          ) : null}
          {candidate.location_city ? (
            <>
              {candidate.rate_display ? (
                <span aria-hidden className="text-[color:var(--color-neutral-600)]">
                  ·
                </span>
              ) : null}
              <span>{candidate.location_city}</span>
            </>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {candidate.brief_match_score != null ? (
            <span
              className="rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[10px] tabular-nums"
              style={{
                letterSpacing: "1px",
                color: scoreColor(candidate.brief_match_score),
                border: `1px solid ${scoreColor(candidate.brief_match_score)}`,
                opacity: 0.7,
              }}
            >
              {Math.round(candidate.brief_match_score * 100)}%
            </span>
          ) : null}
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1px" }}
          >
            {SOURCE_LABELS[candidate.source] ?? candidate.source}
          </span>
        </span>
      </div>

      {/* Tier 2 — expanded on hover */}
      <AnimatePresence>
        {hover && !isDragging ? (
          <motion.div
            key="hover-overlay"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: HOUSE_SPRING }}
            exit={{ opacity: 0, y: 2, transition: { duration: 0.12 } }}
            className="border-t pt-[10px] text-[11px]"
            style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
          >
            {candidate.followup_question && candidate.followup_reply ? (
              <div className="mb-2 text-[color:var(--color-neutral-400)]">
                <span className="text-[color:var(--color-neutral-500)]">Q: </span>
                <span className="line-clamp-1">{candidate.followup_question}</span>
                <span className="text-[color:var(--color-neutral-500)]">A: </span>
                <span className="line-clamp-1">{candidate.followup_reply}</span>
              </div>
            ) : null}

            {!candidate.compliance_ok &&
            (candidate.stage === "screened" ||
              candidate.stage === "trial" ||
              candidate.stage === "bench") ? (
              <div className="mb-2 text-[color:var(--color-neutral-500)]">
                Missing:{" "}
                <span className="text-[color:var(--color-brand-pink)]">
                  {candidate.compliance_missing.join(", ")}
                </span>
              </div>
            ) : null}

            {candidate.trial_summary ? (
              <div className="mb-2 text-[color:var(--color-neutral-400)]">
                <span className="line-clamp-1">{candidate.trial_summary}</span>
                {candidate.trial_due_label ? (
                  <span className="text-[color:var(--color-neutral-500)]">
                    {" "}· {candidate.trial_due_label}
                  </span>
                ) : null}
                {candidate.trial_disposition ? (
                  <span className="ml-1 rounded-sm bg-[color:var(--color-surface-3)] px-1 py-0.5 text-[10px] uppercase text-[color:var(--color-neutral-400)]">
                    {candidate.trial_disposition}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {candidate.last_activity_label ? (
                <span className="text-[color:var(--color-neutral-500)]">
                  {candidate.last_activity_label}
                </span>
              ) : null}
              {candidate.stage === "screened" && onSkipTrial ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkipTrial(candidate.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="rounded-sm border border-[color:var(--color-neutral-600)]/60 bg-transparent px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)] transition-colors hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-brand-cream)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Skip trial
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
