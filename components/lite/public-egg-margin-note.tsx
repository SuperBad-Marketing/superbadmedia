"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { neutral } from "@/lib/design-tokens";

type Placement = "top" | "hero" | "content" | "footer" | "bottom";

interface PublicEggMarginNoteProps {
  eggId: string;
  placement: Placement;
  children: React.ReactNode;
}

const PLACEMENT_CLASSES: Record<Placement, string> = {
  top: "fixed top-8 left-0 right-0 z-40",
  hero: "fixed top-24 left-0 right-0 z-40",
  content: "fixed top-1/3 left-0 right-0 z-40",
  footer: "fixed bottom-24 left-0 right-0 z-40",
  bottom: "fixed bottom-8 left-0 right-0 z-40",
};

export function PublicEggMarginNote({
  eggId,
  placement,
  children,
}: PublicEggMarginNoteProps) {
  const [visible, setVisible] = useState(false);

  const handleFired = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.eggId !== eggId) return;
      setVisible(true);
    },
    [eggId],
  );

  useEffect(() => {
    window.addEventListener("public-egg-fired", handleFired);
    return () => window.removeEventListener("public-egg-fired", handleFired);
  }, [handleFired]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`egg-note-${eggId}`}
          className={`${PLACEMENT_CLASSES[placement]} pointer-events-none flex justify-center px-6`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <p
            className="pointer-events-auto max-w-lg text-center font-serif text-sm leading-relaxed italic"
            style={{ color: neutral[500] }}
          >
            {children}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
