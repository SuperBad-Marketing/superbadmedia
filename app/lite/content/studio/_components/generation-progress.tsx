"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export type GenerationPhase =
  | "analysing"
  | "template"
  | "writing"
  | "configuring"
  | "saving"
  | "done";

interface PhaseConfig {
  label: string;
  subtext: string;
  weight: number;
}

const STATIC_PHASES: Record<string, PhaseConfig> = {
  analysing: { label: "Analysing brief", subtext: "Reading your intent", weight: 12 },
  template: { label: "Selecting template", subtext: "Matching visual style", weight: 18 },
  writing: { label: "Writing copy", subtext: "Crafting brand-voice text", weight: 55 },
  saving: { label: "Finalising", subtext: "Locking it in", weight: 15 },
};

const MOTION_PHASES: Record<string, PhaseConfig> = {
  analysing: { label: "Analysing brief", subtext: "Reading your intent", weight: 10 },
  template: { label: "Selecting motion template", subtext: "Matching animation style", weight: 15 },
  writing: { label: "Composing copy", subtext: "Crafting brand-voice text", weight: 45 },
  configuring: { label: "Configuring motion", subtext: "Setting up animation params", weight: 18 },
  saving: { label: "Finalising", subtext: "Locking it in", weight: 12 },
};

const PHASE_ORDER: GenerationPhase[] = [
  "analysing",
  "template",
  "writing",
  "configuring",
  "saving",
  "done",
];

function getPhases(isMotion: boolean) {
  return isMotion ? MOTION_PHASES : STATIC_PHASES;
}

function getActivePhaseList(isMotion: boolean): GenerationPhase[] {
  return PHASE_ORDER.filter((p) => p in getPhases(isMotion) || p === "done");
}

interface GenerationProgressProps {
  active: boolean;
  isMotion: boolean;
  onComplete?: () => void;
}

export function GenerationProgress({
  active,
  isMotion,
  onComplete,
}: GenerationProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  const phases = getPhases(isMotion);
  const phaseList = getActivePhaseList(isMotion);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

  const totalDuration = isMotion ? 14000 : 10000;

  useEffect(() => {
    if (!active) {
      setCurrentPhaseIndex(0);
      setProgress(0);
      completedRef.current = false;
      return;
    }

    startTimeRef.current = performance.now();
    completedRef.current = false;

    const phaseBoundaries: number[] = [];
    let cumulative = 0;
    for (const phase of phaseList) {
      if (phase === "done") break;
      const config = phases[phase];
      if (!config) continue;
      cumulative += config.weight;
      phaseBoundaries.push(cumulative);
    }
    const totalWeight = cumulative;

    function tick(now: number) {
      if (completedRef.current) return;

      const elapsed = now - startTimeRef.current;
      const rawProgress = Math.min(elapsed / totalDuration, 0.92);

      const eased =
        rawProgress < 0.3
          ? rawProgress * 1.8
          : 0.54 + (rawProgress - 0.3) * 0.613;

      const clampedProgress = Math.min(eased, 0.92);
      setProgress(clampedProgress * 100);

      const currentWeight = clampedProgress * totalWeight;
      let phaseIdx = 0;
      for (let i = 0; i < phaseBoundaries.length; i++) {
        if (currentWeight >= phaseBoundaries[i]) {
          phaseIdx = i + 1;
        }
      }
      setCurrentPhaseIndex(Math.min(phaseIdx, phaseList.length - 2));

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, isMotion, phases, phaseList, totalDuration]);

  useEffect(() => {
    if (!active && progress > 0 && !completedRef.current) {
      completedRef.current = true;
      setProgress(100);
      setCurrentPhaseIndex(phaseList.length - 1);
      const timer = setTimeout(() => {
        onComplete?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [active, progress, phaseList.length, onComplete]);

  const currentPhase = phaseList[currentPhaseIndex];
  const currentConfig =
    currentPhase && currentPhase !== "done" ? phases[currentPhase] : null;

  const completedPhases = phaseList.slice(0, currentPhaseIndex);
  const remainingPhases = phaseList.slice(currentPhaseIndex + 1).filter((p) => p !== "done");

  if (!active && progress === 0) return null;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-xl border px-6 py-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      {/* Progress bar */}
      <div
        className="relative h-1 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: "var(--color-brand-red)" }}
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
        {active && (
          <motion.div
            className="absolute inset-y-0 rounded-full"
            style={{
              width: "30%",
              background:
                "linear-gradient(90deg, transparent, rgba(253, 245, 230, 0.15), transparent)",
            }}
            animate={{ left: ["-30%", "130%"] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </div>

      {/* Phase label */}
      <div className="mt-4 flex items-baseline justify-between">
        <AnimatePresence mode="wait">
          {currentConfig && (
            <motion.div
              key={currentPhase}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                className="font-[family-name:var(--font-label)] text-[11px] uppercase"
                style={{
                  letterSpacing: "1.5px",
                  color: "var(--color-brand-cream)",
                }}
              >
                {currentConfig.label}
              </span>
              <span
                className="ml-3 font-[family-name:var(--font-body)] text-[12px]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {currentConfig.subtext}
              </span>
            </motion.div>
          )}
          {currentPhase === "done" && (
            <motion.span
              key="done"
              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="font-[family-name:var(--font-label)] text-[11px] uppercase"
              style={{
                letterSpacing: "1.5px",
                color: "var(--color-brand-pink)",
              }}
            >
              Complete
            </motion.span>
          )}
        </AnimatePresence>
        <span
          className="font-[family-name:var(--font-body)] text-[11px] tabular-nums"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {Math.round(progress)}%
        </span>
      </div>

      {/* Phase timeline */}
      <div className="mt-4 flex items-center gap-1">
        {phaseList
          .filter((p) => p !== "done")
          .map((phase, i) => {
            const isComplete = completedPhases.includes(phase);
            const isCurrent = phase === currentPhase;

            return (
              <motion.div
                key={phase}
                className="relative h-1 flex-1 overflow-hidden rounded-full"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.06)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{
                    scaleX: isComplete ? 1 : isCurrent ? 0.5 : 0,
                  }}
                  style={{
                    originX: 0,
                    backgroundColor: isComplete
                      ? "var(--color-brand-red)"
                      : "rgba(178, 40, 72, 0.5)",
                  }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </motion.div>
            );
          })}
      </div>

      {/* Phase dots */}
      <div className="mt-2 flex justify-between">
        {phaseList
          .filter((p) => p !== "done")
          .map((phase) => {
            const isComplete = completedPhases.includes(phase);
            const isCurrent = phase === currentPhase;
            const config = phases[phase];
            if (!config) return null;

            return (
              <div key={phase} className="flex flex-col items-center">
                <motion.div
                  className="size-1.5 rounded-full"
                  animate={{
                    backgroundColor: isComplete
                      ? "var(--color-brand-red)"
                      : isCurrent
                        ? "var(--color-brand-cream)"
                        : "rgba(253, 245, 230, 0.15)",
                    scale: isCurrent ? 1.4 : 1,
                  }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
                <span
                  className="mt-1.5 hidden text-center font-[family-name:var(--font-body)] text-[9px] sm:block"
                  style={{
                    color: isComplete
                      ? "var(--color-neutral-400)"
                      : isCurrent
                        ? "var(--color-brand-cream)"
                        : "var(--color-neutral-600)",
                    maxWidth: 72,
                  }}
                >
                  {config.label.replace("Selecting ", "").replace("Configuring ", "")}
                </span>
              </div>
            );
          })}
      </div>
    </motion.div>
  );
}
