"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckIcon, LoaderIcon, XIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

export type RenderStage =
  | "preparing"
  | "rendering"
  | "uploading"
  | "finalising"
  | "complete"
  | "failed";

const STAGES: { key: RenderStage; label: string }[] = [
  { key: "preparing", label: "Preparing" },
  { key: "rendering", label: "Rendering" },
  { key: "uploading", label: "Uploading" },
  { key: "finalising", label: "Finalising" },
  { key: "complete", label: "Done" },
];

function stageIndex(stage: RenderStage): number {
  if (stage === "failed") return -1;
  return STAGES.findIndex((s) => s.key === stage);
}

function stagePercent(stage: RenderStage): number {
  const map: Record<RenderStage, number> = {
    preparing: 10,
    rendering: 40,
    uploading: 70,
    finalising: 90,
    complete: 100,
    failed: 0,
  };
  return map[stage];
}

interface RenderProgressProps {
  stage: RenderStage;
  visible: boolean;
  itemsDone?: number;
  itemsTotal?: number;
  error?: string;
}

/* ── Compact inline download progress ─────────────────────── */

export type DownloadStage = "fetching" | "saving" | "complete" | "failed";

interface DownloadProgressProps {
  stage: DownloadStage;
  percent: number;
  visible: boolean;
}

export function DownloadProgress({
  stage,
  percent,
  visible,
}: DownloadProgressProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
          className="flex items-center gap-2"
        >
          <div
            className="h-1 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${percent}%` }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.3, ease: "easeOut" }
              }
              style={{
                backgroundColor:
                  stage === "complete"
                    ? "#7BAE7E"
                    : stage === "failed"
                      ? "var(--color-brand-red)"
                      : "var(--color-brand-orange)",
              }}
            />
          </div>
          <span
            className="font-[family-name:var(--font-label)] text-[9px] tabular-nums uppercase"
            style={{
              letterSpacing: "1px",
              color:
                stage === "complete"
                  ? "#7BAE7E"
                  : stage === "failed"
                    ? "var(--color-brand-red)"
                    : "var(--color-neutral-500)",
            }}
          >
            {stage === "complete"
              ? "Saved"
              : stage === "failed"
                ? "Failed"
                : `${percent}%`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Full render progress bar ─────────────────────────────── */

export function RenderProgress({
  stage,
  visible,
  itemsDone = 0,
  itemsTotal = 1,
  error,
}: RenderProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  const percent = stagePercent(stage);
  const currentIdx = stageIndex(stage);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
          className="rounded-xl p-4"
          style={{
            backgroundColor:
              stage === "failed"
                ? "rgba(178, 40, 72, 0.08)"
                : "rgba(253, 245, 230, 0.03)",
            border:
              stage === "failed"
                ? "1px solid rgba(178, 40, 72, 0.2)"
                : "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          {/* Progress bar */}
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${percent}%` }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.4, ease: "easeOut" }
              }
              style={{
                backgroundColor:
                  stage === "complete"
                    ? "#7BAE7E"
                    : stage === "failed"
                      ? "var(--color-brand-red)"
                      : "var(--color-brand-orange)",
              }}
            />
          </div>

          {/* Stage + percent */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {stage === "failed" ? (
                <XIcon
                  className="size-3.5"
                  style={{ color: "var(--color-brand-red)" }}
                />
              ) : stage === "complete" ? (
                <CheckIcon className="size-3.5" style={{ color: "#7BAE7E" }} />
              ) : (
                <LoaderIcon
                  className="size-3.5 animate-spin"
                  style={{ color: "var(--color-brand-orange)" }}
                />
              )}
              <span
                className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                style={{
                  color:
                    stage === "failed"
                      ? "var(--color-brand-red)"
                      : stage === "complete"
                        ? "#7BAE7E"
                        : "var(--color-brand-cream)",
                }}
              >
                {stage === "failed"
                  ? "Render failed"
                  : STAGES[currentIdx]?.label ?? stage}
              </span>
            </div>
            <span
              className="font-[family-name:var(--font-body)] text-[12px] tabular-nums"
              style={{ color: "var(--color-neutral-500)" }}
            >
              {stage === "failed" ? "" : `${percent}%`}
              {itemsTotal > 1 &&
                stage !== "complete" &&
                stage !== "failed" &&
                ` · ${itemsDone}/${itemsTotal}`}
            </span>
          </div>

          {/* Stage dots */}
          <div className="flex items-center gap-1">
            {STAGES.filter((s) => s.key !== "complete").map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <div
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      i < currentIdx
                        ? "#7BAE7E"
                        : i === currentIdx
                          ? "var(--color-brand-orange)"
                          : "rgba(253, 245, 230, 0.1)",
                  }}
                />
                {i < STAGES.length - 2 && (
                  <div
                    className="h-px w-4"
                    style={{
                      backgroundColor:
                        i < currentIdx
                          ? "rgba(123, 174, 126, 0.3)"
                          : "rgba(253, 245, 230, 0.06)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p
              className="mt-2 font-[family-name:var(--font-body)] text-[12px]"
              style={{ color: "var(--color-brand-red)" }}
            >
              {error}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
