"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { GreetingBar } from "./greeting-bar";
import { BraindumpModal } from "@/components/lite/braindump/braindump-modal";

interface CockpitShellProps {
  mantra: string;
  braindumpDone: boolean;
  children: ReactNode;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function CockpitShell({ mantra, braindumpDone, children }: CockpitShellProps) {
  const [braindumpOpen, setBraindumpOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[720px] px-4 pt-6 pb-12">
        <motion.div
          initial="hidden"
          animate="show"
          transition={{
            staggerChildren: reducedMotion ? 0 : 0.06,
            delayChildren: reducedMotion ? 0 : 0.03,
          }}
        >
          <motion.div
            variants={reducedMotion ? undefined : sectionVariants}
            transition={reducedMotion ? { duration: 0 } : houseSpring}
          >
            <GreetingBar
              mantra={mantra}
              onBraindump={() => setBraindumpOpen(true)}
              braindumpDone={braindumpDone}
            />
          </motion.div>

          {children}
        </motion.div>
      </div>

      <AnimatePresence>
        {braindumpOpen && (
          <BraindumpModal
            onClose={() => setBraindumpOpen(false)}
            surfaceContext={null}
          />
        )}
      </AnimatePresence>
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
