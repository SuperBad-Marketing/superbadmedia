"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { houseSpring } from "@/lib/design-tokens";

const EASE = [0.22, 1, 0.36, 1] as const;

interface AssessmentIntroClientProps {
  continueHref: string;
}

export function AssessmentIntroClient({ continueHref }: AssessmentIntroClientProps) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--brand-charcoal)",
        padding: "clamp(32px, 6vw, 80px)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 0,
        }}
      >
        {/* Section label */}
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
            margin: "0 0 40px 0",
          }}
        >
          Before we start
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 42px)",
            lineHeight: 1.05,
            color: "var(--brand-cream)",
            margin: "0 0 32px 0",
          }}
        >
          Go with your gut
          <span style={{ color: "var(--brand-red)" }}>.</span>
        </motion.h1>

        {/* Body — honest framing */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            margin: "0 0 48px 0",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "clamp(15px, 2vw, 17px)",
              lineHeight: 1.7,
              color: "var(--brand-cream)",
              opacity: 0.7,
              margin: 0,
            }}
          >
            Some of the questions will be hard to choose between. That&rsquo;s
            the point. Pick the one that feels most like you, even if none of
            them are perfect. Be brutally honest — the less you overthink it,
            the better the result.
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "clamp(15px, 2vw, 17px)",
              lineHeight: 1.7,
              color: "var(--brand-cream)",
              opacity: 0.7,
              margin: 0,
            }}
          >
            Some questions will seem random. They&rsquo;re not. Each one maps
            to a specific signal about how your brand thinks, communicates,
            and shows up. The combination of your answers is what builds the
            profile — no single question defines anything on its own.
          </p>
          <p
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(15px, 2vw, 17px)",
              lineHeight: 1.6,
              color: "var(--brand-pink)",
              opacity: 0.8,
              margin: 0,
            }}
          >
            There are no wrong answers. Just honest ones.
          </p>
        </motion.div>

        {/* Continue pill */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease: EASE }}
        >
          <Link
            href={continueHref}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-cream)",
              padding: "16px 40px",
              background: "var(--brand-red)",
              border: "none",
              borderRadius: 12,
              textDecoration: "none",
              display: "inline-block",
              transition: "background 200ms, transform 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#8F1D3A";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--brand-red)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Begin →
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
