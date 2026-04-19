"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { pdfRenderOverlay } from "@/lib/motion/choreographies";

interface Props {
  visible: boolean;
  label?: string;
}

export function PdfRenderOverlay({ visible, label = "Rendering your plan\u2026" }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion
    ? pdfRenderOverlay.reduced.variants
    : pdfRenderOverlay.variants;
  const transition = shouldReduceMotion
    ? pdfRenderOverlay.reduced.transition
    : pdfRenderOverlay.transition;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="pdf-overlay"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--color-charcoal)]/90"
        >
          <span className="mb-5 font-[family-name:var(--font-righteous)] text-[14px] font-bold uppercase tracking-[2px] text-[var(--color-brand-red)]">
            SuperBad
          </span>
          <p className="mb-6 text-[15px] text-[var(--color-neutral-300)]">
            {label}
          </p>
          <Spinner />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Spinner() {
  return (
    <svg
      className="h-6 w-6 animate-spin text-[var(--color-brand-pink)]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="opacity-20"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
