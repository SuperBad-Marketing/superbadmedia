"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import type { DealStage, DealWonOutcome } from "@/lib/db/schema/deals";
import { WonBadge } from "./won-badge";

export interface PipelineCardDeal {
  id: string;
  stage: DealStage;
  title: string;
  value_cents: number | null;
  value_estimated: boolean;
  won_outcome: DealWonOutcome | null;
  next_action_text: string | null;
  is_stale: boolean;
  company_name: string;
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
}: {
  deal: PipelineCardDeal;
  isDragging: boolean;
  onQuickAction: (kind: "nudge" | "open" | "snooze", dealId: string) => void;
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

  return (
    <div
      data-slot="pipeline-card"
      data-stale={deal.is_stale ? "true" : undefined}
      onMouseEnter={startHover}
      onMouseLeave={endHover}
      className={cn(
        "relative rounded-[var(--radius-default)] border border-border/50 bg-card p-3 shadow-sm",
        deal.is_stale &&
          "[box-shadow:0_0_0_2px_color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
        isDragging && "opacity-40",
      )}
    >
      {deal.stage === "won" && deal.won_outcome ? (
        <div className="absolute right-2 top-2">
          <WonBadge outcome={deal.won_outcome} />
        </div>
      ) : null}

      <div className="pr-14">
        <div className="font-heading text-sm font-semibold leading-tight">
          {deal.company_name}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {deal.title}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono text-xs",
            !deal.value_estimated && deal.value_cents != null && "font-semibold",
          )}
        >
          {formatValue(deal.value_cents, deal.value_estimated)}
        </span>
        {deal.next_action_text ? (
          <span className="font-serif text-[11px] italic text-muted-foreground line-clamp-1">
            {deal.next_action_text}
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
            className="mt-3 border-t border-border/40 pt-2 text-[11px]"
          >
            {deal.contact_name ? (
              <div className="text-foreground">
                <span className="font-medium">{deal.contact_name}</span>
                {deal.contact_role ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {deal.contact_role}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="italic text-muted-foreground">No primary contact.</div>
            )}
            {deal.last_activity_label ? (
              <div className="mt-0.5 text-muted-foreground">
                Last activity {deal.last_activity_label}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <QuickAction
                onClick={() => onQuickAction("nudge", deal.id)}
                label="Send nudge"
              />
              <QuickAction
                onClick={() => onQuickAction("open", deal.id)}
                label="Open detail"
              />
              <QuickAction
                onClick={() => onQuickAction("snooze", deal.id)}
                label="Snooze"
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
      className="rounded-sm border border-border/50 bg-background px-2 py-0.5 text-[10px] text-foreground/80 transition-colors hover:bg-muted"
    >
      {label}
    </button>
  );
}
