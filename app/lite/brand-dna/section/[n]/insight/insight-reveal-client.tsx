"use client";

/**
 * InsightRevealClient — animates the section insight text in.
 *
 * Motion: fade + subtle lift on mount using houseSpring.
 * Reduced-motion parity via MotionConfig (inherited from root MotionProvider).
 *
 * Owner: BDA-2.
 */

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface InsightRevealClientProps {
  insight: string;
}

export function InsightRevealClient({ insight }: InsightRevealClientProps) {
  return (
    <motion.blockquote
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      className="text-center max-w-md"
      style={{
        color: "var(--color-neutral-100, #f5f5f5)",
        fontSize: "1.125rem",
        lineHeight: 1.65,
        fontStyle: "italic",
      }}
    >
      &ldquo;{insight}&rdquo;
    </motion.blockquote>
  );
}
