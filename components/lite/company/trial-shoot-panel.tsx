"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TRIAL_SHOOT_SEQUENCE,
  legalForwardTargets,
  type TrialShootStatus,
} from "@/lib/crm/trial-shoot-status";

import {
  advanceTrialShootStatusAction,
  updateTrialShootPlanAction,
} from "@/app/lite/admin/companies/[id]/actions";

function formatMelbourne(ms: number): string {
  return new Date(ms).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Display labels for sub-statuses. Order matches `TRIAL_SHOOT_SEQUENCE`.
 * `none` is rendered as a pre-stepper chip, not a step.
 */
const STATUS_LABELS: Record<TrialShootStatus, string> = {
  none: "Not started",
  booked: "Booked",
  planned: "Planned",
  in_progress: "In progress",
  completed_awaiting_feedback: "Awaiting feedback",
  completed_feedback_provided: "Feedback received",
};

const STEPS: TrialShootStatus[] = TRIAL_SHOOT_SEQUENCE.filter(
  (s) => s !== "none",
);

export interface TrialShootPanelProps {
  companyId: string;
  initialStatus: TrialShootStatus;
  initialPlan: string | null;
  completedAtMs: number | null;
  feedback: string | null;
}

export function TrialShootPanel({
  companyId,
  initialStatus,
  initialPlan,
  completedAtMs,
  feedback,
}: TrialShootPanelProps) {
  const [status, setStatus] = useState<TrialShootStatus>(initialStatus);
  const [plan, setPlan] = useState(initialPlan ?? "");
  const [savedPlan, setSavedPlan] = useState(initialPlan ?? "");
  const [completedAt, setCompletedAt] = useState<number | null>(completedAtMs);
  const [isAdvancing, startAdvance] = useTransition();
  const [isSaving, startSave] = useTransition();

  const forwardTargets = legalForwardTargets(status);
  const dirty = plan !== savedPlan;

  function handleAdvance(next: TrialShootStatus) {
    startAdvance(async () => {
      const res = await advanceTrialShootStatusAction(companyId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(res.value.status);
      if (
        (next === "completed_awaiting_feedback" ||
          next === "completed_feedback_provided") &&
        completedAt == null
      ) {
        setCompletedAt(Date.now());
      }
      toast.success(`Status: ${STATUS_LABELS[res.value.status]}.`);
    });
  }

  function handleSavePlan() {
    startSave(async () => {
      const res = await updateTrialShootPlanAction(companyId, plan);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSavedPlan(plan);
      toast.success("Plan saved.");
    });
  }

  return (
    <section className="space-y-8 rounded-lg border border-border bg-card p-6">
      <header className="space-y-1">
        <h2 className="font-heading text-xl font-semibold">Trial Shoot</h2>
        <p className="text-sm text-muted-foreground">
          Sub-status is orthogonal to the Deal stage — the Deal stays in
          Trial Shoot for the whole lifecycle.
        </p>
      </header>

      {/* Stepper */}
      <div className="space-y-3">
        {status === "none" && (
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
            Not started
          </div>
        )}
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => {
            const currentIdx = STEPS.indexOf(status as TrialShootStatus);
            const reached = status !== "none" && i <= currentIdx;
            const isCurrent = s === status;
            return (
              <li key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors",
                    reached
                      ? isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {STATUS_LABELS[s]}
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={cn(
                      "h-px w-6 transition-colors",
                      i < STEPS.indexOf(status as TrialShootStatus)
                        ? "bg-primary/40"
                        : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
        {completedAt != null && (
          <p className="text-xs text-muted-foreground">
            Completed {formatMelbourne(completedAt)}
          </p>
        )}
      </div>

      {/* Advance control */}
      {forwardTargets.length > 0 ? (
        <div className="flex items-center gap-2">
          <Select
            disabled={isAdvancing}
            onValueChange={(v) => handleAdvance(v as TrialShootStatus)}
          >
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Advance status…" />
            </SelectTrigger>
            <SelectContent>
              {forwardTargets.map((t) => (
                <SelectItem key={t} value={t}>
                  {STATUS_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Forward-only. No regression.
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Lifecycle complete — no further transitions.
        </p>
      )}

      {/* Plan */}
      <div className="space-y-2">
        <label
          htmlFor="trial-shoot-plan"
          className="block text-sm font-medium"
        >
          Plan
        </label>
        <Textarea
          id="trial-shoot-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="What we're shooting, when, and what the deliverables look like."
          rows={5}
          disabled={isSaving}
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSavePlan}
            disabled={!dirty || isSaving}
            size="sm"
          >
            {isSaving ? "Saving…" : "Save plan"}
          </Button>
          {dirty && (
            <span className="text-xs text-muted-foreground">Unsaved</span>
          )}
        </div>
      </div>

      {/* Feedback */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Feedback</h3>
        {feedback ? (
          <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
            {feedback}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        )}
      </div>
    </section>
  );
}
