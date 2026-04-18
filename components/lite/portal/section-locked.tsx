"use client";

import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface SectionLockedProps {
  sectionLabel: string;
}

export function SectionLocked({ sectionLabel }: SectionLockedProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="flex max-w-sm flex-col items-center gap-4 text-center"
      >
        <div className="grid h-16 w-16 place-items-center rounded-full border border-[rgba(253,245,230,0.08)] bg-[rgba(34,34,31,0.6)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-[var(--color-neutral-500)]">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <p className="font-[family-name:var(--font-playfair-display)] text-lg italic text-[var(--color-brand-cream)]">
          {sectionLabel} is available on retainer.
        </p>
        <p className="text-sm italic text-[var(--color-neutral-500)]">
          when you&apos;re ready, we&apos;ll unlock everything.
        </p>
      </motion.div>
    </div>
  );
}
