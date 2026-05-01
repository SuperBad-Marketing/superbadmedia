"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";

// ── Types ────────────────────────────────────────────────────────────

export interface SignalScoreEntry {
  tag: string;
  displayName: string;
  frequency: number;
  domain: string;
  domainLabel: string;
  domainColor: string;
  staticDefinition: string;
  contextualDescription: string;
}

export interface SignalScoresProps {
  intro: string;
  scores: SignalScoreEntry[];
  longTailSummary: string;
}

// ── Motion constants ─────────────────────────────────────────────────

const TIER_2_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const BAR_DURATION = 0.4;
const BAR_STAGGER = 0.06;
const INTRO_DELAY = 0;
const BARS_DELAY = 0.2;

// ── Main component ───────────────────────────────────────────────────

export function SignalScores({ intro, scores, longTailSummary }: SignalScoresProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.15 });
  const reduced = useReducedMotion();

  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [isTouchMode, setIsTouchMode] = React.useState(false);
  const [tooltipDomain, setTooltipDomain] = React.useState<{
    index: number;
    label: string;
    color: string;
  } | null>(null);

  const maxFrequency = scores.length > 0 ? scores[0].frequency : 1;
  const totalBarsDuration = scores.length * BAR_STAGGER + BAR_DURATION;

  return (
    <div
      ref={containerRef}
      style={{
        background: "var(--color-neutral-900, #1A1A18)",
        padding: "80px 24px",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Section label */}
        <motion.span
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...houseSpring, delay: INTRO_DELAY }}
          style={{
            display: "block",
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "3px",
            color: "var(--brand-orange)",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Signal scores
        </motion.span>

        {/* Intro sentence */}
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...houseSpring, delay: INTRO_DELAY + 0.1 }}
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: "clamp(17px, 2.2vw, 22px)",
            lineHeight: 1.6,
            color: "var(--brand-cream)",
            opacity: 0.7,
            maxWidth: 640,
            margin: "0 0 48px",
          }}
        >
          {intro}
        </motion.p>

        {/* Bar chart */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
          role="list"
          aria-label="Signal scores ranked by strength"
        >
          {scores.map((score, i) => (
            <SignalBar
              key={score.tag}
              score={score}
              index={i}
              maxFrequency={maxFrequency}
              inView={inView}
              reduced={reduced ?? false}
              isActive={activeIndex === i}
              isTouchMode={isTouchMode}
              onTouchStart={() => setIsTouchMode(true)}
              onMouseEnter={() => {
                if (!isTouchMode) setActiveIndex(i);
              }}
              onMouseLeave={() => {
                if (!isTouchMode) setActiveIndex(null);
              }}
              onClick={() => {
                if (isTouchMode)
                  setActiveIndex((prev) => (prev === i ? null : i));
              }}
              tooltipDomain={tooltipDomain}
              onDotEnter={() =>
                setTooltipDomain({
                  index: i,
                  label: score.domainLabel,
                  color: score.domainColor,
                })
              }
              onDotLeave={() => setTooltipDomain(null)}
              onDotTap={() => {
                if (isTouchMode) {
                  setTooltipDomain((prev) =>
                    prev?.index === i
                      ? null
                      : {
                          index: i,
                          label: score.domainLabel,
                          color: score.domainColor,
                        },
                  );
                }
              }}
            />
          ))}
        </div>

        {/* Long tail summary */}
        {longTailSummary && (
          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{
              ...houseSpring,
              delay: BARS_DELAY + totalBarsDuration + 0.15,
            }}
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--brand-cream)",
              opacity: 0.4,
              marginTop: 32,
            }}
          >
            {longTailSummary}
          </motion.p>
        )}
      </div>
    </div>
  );
}

// ── Individual bar ───────────────────────────────────────────────────

interface SignalBarProps {
  score: SignalScoreEntry;
  index: number;
  maxFrequency: number;
  inView: boolean;
  reduced: boolean;
  isActive: boolean;
  isTouchMode: boolean;
  onTouchStart: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  tooltipDomain: { index: number; label: string; color: string } | null;
  onDotEnter: () => void;
  onDotLeave: () => void;
  onDotTap: () => void;
}

