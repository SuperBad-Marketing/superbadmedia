"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import { triggerManualRunAction } from "../actions";

const PIPELINE_STEPS = [
  "Checking warmup budget",
  "Picking search vertical",
  "Searching discovery sources",
  "Deduplicating candidates",
  "Pre-filtering by ICP fit",
  "Enriching candidates",
  "Scoring & qualifying",
  "Deep-enriching top picks",
  "Finding contact emails",
  "Generating outreach drafts",
  "Writing run summary",
] as const;

const STEP_INTERVAL_MS = 4000;

function PipelineStepper({ currentStep }: { currentStep: number }) {
  const progress = ((currentStep + 1) / PIPELINE_STEPS.length) * 100;

  return (
    <div
      className="absolute right-0 top-full mt-3 z-10 rounded-xl w-[320px] overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight), 0 8px 32px rgba(0,0,0,0.4)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Pipeline
          </span>
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase tabular-nums"
            style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
          >
            {currentStep + 1}/{PIPELINE_STEPS.length}
          </span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--color-brand-red), var(--color-brand-pink))",
            }}
          />
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-0.5">
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div
              key={step}
              className="flex items-center gap-2.5 py-1 font-[family-name:var(--font-body)] text-[12px] transition-all duration-300"
              style={{
                opacity: isDone ? 0.4 : isCurrent ? 1 : 0.2,
                color: isCurrent
                  ? "var(--color-brand-pink)"
                  : "var(--color-brand-cream)",
              }}
            >
              <span
                className="w-4 h-4 shrink-0 flex items-center justify-center rounded-full text-[9px]"
                style={{
                  backgroundColor: isDone
                    ? "rgba(123, 174, 126, 0.15)"
                    : isCurrent
                      ? "rgba(244, 160, 176, 0.15)"
                      : "transparent",
                  color: isDone
                    ? "var(--color-success)"
                    : isCurrent
                      ? "var(--color-brand-pink)"
                      : "var(--color-neutral-600)",
                }}
              >
                {isDone ? "✓" : isCurrent ? (
                  <span className="inline-block animate-spin text-[10px]">⟳</span>
                ) : (
                  <span className="block w-1 h-1 rounded-full" style={{ backgroundColor: "currentColor" }} />
                )}
              </span>
              <span className="truncate">{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeadGenRunButton() {
  const [running, setRunning] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const stepTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToastWithSound();

  React.useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  async function handleClick() {
    setRunning(true);
    setCurrentStep(0);

    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) =>
        prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, STEP_INTERVAL_MS);

    try {
      const result = await triggerManualRunAction();

      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setRunning(false);

      if (result.ok) {
        if (result.sourceErrors) {
          const errLines = Object.entries(result.sourceErrors)
            .map(([src, msg]) => `• ${src}: ${msg}`)
            .join("\n");
          toast.error(`Sources failed:\n${errLines}`);
          return;
        }
        const parts = [
          `${result.foundCount} discovered`,
          `${result.qualifiedCount} qualified`,
          `${result.candidatesCreated} with email`,
        ];
        if (result.dncFilteredCount > 0) {
          parts.push(`${result.dncFilteredCount} DNC-blocked`);
        }
        if (result.cappedReason) {
          parts.push(`capped: ${result.cappedReason}`);
        }
        toast(`Search complete — ${parts.join(" → ")}.`, {
          sound: "kanban-drop",
        });
      } else {
        toast.error(result.error);
      }
    } catch {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setRunning(false);
      toast.error("Search failed — check the console.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-neutral-600)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-300)] transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40 disabled:pointer-events-none"
      >
        <Play size={12} strokeWidth={1.5} aria-hidden />
        {running ? "Running…" : "Run now"}
      </button>
      {running && <PipelineStepper currentStep={currentStep} />}
    </div>
  );
}
