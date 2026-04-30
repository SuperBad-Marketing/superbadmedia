"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { neutral, brand, houseSpring } from "@/lib/design-tokens";

type Placement = "top" | "hero" | "content" | "footer" | "bottom";

interface PublicEggMarginNoteProps {
  eggId: string;
  placement: Placement;
  children: React.ReactNode;
}

const DISPLAY_MS = 7000;

const PLACEMENT_CLASSES: Record<Placement, string> = {
  top: "fixed top-8 left-0 right-0 z-40",
  hero: "fixed top-24 left-0 right-0 z-40",
  content: "fixed top-1/3 left-0 right-0 z-40",
  footer: "fixed bottom-24 left-0 right-0 z-40",
  bottom: "fixed bottom-8 left-0 right-0 z-40",
};

type Phase = "idle" | "showing" | "exiting";

export function PublicEggMarginNote({
  eggId,
  placement,
  children,
}: PublicEggMarginNoteProps) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleFired = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.eggId !== eggId) return;
      setPhase("showing");
    },
    [eggId],
  );

  useEffect(() => {
    window.addEventListener("public-egg-fired", handleFired);
    return () => window.removeEventListener("public-egg-fired", handleFired);
  }, [handleFired]);

  useEffect(() => {
    if (phase !== "showing") return;
    const timer = setTimeout(() => setPhase("exiting"), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <AnimatePresence onExitComplete={() => setPhase("idle")}>
      {phase === "showing" && (
        <motion.div
          key={`egg-note-${eggId}`}
          className={`${PLACEMENT_CLASSES[placement]} pointer-events-none flex justify-center px-6`}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={houseSpring}
        >
          <div
            className="pointer-events-auto rounded-xl px-6 py-4 shadow-2xl flex items-start gap-3"
            style={{
              backgroundColor: neutral[800],
              border: `1px solid ${neutral[700]}`,
              boxShadow: `0 0 40px ${brand.red}22`,
            }}
          >
            <p
              className="max-w-lg text-center font-[family-name:var(--font-serif)] text-sm leading-relaxed italic"
              style={{ color: neutral[100] }}
            >
              {children}
            </p>
            <button
              type="button"
              onClick={() => setPhase("exiting")}
              className="shrink-0 mt-0.5 text-[13px] leading-none cursor-pointer transition-colors"
              style={{ color: neutral[500] }}
              onMouseEnter={(e) => (e.currentTarget.style.color = neutral[300])}
              onMouseLeave={(e) => (e.currentTarget.style.color = neutral[500])}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
