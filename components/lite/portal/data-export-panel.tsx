"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { requestDataExport } from "@/app/lite/portal/[token]/data-export/actions";

type ExportState = "idle" | "requested" | "error";

export function DataExportPanel() {
  const shouldReduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ExportState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleRequest() {
    startTransition(async () => {
      const result = await requestDataExport();
      if (result.ok) {
        setState("requested");
      } else {
        setState("error");
        setErrorMsg(result.error ?? "something went wrong.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-[780px] px-4 md:px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="flex items-end justify-between border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10"
      >
        <div>
          <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
            your room
          </span>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-4xl leading-none text-[var(--color-brand-cream)]">
            Download My Data
          </h1>
        </div>
        <span className="font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
          export everything.
        </span>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { ...houseSpring, delay: 0.15 }
        }
        className="flex min-h-[40vh] items-center justify-center"
      >
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          {state === "idle" && (
            <>
              <p className="font-[family-name:var(--font-playfair-display)] text-lg italic text-[var(--color-brand-cream)]">
                request a copy of everything we hold for you — contacts, deals,
                invoices, Brand DNA, communications. delivered as a ZIP.
              </p>
              <button
                onClick={handleRequest}
                disabled={isPending}
                className="rounded-lg border border-[var(--color-brand-orange)] bg-transparent px-8 py-3 font-[family-name:var(--font-righteous)] text-sm uppercase tracking-[2px] text-[var(--color-brand-orange)] transition-colors hover:bg-[var(--color-brand-orange)] hover:text-[var(--color-brand-charcoal)] disabled:opacity-40"
              >
                {isPending ? "requesting…" : "export everything"}
              </button>
              <p className="text-xs italic text-[var(--color-neutral-500)]">
                one export per day. download link appears in your chat within a
                few minutes and expires after 7 days.
              </p>
            </>
          )}

          {state === "requested" && (
            <>
              <div className="grid h-16 w-16 place-items-center rounded-full border border-[rgba(253,245,230,0.08)] bg-[rgba(34,34,31,0.6)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-7 w-7 text-[var(--color-brand-orange)]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <p className="font-[family-name:var(--font-playfair-display)] text-lg italic text-[var(--color-brand-cream)]">
                export requested. a download link will appear in your chat
                shortly.
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <p className="font-[family-name:var(--font-playfair-display)] text-lg italic text-[var(--color-brand-cream)]">
                {errorMsg}
              </p>
              <button
                onClick={() => {
                  setState("idle");
                  setErrorMsg(null);
                }}
                className="text-sm text-[var(--color-brand-orange)] underline underline-offset-4"
              >
                try again
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
