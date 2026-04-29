"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PHRASES = [
  "Reading between the lines.",
  "Connecting the signals you left behind.",
  "Finding the patterns you didn't know were there.",
  "Turning gut instincts into brand language.",
  "Your answers said more than you think.",
  "Building something that sounds like you.",
  "Mapping the space between who you are and how you show up.",
  "No templates. This one's yours.",
  "Translating honesty into identity.",
  "Almost there. Good things take a minute.",
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function AssemblingShimmer() {
  const [progress, setProgress] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const startTime = useRef(Date.now());
  const estimatedDuration = 22;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const raw = Math.min(elapsed / estimatedDuration, 0.95);
      const eased = 1 - Math.pow(1 - raw, 2.5);
      setProgress(Math.round(eased * 100));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(
    0,
    Math.ceil(estimatedDuration - (Date.now() - startTime.current) / 1000),
  );
  const timeLabel =
    remaining > 60
      ? `~${Math.ceil(remaining / 60)} min remaining`
      : remaining > 5
        ? `~${remaining}s remaining`
        : "almost there";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Assembling your Brand DNA"
      style={{
        flex: 1,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        textAlign: "center",
        padding: "clamp(32px, 6vw, 80px)",
        background: "var(--brand-charcoal)",
      }}
    >
      {/* Label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 9,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          margin: "0 0 32px 0",
        }}
      >
        Assembling your Brand DNA
      </motion.p>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
        style={{
          width: "100%",
          maxWidth: 360,
          height: 3,
          borderRadius: 999,
          background: "rgba(253, 245, 230, 0.06)",
          overflow: "hidden",
          margin: "0 0 16px 0",
        }}
      >
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "linear" }}
          style={{
            height: "100%",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, var(--brand-red), var(--brand-pink))",
          }}
        />
      </motion.div>

      {/* Percentage + time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "0 0 48px 0",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "1px",
            color: "var(--brand-cream)",
            opacity: 0.5,
          }}
        >
          {progress}%
        </span>
        <span
          style={{
            width: 1,
            height: 10,
            background: "rgba(253, 245, 230, 0.15)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--brand-cream)",
            opacity: 0.35,
          }}
        >
          {timeLabel}
        </span>
      </div>

      {/* Rotating phrases */}
      <div style={{ height: 48, position: "relative", width: "100%", maxWidth: 440 }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: EASE }}
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(15px, 2.5vw, 18px)",
              lineHeight: 1.5,
              color: "var(--brand-cream)",
              opacity: 0.45,
              margin: 0,
              position: "absolute",
              width: "100%",
            }}
          >
            {PHRASES[phraseIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
