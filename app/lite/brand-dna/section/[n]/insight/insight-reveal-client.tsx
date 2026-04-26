"use client";

/**
 * InsightRevealClient — between-section insight (mockup scene-2 register).
 *
 * Playfair Display italic quote, Righteous label, brand-pink attribution.
 * Centred composition, riseIn motion, reduced-motion parity inherited from
 * the root MotionProvider.
 *
 * Owners: BDA-2 (logic), BDA-POLISH-1 (visual port).
 */

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface InsightRevealClientProps {
  insight: string;
  attribution?: string;
}

export function InsightRevealClient({ insight, attribution }: InsightRevealClientProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...houseSpring, duration: 1.2 }}
      className="bda-insight-container"
      style={{
        maxWidth: 700,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <div
        className="bda-insight-card"
        style={{
          padding: "40px 32px",
          borderRadius: 16,
          background: "rgba(34, 34, 31, 0.5)",
          border: "1px solid rgba(244, 160, 176, 0.1)",
          backdropFilter: "blur(12px)",
        }}
      >
        <blockquote
          className="bda-insight-quote"
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: 36,
            lineHeight: 1.35,
            color: "var(--brand-cream)",
            letterSpacing: "-0.3px",
            margin: 0,
          }}
        >
          &ldquo;{insight}&rdquo;
        </blockquote>
      </div>

      {attribution && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--brand-pink)",
            opacity: 0.85,
            letterSpacing: "0.2px",
          }}
        >
          {attribution}
        </p>
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.bda-insight-card) {
            padding: 28px 20px !important;
            border-radius: 12px !important;
          }
          :global(.bda-insight-quote) {
            font-size: 24px !important;
            line-height: 1.4 !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
