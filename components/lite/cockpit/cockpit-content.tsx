"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { houseSpring } from "@/lib/design-tokens";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning.";
  if (hour < 17) return "Afternoon.";
  return "Evening.";
}

const TAGLINES = [
  "Here’s what needs you.",
  "The state of things.",
  "Let’s see what we’ve got.",
  "Right. Where were we.",
  "One more day.",
  "Back at it.",
];

function pickTagline(): string {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return TAGLINES[dayIndex % TAGLINES.length];
}

export function CockpitContent({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[720px] px-4 pt-6 pb-12">
        <motion.div
          initial="hidden"
          animate="show"
          transition={{
            staggerChildren: reducedMotion ? 0 : 0.08,
            delayChildren: reducedMotion ? 0 : 0.04,
          }}
        >
          <motion.header
            className="pb-8"
            variants={reducedMotion ? undefined : sectionVariants}
            transition={reducedMotion ? { duration: 0 } : houseSpring}
          >
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
              style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
            >
              Admin · Cockpit
            </div>
            <h1
              className="mt-4 text-balance font-[family-name:var(--font-display)]"
              style={{
                fontSize: "clamp(48px, 8vw, 64px)",
                lineHeight: 1,
                color: "var(--color-brand-cream)",
              }}
            >
              {getGreeting()}
            </h1>
            <p
              className="mt-2 text-pretty font-[family-name:var(--font-narrative)] text-[16px] italic"
              style={{ color: "var(--color-neutral-500)" }}
            >
              {pickTagline()}
            </p>
          </motion.header>

          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function CockpitSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={reducedMotion ? undefined : sectionVariants}
      transition={reducedMotion ? { duration: 0 } : houseSpring}
    >
      {children}
    </motion.div>
  );
}
