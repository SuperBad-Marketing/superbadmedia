"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import { triggerManualRunAction } from "../actions";

const PIPELINE_STEPS = [
  "Checking warmup budget",
  "Searching Google Maps",
  "Deduplicating candidates",
  "Checking website quality",
  "Looking up domain age",
  "Scraping websites",
  "Checking YouTube channels",
  "Scoring & qualifying",
  "Finding contact emails",
  "Generating outreach drafts",
  "Writing run summary",
] as const;

const STEP_INTERVAL_MS = 4000;

function PipelineStepper({ currentStep }: { currentStep: number }) {
  return (
    <div
      className="absolute left-0 right-0 top-full mt-3 z-10 rounded-lg border px-4 py-3"
      style={{
        backgroundColor: "var(--color-neutral-800)",
        borderColor: "rgba(253, 245, 230, 0.08)",
      }}
    >
      <div className="flex flex-col gap-1.5">
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div
              key={step}
              className="flex items-center gap-2 font-[family-name:var(--font-body)] text-[12px] transition-opacity duration-300"
              style={{
                opacity: isDone ? 0.35 : isCurrent ? 1 : 0.15,
                color: isCurrent
                  ? "var(--color-brand-pink)"
                  : "var(--color-brand-cream)",
              }}
            >
              <span className="w-3.5 text-center shrink-0">
                {isDone ? "✓" : isCurrent ? (
                  <span className="inline-block animate-spin">⟳</span>
                ) : "·"}
              </span>
              {step}
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
