"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface ReferralPromptProps {
  visible: boolean;
  onRefer: () => void;
  onDismiss: () => void;
}

export function ReferralPrompt({
  visible,
  onRefer,
  onDismiss,
}: ReferralPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss();
  }, [onDismiss]);

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
          className="fixed bottom-24 left-1/2 z-30 w-[calc(100%-2.5rem)] max-w-[380px] -translate-x-1/2 rounded-xl border border-[rgba(244,160,176,0.2)] bg-[var(--color-surface-1)] px-5 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
        >
          <p className="mb-3 text-[14px] leading-snug text-[var(--color-brand-cream)]">
            Things are going well. Know someone who&apos;d get value from this?
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onRefer}
              className="rounded-lg bg-[var(--color-brand-red)] px-4 py-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-cream)] transition-all duration-200 hover:translate-y-[-1px]"
            >
              Refer someone
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-[rgba(253,245,230,0.1)] bg-transparent px-4 py-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)] transition-colors duration-200 hover:text-[var(--color-brand-cream)]"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
