"use client";

/**
 * SB-2c — archive / un-archive controls for a published SaaS product.
 * Muted, not primary — this is a destructive-adjacent action per
 * `feedback_primary_action_focus`. Visual chrome polished in admin-polish-2.
 */
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import {
  archiveSaasProductAction,
  unarchiveSaasProductAction,
} from "../../actions-archive";

type Mode = "archive" | "unarchive";

export function ArchiveButtonClient({
  productId,
  mode,
}: {
  productId: string;
  mode: Mode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label = mode === "archive" ? "Archive" : "Un-archive";
  const title =
    mode === "archive" ? "Archive this product?" : "Un-archive this product?";
  const body =
    mode === "archive"
      ? "It'll disappear from the customer picker. Existing subscribers keep billing at their current Stripe Prices — those stay active. You can un-archive later."
      : "It'll show up for new subscribers again. New customers will subscribe to the current active Prices. Archived Prices stay billable for existing subscribers.";

  function submit() {
    setError(null);
    startTransition(async () => {
      const run =
        mode === "archive"
          ? archiveSaasProductAction(productId)
          : unarchiveSaasProductAction(productId);
      const result = await run;
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.reason);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`product-${mode}-button`}
        className="inline-flex h-9 items-center rounded-md border border-[color:var(--color-neutral-600)]/60 bg-transparent px-3 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[color:rgba(253,245,230,0.04)] hover:text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{ background: "rgba(15, 15, 14, 0.8)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${mode}-modal-title`}
              className="w-full max-w-md rounded-[12px] p-6"
              style={{
                background: "var(--color-surface-2)",
                boxShadow:
                  "var(--surface-highlight), 0 20px 60px -20px rgba(0,0,0,0.6)",
              }}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={houseSpring}
            >
              <h2
                id={`${mode}-modal-title`}
                className="font-[family-name:var(--font-display)] text-[22px] leading-none text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "-0.2px" }}
              >
                {title}
              </h2>
              <p className="mt-3 text-[14px] leading-[1.55] text-[color:var(--color-neutral-300)]">
                {body}
              </p>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-[8px] px-3 py-2 text-[13px]"
                  style={{
                    background: "rgba(178, 40, 72, 0.12)",
                    color: "var(--color-brand-pink)",
                    border: "1px solid rgba(178, 40, 72, 0.25)",
                  }}
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md px-3 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  data-testid={`product-${mode}-confirm`}
                  className="inline-flex h-9 items-center rounded-md px-4 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-95 disabled:opacity-50"
                  style={{
                    letterSpacing: "1.5px",
                    background: "var(--color-brand-red)",
                    boxShadow:
                      "var(--surface-highlight), 0 0 0 1px rgba(178,40,72,0.35)",
                  }}
                >
                  {pending ? "Working…" : label}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
