"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PenSquare, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";

/**
 * Bottom sheet that surfaces when Andy taps "Compose" on the mobile
 * inbox (spec §4.5 — "nudge sheet discourages (better on desktop) but
 * allows"). Continue opens the full-screen compose; Cancel dismisses.
 *
 * Motion: house-spring slide from bottom + backdrop fade. Reduced-motion
 * downgrades to a fade.
 */
export function MobileComposeNudge({
  open,
  onContinue,
  onCancel,
}: {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="nudge-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onCancel}
          />
          <motion.div
            key="nudge-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-nudge-title"
            initial={reducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            transition={reducedMotion ? { duration: 0.18 } : houseSpring}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 rounded-t-2xl",
              "border-t border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]",
              "px-5 pb-6 pt-4 shadow-2xl",
            )}
          >
            <div
              aria-hidden
              className="mx-auto h-1 w-10 rounded-full bg-[color:var(--color-neutral-600)]"
            />
            <div className="flex items-start gap-3">
              <PenSquare
                size={20}
                strokeWidth={1.5}
                aria-hidden
                className="mt-1 shrink-0 text-[color:var(--color-brand-pink)]"
              />
              <div className="flex flex-1 flex-col gap-1">
                <span
                  className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "2px" }}
                >
                  Compose
                </span>
                <h2
                  id="compose-nudge-title"
                  className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]"
                >
                  Sure?
                </h2>
                <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
                  Mobile compose works, but desktop&rsquo;s kinder to your
                  thumbs.
                </em>
              </div>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Dismiss"
                className="rounded-sm p-2 text-[color:var(--color-neutral-300)] outline-none hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]"
              >
                <X size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className={cn(
                  "flex-1 rounded-sm border border-[color:var(--color-neutral-700)] px-4 py-2.5",
                  "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]",
                  "outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
                )}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={onContinue}
                className={cn(
                  "flex-1 rounded-sm px-4 py-2.5",
                  "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
                  "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                  "outline-none transition-[filter] hover:brightness-110",
                )}
              >
                Continue
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
