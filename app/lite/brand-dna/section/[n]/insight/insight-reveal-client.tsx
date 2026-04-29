"use client";

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface InsightRevealClientProps {
  insight: string;
  attribution?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function InsightRevealClient({ insight, attribution }: InsightRevealClientProps) {
  const sentences = insight.split(/(?<=[.!?])\s+/).filter(Boolean);
  const opener = sentences[0] ?? "";
  const rest = sentences.slice(1).join(" ");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      style={{
        maxWidth: 620,
        width: "100%",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}
    >
      {/* Decorative rule */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...houseSpring, delay: 0.2 }}
        style={{
          width: 40,
          height: 1,
          background: "var(--brand-red)",
          marginBottom: 40,
          transformOrigin: "center",
        }}
      />

      {/* Opener — Playfair pull-quote register */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
        className="bda-insight-opener"
        style={{
          fontFamily: "var(--font-narrative)",
          fontStyle: "italic",
          fontSize: "clamp(22px, 3.5vw, 30px)",
          lineHeight: 1.45,
          color: "var(--brand-cream)",
          letterSpacing: "-0.2px",
          margin: "0 0 24px 0",
          maxWidth: 540,
        }}
      >
        {opener}
      </motion.p>

      {/* Body — DM Sans, readable, lighter weight */}
      {rest && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
          className="bda-insight-body"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(15px, 2vw, 17px)",
            lineHeight: 1.7,
            color: "var(--brand-cream)",
            opacity: 0.65,
            margin: "0 0 32px 0",
            maxWidth: 500,
          }}
        >
          {rest}
        </motion.p>
      )}

      {/* Attribution — quiet, low-ego */}
      {attribution && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8, ease: EASE }}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 9,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
            opacity: 0.6,
            margin: 0,
            marginTop: rest ? 0 : 32,
          }}
        >
          {attribution}
        </motion.p>
      )}
    </motion.div>
  );
}
