"use client";

import { motion } from "framer-motion";

interface OverallProgressBarProps {
  section: 1 | 2 | 3 | 4 | 5;
  questionIndex: number;
  totalInSection: number;
}

const SECTION_OFFSETS = [0, 19, 43, 63, 82, 102];

const SECTION_HUES: Record<number, string> = {
  1: "178, 40, 72",
  2: "192, 50, 72",
  3: "210, 70, 68",
  4: "230, 90, 76",
  5: "244, 160, 176",
};

function lerpColor(fraction: number): string {
  const section = Math.min(5, Math.max(1, Math.ceil(fraction * 5) || 1));
  return `rgb(${SECTION_HUES[section]})`;
}

export function OverallProgressBar({
  section,
  questionIndex,
  totalInSection,
}: OverallProgressBarProps) {
  const answered = SECTION_OFFSETS[section - 1] + questionIndex;
  const total = SECTION_OFFSETS[5];
  const fraction = Math.min(answered / total, 1);

  const trailFraction = Math.min((answered + 1) / total, 1);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 100,
        background: "rgba(253, 245, 230, 0.04)",
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ scaleX: fraction }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100%",
          transformOrigin: "left",
          background: `linear-gradient(90deg, rgb(${SECTION_HUES[1]}), ${lerpColor(fraction)})`,
        }}
      />
      <motion.div
        initial={false}
        animate={{ scaleX: trailFraction }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100%",
          transformOrigin: "left",
          background: `linear-gradient(90deg, transparent 90%, ${lerpColor(trailFraction)})`,
          opacity: 0.25,
        }}
      />
    </div>
  );
}

export function OverallProgressBarStatic({
  section,
}: {
  section: 1 | 2 | 3 | 4 | 5;
}) {
  const answered = SECTION_OFFSETS[section];
  const total = SECTION_OFFSETS[5];
  const fraction = Math.min(answered / total, 1);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 100,
        background: "rgba(253, 245, 230, 0.04)",
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ scaleX: fraction }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100%",
          transformOrigin: "left",
          background: `linear-gradient(90deg, rgb(${SECTION_HUES[1]}), ${lerpColor(fraction)})`,
        }}
      />
    </div>
  );
}
