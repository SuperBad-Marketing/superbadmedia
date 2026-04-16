"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import type { DealStage, DealWonOutcome } from "@/lib/db/schema/deals";
import type { CompanyBillingMode } from "@/lib/db/schema/companies";
import { WonBadge } from "./won-badge";
import { SnoozePopover } from "./snooze-popover";

export interface PipelineCardDeal {
  id: string;
  stage: DealStage;
  title: string;
  value_cents: number | null;
  value_estimated: boolean;
  won_outcome: DealWonOutcome | null;
  next_action_text: string | null;
  is_stale: boolean;
  company_id: string;
  company_name: string;
  billing_mode: CompanyBillingMode;
  contact_name: string | null;
  contact_role: string | null;
  last_activity_label: string | null;
}

function formatValue(cents: number | null, estimated: boolean): string {
  if (cents == null) return estimated ? "est. —" : "—";
  const dollars = (cents / 100).toLocaleString("en-AU", {
    maximumFractionDigits: 0,
  });
  return estimated ? `est. $${dollars}` : `$${dollars}`;
}

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };
const HOVER_INTENT_DELAY_MS = 300;

export function DealCard({
  deal,
  isDragging,
  onQuickAction,
  onSnoozed,
  snoozeDefaultDays,
}: {
  deal: PipelineCardDeal;
  isDragging: boolean;
  onQuickAction: (kind: "nudge" | "open", dealId: string) => void;
  onSnoozed: (dealId: string, untilMs: number) => void;
  snoozeDefaultDays: number;
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

  const isStale = deal.is_stale;
  const valueLabel = formatValue(deal.value_cents, deal.value_estimated);

  return (
    <div
      data-slot="pipeline-card"
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
            animation:
              "stale-halo 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite",
          }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/lite/admin/companies/${deal.company_id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "block font-[family-name:var(--font-body)] text-[16px] font-medium leading-[1.3] truncate underline-offset-4 hover:underline transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              isStale
                ? "text-[color:var(--color-neutral-300)] hover:text-[color:var(--color-brand-cream)]"
                : "text-[color:var(--color-brand-cream)]",
            )}
          >
            {deal.company_name}
          </Link>
          <div
            className={cn(
              "mt-1 text-[12px] italic line-clamp-1",
              isStale
                ? "text-[color:var(--color-neutral-500)]"
                : "text-[color:var(--color-brand-pink)]",
            )}
          >
            {deal.title}
          </div>
        </div>
        {deal.stage === "won" && deal.won_outcome ? (
          <WonBadge outcome={deal.won_outcome} />
        ) : null}
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t pt-[10px] text-[12px] text-[color:var(--color-neutral-500)]"
        style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
      >
        <span className="min-w-0 flex-1 truncate">
          <span
            className={cn(
              "font-[family-name:var(--font-body)] tabular-nums",
              !deal.value_estimated &&
                deal.value_cents != null &&
                "font-medium text-[color:var(--color-neutral-300)]",
            )}
          >
            {valueLabel}
          </span>
          {deal.next_action_text ? (
            <>
              <span
                aria-hidden
                className="mx-2 text-[color:var(--color-neutral-600)]"
              >
                ·
              </span>
              <span className="text-[color:var(--color-neutral-500)]">
                {deal.next_action_text}
              </span>
            </>
          ) : null}
        </span>
        {deal.last_activity_label ? (
          <span
            className="shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1px" }}
          >
            {deal.last_activity_label}
          </span>
        ) : null}
      </div>

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
            {deal.contact_name ? (
              <div className="text-[color:var(--color-neutral-300)]">
                <span className="font-medium">{deal.contact_name}</span>
                {deal.contact_role ? (
                  <span className="text-[color:var(--color-neutral-500)]">
                    {" · "}
                    {deal.contact_role}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="text-[color:var(--color-neutral-500)] italic">
                No primary contact yet.
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <QuickAction
                onClick={() => onQuickAction("nudge", deal.id)}
                label="Send nudge"
              />
              <QuickAction
                onClick={() => onQuickAction("open", deal.id)}
                label="Open detail"
              />
              <SnoozePopover
                dealId={deal.id}
                defaultDays={snoozeDefaultDays}
                onSnoozed={(untilMs) => onSnoozed(deal.id, untilMs)}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function QuickAction({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="rounded-sm border border-[color:var(--color-neutral-600)]/60 bg-transparent px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)] transition-colors hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-brand-cream)]"
      style={{ letterSpacing: "1.5px" }}
    >
      {label}
    </button>
  );
}
