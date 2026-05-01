"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { GapRevealData } from "@/lib/brand-dna/generate-gap-reveal";
import type { DomainPresenceScore } from "@/lib/brand-dna/build-presence-scores";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface GapRevealProps {
  sessionToken: string;
  businessName: string;
  gapReveal: GapRevealData | null;
  presenceScores: DomainPresenceScore[];
  trialShootUrl: string;
  onViewBrandPack: () => void;
  packLoading: boolean;
}

export function GapReveal({
  sessionToken,
  businessName,
  gapReveal,
  presenceScores,
  trialShootUrl,
  onViewBrandPack,
  packLoading,
}: GapRevealProps) {
  const titleRef = React.useRef<HTMLDivElement>(null);
  const titleInView = useInView(titleRef, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  const hasContent = gapReveal &&
    ((gapReveal.mode === "observations" && (gapReveal.strength || gapReveal.gap)) ||
     (gapReveal.mode === "questions" && gapReveal.questions.length > 0));

  return (
    <div className="gap-reveal-root">
      {/* Title card + ring visualization */}
      <div
        ref={titleRef}
        style={{
          background: "var(--color-neutral-900, #1A1A18)",
          padding: "120px 24px 80px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 820, margin: "0 auto", position: "relative" }}>
          {/* Ring visualization behind/above the name */}
          {presenceScores.length > 0 && (
            <DnaPresenceRing
              scores={presenceScores}
              inView={titleInView}
              reduced={reduced ?? false}
            />
          )}

          {/* Business name title card */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.96 }}
            animate={titleInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1.2, ease: EASE, delay: 0.8 }}
          >
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 9,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--brand-orange)",
                display: "block",
                marginBottom: 20,
              }}
            >
              Your brand, right now
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 1,
                letterSpacing: "-2px",
                color: "var(--brand-cream)",
                margin: 0,
              }}
            >
              {businessName}
            </h2>
          </motion.div>
        </div>
      </div>

      {/* Observations or questions */}
      {hasContent && (
        <ObservationsSection gapReveal={gapReveal} reduced={reduced ?? false} />
      )}

      {/* Session availability */}
      <SessionLine trialShootUrl={trialShootUrl} reduced={reduced ?? false} />

      {/* Brand Pack download */}
      <BrandPackSection
        onView={onViewBrandPack}
        loading={packLoading}
      />

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "60px 24px 64px",
          borderTop: "1px solid rgba(253, 245, 230, 0.04)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-logo)",
            fontSize: 28,
            color: "var(--brand-cream)",
            marginBottom: 12,
          }}
        >
          SuperBad
        </div>
        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            color: "var(--brand-pink)",
            fontSize: 14,
            margin: 0,
          }}
        >
          Marketing for people who&rsquo;d rather be doing something else.
        </p>
      </footer>

      <AnimatePresence>
        {packLoading && <BrandPackLoadingOverlay />}
      </AnimatePresence>
    </div>
  );
}

// ── Ring visualization ──────────────────────────────────────────────────

