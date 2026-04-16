"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type { SupportCustomerContext } from "../_queries/load-support-customer-context";
import { CustomerContextPanel } from "./customer-context-panel";

/**
 * Bottom-sheet variant of UI-10's CustomerContextPanel for mobile
 * support@ threads (spec §4.5 ticket overlay mobile variant). Opens from
 * the "Details" button in the ticket overlay. Drag-to-dismiss is handled
 * by the backdrop tap + close button (keeps scoped to vaul-less build —
 * the core reuse target here is the panel, not the sheet chrome).
 *
 * Panel renders with `defaultOpen` so the subscription / usage / activity
 * blocks are immediately visible — no second expand tap.
 */
export function MobileCustomerContextSheet({
  open,
  onClose,
  contactName,
  context,
}: {
  open: boolean;
  onClose: () => void;
  contactName: string | null;
  context: SupportCustomerContext;
}) {
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ctx-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            key="ctx-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Customer context"
            initial={reducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            transition={reducedMotion ? { duration: 0.18 } : houseSpring}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col rounded-t-2xl",
              "border-t border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] shadow-2xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--color-neutral-700)] px-5 py-3">
              <div
                aria-hidden
                className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[color:var(--color-neutral-600)]"
              />
              <span
                className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "2px" }}
              >
                Details
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="rounded-sm p-2 text-[color:var(--color-neutral-300)] outline-none hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]"
              >
                <X size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CustomerContextPanel
                contactName={contactName}
                context={context}
                defaultOpen
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
