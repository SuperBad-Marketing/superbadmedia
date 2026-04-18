"use client";

import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface Props {
  section: string;
  description: string;
}

export function PortalSectionPlaceholder({ section, description }: Props) {
  const shouldReduceMotion = useReducedMotion();

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
            {section}
          </h1>
        </div>
        <span className="font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
          {description}
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
        <p className="text-center text-sm italic text-[var(--color-neutral-500)]">
          arriving shortly.
        </p>
      </motion.div>
    </div>
  );
}