function DnaPresenceRing({
  scores,
  inView,
  reduced,
}: {
  scores: DomainPresenceScore[];
  inView: boolean;
  reduced: boolean;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 90;
  const innerR = 70;
  const gapAngle = 4;
  const totalGap = gapAngle * scores.length;
  const availableDeg = 360 - totalGap;

  const arcs = React.useMemo(() => {
    const result: Array<{
      domain: string;
      color: string;
      startAngle: number;
      sweepAngle: number;
      dnaStrength: number;
      presenceStrength: number;
    }> = [];

    const totalDna = scores.reduce((s, d) => s + Math.max(d.dnaStrength, 0.15), 0);
    let cursor = -90;

    for (const score of scores) {
      const proportion = Math.max(score.dnaStrength, 0.15) / totalDna;
      const sweep = proportion * availableDeg;
      result.push({
        domain: score.domain,
        color: score.domainColor,
        startAngle: cursor,
        sweepAngle: sweep,
        dnaStrength: score.dnaStrength,
        presenceStrength: score.presenceStrength,
      });
      cursor += sweep + gapAngle;
    }
    return result;
  }, [scores, availableDeg]);

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible" }}
      >
        {arcs.map((arc, i) => (
          <React.Fragment key={arc.domain}>
            {/* Outer arc — DNA strength (always full, dimmed) */}
            <motion.path
              d={describeArc(cx, cy, outerR, arc.startAngle, arc.startAngle + arc.sweepAngle)}
              fill="none"
              stroke={arc.color}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.2}
              initial={reduced ? {} : { pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE }}
            />
            {/* Inner arc — presence strength (partial, bright) */}
            <motion.path
              d={describeArc(
                cx,
                cy,
                innerR,
                arc.startAngle,
                arc.startAngle + arc.sweepAngle * Math.max(arc.presenceStrength, 0.05),
              )}
              fill="none"
              stroke={arc.color}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.8}
              initial={reduced ? {} : { pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1, delay: 0.4 + i * 0.12, ease: EASE }}
            />
          </React.Fragment>
        ))}
        {/* Center glow */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={30}
          fill="url(#centerGlow)"
          initial={reduced ? {} : { opacity: 0 }}
          animate={inView ? { opacity: 0.3 } : {}}
          transition={{ duration: 1.5, delay: 0.6 }}
        />
        <defs>
          <radialGradient id="centerGlow">
            <stop offset="0%" stopColor="var(--brand-pink)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--brand-pink)" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// ── Observations / Questions section ────────────────────────────────────

function ObservationsSection({
  gapReveal,
  reduced,
}: {
  gapReveal: GapRevealData;
  reduced: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div
      ref={ref}
      style={{
        background: "var(--color-neutral-900, #1A1A18)",
        padding: "0 24px 80px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {gapReveal.mode === "observations" ? (
          <>
            {gapReveal.strength && (
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ ...houseSpring, delay: 0 }}
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: "clamp(16px, 2.2vw, 20px)",
                  lineHeight: 1.7,
                  color: "var(--brand-cream)",
                  opacity: 0.75,
                  margin: "0 0 32px",
                }}
              >
                {gapReveal.strength}
              </motion.p>
            )}
            {gapReveal.gap && (
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ ...houseSpring, delay: 0.15 }}
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: "clamp(16px, 2.2vw, 20px)",
                  lineHeight: 1.7,
                  color: "var(--brand-cream)",
                  opacity: 0.55,
                  margin: 0,
                }}
              >
                {gapReveal.gap}
              </motion.p>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {gapReveal.questions.map((q, i) => (
              <motion.p
                key={i}
                initial={reduced ? false : { opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ ...houseSpring, delay: i * 0.15 }}
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: "clamp(16px, 2.2vw, 20px)",
                  lineHeight: 1.7,
                  color: "var(--brand-cream)",
                  opacity: 0.7,
                  margin: 0,
                }}
              >
                {q}
              </motion.p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session availability ────────────────────────────────────────────────

function SessionLine({
  trialShootUrl,
  reduced,
}: {
  trialShootUrl: string;
  reduced: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <div
      ref={ref}
      style={{
        background: "var(--color-neutral-900, #1A1A18)",
        padding: "0 24px 80px",
        textAlign: "center",
      }}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        style={{ maxWidth: 640, margin: "0 auto" }}
      >
        <div
          style={{
            height: 1,
            background: "linear-gradient(to right, transparent, rgba(253,245,230,0.08), transparent)",
            marginBottom: 40,
          }}
        />
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--neutral-400)",
            margin: 0,
          }}
        >
          There&rsquo;s a 60-minute session available in Melbourne.{" "}
          <a
            href={trialShootUrl}
            style={{
              color: "var(--brand-cream)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(253,245,230,0.2)",
              transition: "border-color 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(253,245,230,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(253,245,230,0.2)";
            }}
          >
            From $397
          </a>
        </p>
      </motion.div>
    </div>
  );
}

// ── Brand Pack section ──────────────────────────────────────────────────

function BrandPackSection({
  onView,
  loading,
}: {
  onView: () => void;
  loading: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  return (
    <div
      ref={ref}
      style={{
        background: "var(--color-neutral-800, #252320)",
        padding: "64px 24px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <span
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
              display: "block",
              marginBottom: 16,
            }}
          >
            Your brand pack
          </span>
          <p
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(15px, 2vw, 18px)",
              lineHeight: 1.7,
              color: "var(--brand-cream)",
              opacity: 0.7,
              maxWidth: 420,
              margin: "0 auto 28px",
            }}
          >
            Colours, typography, content pillars, voice guide, photography
            direction. Yours to keep.
          </p>
        </motion.div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        >
          <button
            type="button"
            onClick={onView}
            disabled={loading}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-cream)",
              padding: "16px 36px",
              background: "rgba(253, 245, 230, 0.04)",
              border: "1px solid rgba(253, 245, 230, 0.15)",
              borderRadius: 999,
              cursor: loading ? "wait" : "pointer",
              backdropFilter: "blur(8px)",
              transition: "background 300ms, border-color 300ms",
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "rgba(253, 245, 230, 0.08)";
                e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.25)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(253, 245, 230, 0.04)";
              e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.15)";
            }}
          >
            View your brand pack &rarr;
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Brand pack loading overlay ──────────────────────────────────────────

const PACK_PHRASES = [
  "Assembling your brand pack.",
  "Pulling colours, type, and voice together.",
  "Good things take a minute.",
  "Almost there.",
];

function BrandPackLoadingOverlay() {
  const [phraseIndex, setPhraseIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((p) => (p + 1) % PACK_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setProgress(Math.min(elapsed / 20, 0.92));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(26, 26, 24, 0.92)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        textAlign: "center",
        padding: "40px 24px",
      }}
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 9,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          margin: "0 0 32px 0",
        }}
      >
        Preparing your brand pack
      </motion.p>

      <div
        style={{
          width: "100%",
          maxWidth: 320,
          height: 3,
          borderRadius: 999,
          background: "rgba(253, 245, 230, 0.06)",
          overflow: "hidden",
          margin: "0 0 24px 0",
        }}
      >
        <motion.div
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.6, ease: "linear" }}
          style={{
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--brand-red), var(--brand-pink))",
          }}
        />
      </div>

      <div style={{ height: 40, position: "relative", width: "100%", maxWidth: 400 }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(14px, 2vw, 16px)",
              lineHeight: 1.5,
              color: "var(--brand-cream)",
              opacity: 0.45,
              margin: 0,
              position: "absolute",
              width: "100%",
            }}
          >
            {PACK_PHRASES[phraseIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
