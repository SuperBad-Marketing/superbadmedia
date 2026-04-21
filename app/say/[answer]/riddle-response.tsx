"use client";

import { motion } from "framer-motion";
import type { RiddleOutcome } from "@/lib/db/schema/riddles";

interface Props {
  outcome: RiddleOutcome;
  content: string;
  answer: string;
}

const houseSpring = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };

export function RiddleResponse({ outcome, content, answer }: Props) {
  const isCorrect = outcome === "correct";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Answer echo */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
          color: "var(--neutral-500)",
          margin: 0,
        }}
      >
        you said: <span style={{ color: "var(--brand-cream)" }}>{answer}</span>
      </motion.p>

      {/* Response content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...houseSpring, delay: 0.2 }}
        style={{
          background: isCorrect
            ? "linear-gradient(135deg, var(--neutral-800), var(--neutral-700))"
            : "var(--neutral-800)",
          borderRadius: 16,
          padding: "32px 28px",
          border: isCorrect
            ? "1px solid var(--brand-pink)"
            : "1px solid var(--neutral-600)",
        }}
      >
        {isCorrect && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...houseSpring, delay: 0.4 }}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
              marginBottom: 16,
            }}
          >
            found it
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: isCorrect ? 0.5 : 0.3, duration: 0.5 }}
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)",
            lineHeight: 1.5,
            color: "var(--brand-cream)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: escapeHtml(content) }}
        />

        {outcome === "retired" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--neutral-500)",
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            this one&apos;s been put to bed.
          </motion.p>
        )}

        {(outcome === "common_wrong" || outcome === "catch_all_wrong") && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--neutral-500)",
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            try again.
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}
