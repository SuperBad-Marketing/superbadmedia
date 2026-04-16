"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type {
  SupportTicketType,
  TicketStatus,
} from "@/lib/db/schema/messages";
import {
  setTicketStatusAction,
  setTicketTypeAction,
} from "../ticket/actions";

/**
 * Support@ ticket chrome — sits above the thread detail. Type chip +
 * status pill are both clickable to reclassify (spec §4.3). Close-ticket
 * lives inside the composer (brief §3 — alongside Send), not here.
 *
 * Both dropdowns animate with `houseSpring` per AUTONOMY_PROTOCOL §G3
 * (Tier-1 motion). `useReducedMotion` downgrades to a quick fade.
 *
 * §16 #60: this component controls its own dropdown state only. It does
 * not own the composer or the Customer Context panel, so toggling either
 * chip/pill cannot unmount the ReplyComposer — the composer lives in
 * ThreadDetail alongside this overlay, not inside it.
 */

type TicketTypeOption = {
  value: SupportTicketType;
  label: string;
  blurb: string;
};

const TYPE_OPTIONS: readonly TicketTypeOption[] = [
  { value: "billing", label: "Billing", blurb: "Invoice, card, charge, plan change" },
  { value: "bug", label: "Bug", blurb: "Something's broken or misbehaving" },
  { value: "question", label: "Question", blurb: "How-to, where-to, does-it-do-X" },
  { value: "feedback", label: "Feedback", blurb: "Praise, complaint, suggestion" },
  { value: "refund", label: "Refund", blurb: "They want money back" },
  { value: "other", label: "Other", blurb: "Doesn't fit the buckets" },
];

type StatusOption = {
  value: TicketStatus;
  label: string;
  dotClass: string;
};

const STATUS_OPTIONS: readonly StatusOption[] = [
  {
    value: "open",
    label: "Open",
    dotClass: "bg-[color:var(--color-accent-cta)]",
  },
  {
    value: "waiting_on_customer",
    label: "Waiting on customer",
    dotClass: "bg-[color:var(--color-brand-pink)]",
  },
  {
    value: "resolved",
    label: "Resolved",
    dotClass: "bg-[color:var(--color-neutral-500)]",
  },
];

export interface TicketOverlayProps {
  threadId: string;
  ticketType: SupportTicketType | null;
  ticketStatus: TicketStatus;
  ticketTypeAssignedBy: "claude" | "andy" | null;
}

export function TicketOverlay({
  threadId,
  ticketType,
  ticketStatus,
  ticketTypeAssignedBy,
}: TicketOverlayProps) {
  const [localType, setLocalType] = React.useState<SupportTicketType | null>(
    ticketType,
  );
  const [localStatus, setLocalStatus] = React.useState<TicketStatus>(ticketStatus);
  const [localAssignedBy, setLocalAssignedBy] = React.useState<
    "claude" | "andy" | null
  >(ticketTypeAssignedBy);

  React.useEffect(() => {
    setLocalType(ticketType);
  }, [ticketType]);
  React.useEffect(() => {
    setLocalStatus(ticketStatus);
  }, [ticketStatus]);
  React.useEffect(() => {
    setLocalAssignedBy(ticketTypeAssignedBy);
  }, [ticketTypeAssignedBy]);

  const onType = React.useCallback(
    async (next: SupportTicketType) => {
      const prev = localType;
      const prevAssignedBy = localAssignedBy;
      setLocalType(next);
      setLocalAssignedBy("andy");
      try {
        await setTicketTypeAction({ threadId, type: next });
      } catch (err) {
        console.error("[ticket-overlay] setTicketType failed:", err);
        setLocalType(prev);
        setLocalAssignedBy(prevAssignedBy);
      }
    },
    [localType, localAssignedBy, threadId],
  );

  const onStatus = React.useCallback(
    async (next: TicketStatus) => {
      const prev = localStatus;
      setLocalStatus(next);
      try {
        await setTicketStatusAction({ threadId, status: next });
      } catch (err) {
        console.error("[ticket-overlay] setTicketStatus failed:", err);
        setLocalStatus(prev);
      }
    },
    [localStatus, threadId],
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] px-6 py-3">
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Ticket
      </span>
      <TypeChip
        value={localType}
        assignedBy={localAssignedBy}
        onChange={onType}
      />
      <StatusPill value={localStatus} onChange={onStatus} />
    </div>
  );
}

function TypeChip({
  value,
  assignedBy,
  onChange,
}: {
  value: SupportTicketType | null;
  assignedBy: "claude" | "andy" | null;
  onChange: (next: SupportTicketType) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = TYPE_OPTIONS.find((o) => o.value === value);
  const label = current?.label ?? "Classifying…";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={
          assignedBy === "claude"
            ? "Claude picked this. Click to re-classify."
            : assignedBy === "andy"
              ? "You picked this. Click to change."
              : "Click to set the ticket type."
        }
        className={cn(
          "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-2.5 py-1",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]",
          "outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
        )}
      >
        {assignedBy === "claude" && (
          <Sparkles
            size={10}
            strokeWidth={1.75}
            aria-hidden
            className="text-[color:var(--color-brand-pink)]"
          />
        )}
        <span>{label}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className="text-[color:var(--color-neutral-500)]"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={reducedMotion ? { duration: 0.12 } : houseSpring}
            className={cn(
              "absolute left-0 top-[calc(100%+4px)] z-20 min-w-[220px]",
              "overflow-hidden rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)] shadow-lg",
            )}
          >
            {TYPE_OPTIONS.map((opt) => {
              const selected = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setOpen(false);
                      if (!selected) onChange(opt.value);
                    }}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-[color:var(--color-neutral-700)] px-3 py-2 text-left last:border-b-0",
                      "outline-none transition-colors hover:bg-[color:var(--color-surface-3)]",
                      "focus-visible:bg-[color:var(--color-surface-3)]",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]">
                      {opt.label}
                      {selected && (
                        <Check
                          size={12}
                          strokeWidth={1.75}
                          aria-hidden
                          className="text-[color:var(--color-accent-cta)]"
                        />
                      )}
                    </span>
                    <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
                      {opt.blurb}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusPill({
  value,
  onChange,
}: {
  value: TicketStatus;
  onChange: (next: TicketStatus) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Click to change the status."
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-[color:var(--color-neutral-700)] px-3 py-1",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]",
          "outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
        )}
      >
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", current.dotClass)} />
        <span>{current.label}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className="text-[color:var(--color-neutral-500)]"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={reducedMotion ? { duration: 0.12 } : houseSpring}
            className={cn(
              "absolute left-0 top-[calc(100%+4px)] z-20 min-w-[200px]",
              "overflow-hidden rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)] shadow-lg",
            )}
          >
            {STATUS_OPTIONS.map((opt) => {
              const selected = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setOpen(false);
                      if (!selected) onChange(opt.value);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b border-[color:var(--color-neutral-700)] px-3 py-2 text-left last:border-b-0",
                      "outline-none transition-colors hover:bg-[color:var(--color-surface-3)]",
                      "focus-visible:bg-[color:var(--color-surface-3)]",
                    )}
                  >
                    <span className="flex items-center gap-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]">
                      <span
                        aria-hidden
                        className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)}
                      />
                      {opt.label}
                    </span>
                    {selected && (
                      <Check
                        size={12}
                        strokeWidth={1.75}
                        aria-hidden
                        className="text-[color:var(--color-accent-cta)]"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