function SignalBar({
  score,
  index,
  maxFrequency,
  inView,
  reduced,
  isActive,
  isTouchMode,
  onTouchStart,
  onMouseEnter,
  onMouseLeave,
  onClick,
  tooltipDomain,
  onDotEnter,
  onDotLeave,
  onDotTap,
}: SignalBarProps) {
  const barPercent = (score.frequency / maxFrequency) * 100;
  const entryDelay = BARS_DELAY + index * BAR_STAGGER;
  const showTooltip = tooltipDomain?.index === index;

  return (
    <div role="listitem" aria-label={`${score.displayName}: ${score.frequency}`}>
      <div
        onTouchStart={onTouchStart}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(120px, 180px) 1fr auto",
          alignItems: "center",
          gap: 16,
          padding: "12px 0",
          cursor: isTouchMode ? "pointer" : "default",
          borderBottom: "1px solid rgba(253, 245, 230, 0.04)",
        }}
      >
        {/* Domain dot + tag name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{ position: "relative" }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              onDotEnter();
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              onDotLeave();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDotTap();
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: score.domainColor,
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute",
                    top: -32,
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-label)",
                    fontSize: 9,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: tooltipDomain.color,
                    background: "var(--color-neutral-800, #252320)",
                    border: `1px solid ${tooltipDomain.color}40`,
                    borderRadius: 6,
                    padding: "5px 10px",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  {tooltipDomain.label}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--brand-cream)",
              opacity: 0.9,
            }}
          >
            {score.displayName}
          </span>
        </div>

        {/* Bar */}
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "rgba(253, 245, 230, 0.06)",
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={reduced ? { width: `${barPercent}%` } : { width: 0 }}
            animate={inView ? { width: `${barPercent}%` } : {}}
            transition={{
              duration: BAR_DURATION,
              delay: entryDelay,
              ease: TIER_2_EASE,
            }}
            style={{
              height: "100%",
              borderRadius: 3,
              background: `linear-gradient(90deg, var(--brand-pink), ${score.domainColor})`,
              opacity: 0.85,
            }}
          />
        </div>

        {/* Count-up number */}
        <CountUp
          target={score.frequency}
          delay={entryDelay}
          duration={BAR_DURATION}
          inView={inView}
          reduced={reduced}
        />
      </div>

      {/* Expandable description */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={houseSpring}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "12px 0 20px 17px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--brand-cream)",
                  opacity: 0.6,
                  margin: 0,
                }}
              >
                {score.staticDefinition}
              </p>
              {score.contextualDescription && (
                <p
                  style={{
                    fontFamily: "var(--font-narrative)",
                    fontStyle: "italic",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--brand-pink)",
                    opacity: 0.7,
                    margin: 0,
                  }}
                >
                  {score.contextualDescription}
                </p>
              )}
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 8,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: score.domainColor,
                  opacity: 0.5,
                  marginTop: 2,
                }}
              >
                {score.domainLabel} signal
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Count-up animation ───────────────────────────────────────────────

function CountUp({
  target,
  delay,
  duration,
  inView,
  reduced,
}: {
  target: number;
  delay: number;
  duration: number;
  inView: boolean;
  reduced: boolean;
}) {
  const [value, setValue] = React.useState(reduced ? target : 0);

  React.useEffect(() => {
    if (!inView || reduced) {
      setValue(target);
      return;
    }

    const timeout = window.setTimeout(() => {
      const start = performance.now();
      const durationMs = duration * 1000;

      const step = () => {
        const elapsed = performance.now() - start;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay * 1000);

    return () => window.clearTimeout(timeout);
  }, [target, delay, duration, inView, reduced]);

  return (
    <span
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 13,
        fontVariantNumeric: "tabular-nums",
        color: "var(--brand-cream)",
        opacity: 0.5,
        minWidth: 24,
        textAlign: "right",
      }}
    >
      {value}
    </span>
  );
}
