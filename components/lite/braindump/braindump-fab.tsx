"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PenSquare } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { BraindumpModal } from "./braindump-modal";
import type { SurfaceContext } from "@/lib/ai/parse-braindump";

const PULSE_STORAGE_KEY = "braindump-last-used-date";

function hasUsedToday(): boolean {
  try {
    return localStorage.getItem(PULSE_STORAGE_KEY) === new Date().toDateString();
  } catch {
    return false;
  }
}

function markUsedToday(): void {
  try {
    localStorage.setItem(PULSE_STORAGE_KEY, new Date().toDateString());
  } catch {
    // localStorage unavailable
  }
}

export function BraindumpFab({
  surfaceContext,
}: {
  surfaceContext?: SurfaceContext;
}) {
  const [open, setOpen] = React.useState(false);
  const [shouldPulse, setShouldPulse] = React.useState(false);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    if (!hasUsedToday()) {
      setShouldPulse(true);
    }
  }, []);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpen = React.useCallback(() => {
    setOpen(true);
    setShouldPulse(false);
    markUsedToday();
  }, []);

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <motion.button
        type="button"
        onClick={handleOpen}
        aria-label="Open braindump"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-100)] shadow-lg outline-none transition-colors hover:bg-[color:var(--color-surface-3)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-0)]"
        initial={false}
        animate={
          shouldPulse && !reducedMotion
            ? {
                boxShadow: [
                  "0 0 0 0 rgba(178, 40, 72, 0)",
                  "0 0 0 8px rgba(178, 40, 72, 0.25)",
                  "0 0 0 0 rgba(178, 40, 72, 0)",
                ],
              }
            : {}
        }
        transition={
          shouldPulse
            ? { duration: 2, repeat: 0, ease: "easeInOut" }
            : houseSpring
        }
      >
        <PenSquare size={20} strokeWidth={1.5} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <BraindumpModal
            onClose={handleClose}
            surfaceContext={surfaceContext ?? null}
          />
        )}
      </AnimatePresence>
    </>
  );
}
