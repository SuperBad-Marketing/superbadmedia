"use client";

/**
 * SB-2c — archive / un-archive controls for a published SaaS product.
 * Muted, not primary — this is a destructive-adjacent action per
 * `feedback_primary_action_focus`.
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
        className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition hover:bg-muted"
      >
        {label}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
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
              className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={houseSpring}
            >
              <h2
                id={`${mode}-modal-title`}
                className="font-heading text-lg font-semibold"
              >
                {title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>

              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  data-testid={`product-${mode}-confirm`}
                  className="inline-flex h-9 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
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
