"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  FileTextIcon,
  FilmIcon,
  LayersIcon,
  CombineIcon,
  DownloadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  RotateCcwIcon,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { PipelineStage } from "@/lib/db/schema/video-jobs";

interface CompositeStageTrackerProps {
  currentStage: PipelineStage;
  failed: boolean;
  onRetry?: (stage: PipelineStage) => void;
}

const STAGES: { id: PipelineStage; label: string; icon: typeof FilmIcon }[] = [
  { id: "brief", label: "Brief", icon: FileTextIcon },
  { id: "footage", label: "Footage", icon: FilmIcon },
  { id: "overlay", label: "Overlay", icon: LayersIcon },
  { id: "composite", label: "Composite", icon: CombineIcon },
  { id: "export", label: "Export", icon: DownloadIcon },
  { id: "complete", label: "Done", icon: CheckCircleIcon },
];

function stageIndex(stage: PipelineStage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function CompositeStageTracker({
  currentStage,
  failed,
  onRetry,
}: CompositeStageTrackerProps) {
  const shouldReduceMotion = useReducedMotion();
  const current = stageIndex(currentStage);

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-neutral-800)", border: "1px solid rgba(253, 245, 230, 0.06)" }}>
      <div className="mb-4 flex items-center justify-between">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Composite Pipeline
        </span>
        {failed && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(currentStage)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-[family-name:var(--font-body)] text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: "rgba(178, 40, 72, 0.12)",
              color: "var(--color-brand-red)",
            }}
          >
            <RotateCcwIcon className="size-3" />
            Retry this stage
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = i === current;
          const isComplete = i < current;
          const isFailed = isActive && failed;
          const isPending = i > current;

          let dotColor = "var(--color-neutral-600)";
          if (isComplete) dotColor = "#7BAE7E";
          if (isActive && !failed) dotColor = "var(--color-brand-orange)";
          if (isFailed) dotColor = "var(--color-brand-red)";

          return (
            <div key={stage.id} className="flex flex-1 items-center gap-1">
              <motion.div
                initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { ...houseSpring, delay: i * 0.06 }
                }
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="flex size-8 items-center justify-center rounded-full transition-colors"
                  style={{
                    backgroundColor: isComplete
                      ? "rgba(123, 174, 126, 0.15)"
                      : isActive
                        ? isFailed
                          ? "rgba(178, 40, 72, 0.12)"
                          : "rgba(242, 140, 82, 0.12)"
                        : "rgba(253, 245, 230, 0.04)",
                  }}
                >
                  {isActive && !failed ? (
                    <LoaderIcon
                      className="size-3.5 animate-spin"
                      style={{ color: dotColor }}
                    />
                  ) : isFailed ? (
                    <AlertCircleIcon
                      className="size-3.5"
                      style={{ color: dotColor }}
                    />
                  ) : (
                    <Icon
                      className="size-3.5"
                      style={{
                        color: isPending ? "var(--color-neutral-600)" : dotColor,
                      }}
                    />
                  )}
                </div>
                <span
                  className="font-[family-name:var(--font-body)] text-[10px]"
                  style={{
                    color: isPending
                      ? "var(--color-neutral-600)"
                      : isActive
                        ? isFailed
                          ? "var(--color-brand-red)"
                          : "var(--color-brand-orange)"
                        : "var(--color-neutral-400)",
                  }}
                >
                  {stage.label}
                </span>
              </motion.div>

              {i < STAGES.length - 1 && (
                <div
                  className="mx-0.5 h-px flex-1"
                  style={{
                    backgroundColor: isComplete
                      ? "rgba(123, 174, 126, 0.3)"
                      : "rgba(253, 245, 230, 0.06)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
