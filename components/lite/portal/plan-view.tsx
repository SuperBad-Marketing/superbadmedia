"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { PortalPlanData } from "@/lib/six-week-plan/portal-queries";
import type { WeekPlan, PlanTask } from "@/lib/ai/prompts/six-week-plan/weeks";
import {
  activatePlanAction,
  toggleTaskAction,
  submitRevisionAction,
  dismissRevisionReplyAction,
} from "@/app/lite/portal/[token]/plan/actions";
import { PdfRenderOverlay } from "@/components/lite/pdf-render-overlay";

interface Props {
  data: PortalPlanData;
  portalToken: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  content: "Content",
  distribution: "Distribution",
  conversion: "Conversion",
  measurement: "Measurement",
};

const CATEGORY_STYLES: Record<string, string> = {
  infrastructure: "bg-[rgba(242,140,82,0.12)] text-[var(--color-brand-orange)]",
  content: "bg-[rgba(244,160,176,0.10)] text-[var(--color-brand-pink)]",
  distribution: "bg-[rgba(178,40,72,0.12)] text-[#E05A7A]",
  conversion: "bg-[rgba(253,245,230,0.06)] text-[var(--color-brand-cream)]",
  measurement: "bg-[rgba(128,127,115,0.15)] text-[var(--color-neutral-300)]",
};

const EFFORT_LABELS: Record<string, string> = {
  quick: "Quick",
  half_day: "Half day",
  full_day: "Full day",
  multi_day: "Multi-day",
};

function getWeekStatus(
  weekNumber: number,
  activatedAtMs: number | null,
): "locked" | "current" | "past" | "future" {
  if (!activatedAtMs) return "locked";
  const daysSinceActivation = (Date.now() - activatedAtMs) / (1000 * 60 * 60 * 24);
  const weekStart = (weekNumber - 1) * 7;
  const weekEnd = weekNumber * 7;
  if (daysSinceActivation >= weekEnd) return "past";
  if (daysSinceActivation >= weekStart) return "current";
  return "future";
}

function getDayOfWeek(weekNumber: number, activatedAtMs: number): number {
  const daysSinceActivation = (Date.now() - activatedAtMs) / (1000 * 60 * 60 * 24);
  const dayInWeek = daysSinceActivation - (weekNumber - 1) * 7;
  return Math.min(7, Math.max(1, Math.ceil(dayInWeek)));
}

export function PlanView({ data, portalToken }: Props) {
  const { plan, prospect, taskProgress, retainerState } = data;
  const shouldReduceMotion = useReducedMotion();
  const isActivated = !!plan.activatedAtMs;
  const [expandedWeek, setExpandedWeek] = useState<number | null>(
    isActivated ? getCurrentWeekNumber(plan.activatedAtMs!) : null,
  );
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [pdfRendering, setPdfRendering] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    setPdfRendering(true);
    try {
      const res = await fetch(
        `/api/lite/portal/plan/${encodeURIComponent(plan.id)}/pdf`,
      );
      if (!res.ok) {
        setPdfRendering(false);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? "SuperBad-Six-Week-Plan.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setPdfRendering(false);
    }
  }, [plan.id]);

  const showRevisionReplyCard =
    plan.revisionReplySentAtMs && !plan.revisionReplyDismissedAtMs;
  const canRequestRevision =
    !plan.revisionRequestedAtMs && !isActivated && !retainerState.isRetainer;
  const showActivateButton =
    !isActivated && !retainerState.isRetainer;
  const planTitle = retainerState.strategyIsLive
    ? "Your Strategy"
    : "Your Six-Week Plan";

  const handleActivate = useCallback(async () => {
    setActivating(true);
    const result = await activatePlanAction(plan.id);
    if (!result.ok) {
      setActivating(false);
    }
  }, [plan.id]);

  return (
    <div className="mx-auto max-w-[740px] px-4 md:px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="pb-0 pt-12"
      >
        <span className="mb-3 block font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[3px] text-[var(--color-brand-pink)]">
          Strategy dated {new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
        </span>
        <h1 className="font-[family-name:var(--font-righteous)] text-[32px] uppercase tracking-[1px] text-[var(--color-brand-cream)]">
          {planTitle}
        </h1>
      </motion.div>

      {retainerState.pendingRefreshReview && (
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { ...houseSpring, delay: 0.05 }
          }
          className="mt-4 rounded-lg border border-[rgba(242,140,82,0.2)] bg-[rgba(242,140,82,0.06)] px-5 py-3.5"
        >
          <p className="text-[14px] leading-[1.6] text-[var(--color-neutral-300)]">
            {retainerState.paymentReceivedBeforeReview
              ? "Kicking off Week 1 shortly \u2014 Andy\u2019s finalising the refreshed plan."
              : "Andy\u2019s doing a pass on this before we kick off \u2014 live version lands on first payment."}
          </p>
        </motion.div>
      )}

      {showRevisionReplyCard && (
        <RevisionReplyCard
          resolution={plan.revisionResolution}
          replyBody={plan.revisionReplyBody}
          planId={plan.id}
        />
      )}

      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          shouldReduceMotion ? { duration: 0 } : { ...houseSpring, delay: 0.1 }
        }
        className="py-12"
      >
        <p className="max-w-[640px] text-[17px] leading-[1.7] text-[var(--color-neutral-300)]">
          {plan.planIntro}
        </p>
      </motion.div>

      {showActivateButton && (
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { ...houseSpring, delay: 0.2 }
          }
          className="mb-8 flex flex-col items-center gap-2"
        >
          <button
            onClick={handleActivate}
            disabled={activating}
            className="rounded-[8px] bg-[var(--color-brand-red)] px-12 py-4 text-[15px] font-semibold tracking-[0.3px] text-[var(--color-brand-cream)] transition-all hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(178,40,72,0.3)] active:translate-y-0 disabled:opacity-50"
          >
            {activating ? "Starting\u2026" : "Start Week 1"}
          </button>
          <span className="max-w-[300px] text-center text-[12px] leading-[1.5] text-[var(--color-neutral-500)]">
            {`You\u2019re running this. When you\u2019re ready, we\u2019ll start the clock.`}
          </span>
        </motion.div>
      )}

      <div className="flex flex-col gap-3 pb-2">
        {plan.weeks.map((week, i) => (
          <WeekCard
            key={week.week_number}
            week={week}
            index={i}
            isExpanded={expandedWeek === week.week_number}
            onToggle={() =>
              setExpandedWeek(
                expandedWeek === week.week_number ? null : week.week_number,
              )
            }
            weekStatus={getWeekStatus(week.week_number, plan.activatedAtMs)}
            dayOfWeek={
              plan.activatedAtMs
                ? getDayOfWeek(week.week_number, plan.activatedAtMs)
                : null
            }
            taskProgress={taskProgress.filter(
              (t) => t.weekNumber === week.week_number,
            )}
            planId={plan.id}
            isActivated={isActivated}
          />
        ))}
      </div>

      <PdfRenderOverlay visible={pdfRendering} />

      <div className="mt-12 flex flex-col items-center gap-3 pb-12">
        <button
          onClick={handleDownloadPdf}
          disabled={pdfRendering}
          className="text-[13px] text-[var(--color-neutral-500)] transition-colors hover:border-b hover:border-[var(--color-neutral-500)] hover:text-[var(--color-neutral-300)] disabled:opacity-50"
        >
          Download as PDF
        </button>

        {canRequestRevision ? (
          <div className="mt-10">
            <button
              onClick={() => setRevisionModalOpen(true)}
              className="text-[12px] text-[var(--color-neutral-500)] decoration-dashed decoration-[rgba(128,127,115,0.3)] underline-offset-2 transition-colors hover:text-[var(--color-neutral-300)] hover:underline"
            >
              {"This doesn\u2019t quite fit my business"}
            </button>
          </div>
        ) : plan.revisionRequestedAtMs && !isActivated ? (
          <div className="mt-10">
            <a
              href="mailto:andy@superbadmedia.com.au"
              className="text-[12px] text-[var(--color-neutral-500)] decoration-dashed decoration-[rgba(128,127,115,0.3)] underline-offset-2 transition-colors hover:text-[var(--color-neutral-300)] hover:underline"
            >
              Have more questions about this plan? Email Andy
            </a>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {revisionModalOpen && (
          <RevisionModal
            planId={plan.id}
            onClose={() => setRevisionModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function getCurrentWeekNumber(activatedAtMs: number): number {
  const daysSinceActivation =
    (Date.now() - activatedAtMs) / (1000 * 60 * 60 * 24);
  return Math.min(6, Math.max(1, Math.ceil(daysSinceActivation / 7)));
}

function WeekCard({
  week,
  index,
  isExpanded,
  onToggle,
  weekStatus,
  dayOfWeek,
  taskProgress,
  planId,
  isActivated,
}: {
  week: WeekPlan;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  weekStatus: "locked" | "current" | "past" | "future";
  dayOfWeek: number | null;
  taskProgress: Array<{
    weekNumber: number;
    taskIndex: number;
    completedAtMs: number | null;
  }>;
  planId: string;
  isActivated: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isLocked = weekStatus === "locked" || weekStatus === "future";
  const isCurrent = weekStatus === "current";
  const isPast = weekStatus === "past";

  const completedCount = taskProgress.filter((t) => t.completedAtMs).length;
  const totalTasks = week.tasks.length;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { ...houseSpring, delay: 0.05 * index }
      }
      className="overflow-hidden rounded-[16px] bg-[var(--color-neutral-800)] shadow-[inset_0_1px_0_rgba(253,245,230,0.04)]"
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-[rgba(253,245,230,0.015)]"
      >
        <span className="min-w-[64px] shrink-0 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[2px] text-[var(--color-brand-pink)]">
          Week {week.week_number}
        </span>
        <span className="flex-1 text-[15px] font-semibold text-[var(--color-brand-cream)]">
          {week.theme}
        </span>
        <div className="flex items-center gap-3">
          {isCurrent && dayOfWeek && (
            <span className="text-[12px] text-[var(--color-neutral-500)]">
              Day {dayOfWeek} of 7
            </span>
          )}
          {isPast && (
            <span className="text-[12px] text-[var(--color-neutral-500)]">
              {completedCount}/{totalTasks} done
            </span>
          )}
          {weekStatus === "future" && isActivated && (
            <span className="text-[12px] italic text-[var(--color-neutral-500)]">
              {`Opens when Week ${week.week_number - 1} wraps`}
            </span>
          )}
          <svg
            className={`h-5 w-5 text-[var(--color-neutral-500)] transition-transform duration-350 ${
              isExpanded ? "rotate-180" : ""
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            fill="none"
            viewBox="0 0 20 20"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M5 7.5L10 12.5L15 7.5" />
          </svg>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="overflow-hidden"
          >
            <div className="border-t border-[rgba(253,245,230,0.04)] px-6 pb-7 pt-5">
              <p className="mb-6 text-[15px] leading-[1.65] text-[var(--color-neutral-300)]">
                {week.why_this_week}
              </p>

              {week.content_angles.length > 0 && (
                <div className="mb-6">
                  <h4 className="mb-2.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2.5px] text-[var(--color-neutral-500)]">
                    Content angles
                  </h4>
                  <div className="flex flex-col gap-2">
                    {week.content_angles.map((angle, i) => (
                      <div key={i} className="flex items-baseline gap-2.5 text-[14px] text-[var(--color-neutral-300)]">
                        <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--color-brand-pink)]" />
                        <span>{angle.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {week.channel_mix.length > 0 && (
                <div className="mb-6">
                  <h4 className="mb-2.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2.5px] text-[var(--color-neutral-500)]">
                    Channels
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {week.channel_mix.map((ch) => (
                      <span
                        key={ch}
                        className="rounded-full border border-[rgba(244,160,176,0.12)] bg-[rgba(244,160,176,0.08)] px-3 py-1 text-[11px] font-semibold tracking-[0.5px] text-[var(--color-brand-pink)]"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h4 className="mb-2.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2.5px] text-[var(--color-neutral-500)]">
                  Tasks
                </h4>
                <div className="flex flex-col gap-2.5">
                  {week.tasks.map((task, ti) => (
                    <TaskRow
                      key={ti}
                      task={task}
                      taskIndex={ti}
                      weekNumber={week.week_number}
                      planId={planId}
                      canCheck={
                        isActivated &&
                        (weekStatus === "current" || weekStatus === "past")
                      }
                      completedAtMs={
                        taskProgress.find((t) => t.taskIndex === ti)
                          ?.completedAtMs ?? null
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[10px] border-l-[3px] border-l-[var(--color-brand-red)] bg-[rgba(178,40,72,0.06)] p-4">
                <div className="mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[2px] text-[var(--color-brand-red)]">
                    Success signal
                  </span>
                </div>
                <p className="text-[14px] leading-[1.5] text-[var(--color-brand-cream)]">
                  {week.success_signal}
                </p>
                <p className="mt-2.5 text-[13px] italic text-[var(--color-neutral-500)]">
                  <span className="not-italic font-semibold">If not:</span>{" "}
                  {week.fallback}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TaskRow({
  task,
  taskIndex,
  weekNumber,
  planId,
  canCheck,
  completedAtMs,
}: {
  task: PlanTask;
  taskIndex: number;
  weekNumber: number;
  planId: string;
  canCheck: boolean;
  completedAtMs: number | null;
}) {
  const [completed, setCompleted] = useState(!!completedAtMs);
  const [toggling, setToggling] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!canCheck || toggling) return;
    setToggling(true);
    const prev = completed;
    setCompleted(!prev);
    const result = await toggleTaskAction(planId, weekNumber, taskIndex);
    if (!result.ok) {
      setCompleted(prev);
    }
    setToggling(false);
  }, [canCheck, toggling, completed, planId, weekNumber, taskIndex]);

  return (
    <div
      className={`flex gap-3 rounded-[10px] bg-[var(--color-neutral-700)] p-4 shadow-[inset_0_1px_0_rgba(253,245,230,0.03)] ${
        completed ? "opacity-60" : ""
      }`}
    >
      {canCheck ? (
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-colors ${
            completed
              ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red)]"
              : "border-[var(--color-neutral-500)] bg-transparent hover:border-[var(--color-brand-pink)]"
          }`}
        >
          {completed && (
            <svg
              className="h-2.5 w-2.5 text-[var(--color-brand-cream)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
      ) : (
        <div className="mt-[5px] h-[18px] w-[18px] shrink-0 rounded border-2 border-[var(--color-neutral-500)]" />
      )}
      <div className="flex-1">
        <div
          className={`text-[14px] font-semibold ${
            completed
              ? "text-[var(--color-neutral-500)] line-through"
              : "text-[var(--color-brand-cream)]"
          }`}
        >
          {task.title}
        </div>
        <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-neutral-500)]">
          {task.detail}
        </p>
        <div className="mt-1.5 flex gap-2">
          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.5px] ${CATEGORY_STYLES[task.category] ?? "bg-[rgba(253,245,230,0.06)] text-[var(--color-neutral-300)]"}`}>
            {CATEGORY_LABELS[task.category] ?? task.category}
          </span>
          <span className="rounded bg-[rgba(253,245,230,0.04)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--color-neutral-500)]">
            {EFFORT_LABELS[task.effort_estimate] ?? task.effort_estimate}
          </span>
        </div>
      </div>
    </div>
  );
}

function RevisionReplyCard({
  resolution,
  replyBody,
  planId,
}: {
  resolution: string | null;
  replyBody: string | null;
  planId: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const isRegenerate = resolution === "regenerated";

  const handleDismiss = useCallback(async () => {
    setDismissing(true);
    await dismissRevisionReplyAction(planId);
  }, [planId]);

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
      className="mt-4 rounded-[8px] border border-[rgba(253,245,230,0.08)] bg-[var(--color-neutral-800)] px-5 py-4"
    >
      {isRegenerate ? (
        <div className="flex items-center justify-between">
          <p className="text-[14px] text-[var(--color-brand-cream)]">
            Your plan was revised after your note — have a read through.
          </p>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="ml-4 shrink-0 text-[13px] text-[var(--color-neutral-500)] underline underline-offset-2 hover:text-[var(--color-brand-cream)]"
          >
            Got it
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[14px] text-[var(--color-brand-cream)] underline underline-offset-2"
            >
              Andy replied to your revision note.
            </button>
            {!expanded && (
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="ml-4 shrink-0 text-[13px] text-[var(--color-neutral-500)] underline underline-offset-2 hover:text-[var(--color-brand-cream)]"
              >
                Got it
              </button>
            )}
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={
                  shouldReduceMotion ? { duration: 0 } : houseSpring
                }
                className="overflow-hidden"
              >
                <div className="mt-3 border-t border-[rgba(253,245,230,0.06)] pt-3">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--color-neutral-300)]">
                    {replyBody}
                  </p>
                  <button
                    onClick={handleDismiss}
                    disabled={dismissing}
                    className="mt-3 text-[13px] text-[var(--color-neutral-500)] underline underline-offset-2 hover:text-[var(--color-brand-cream)]"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function RevisionModal({
  planId,
  onClose,
}: {
  planId: string;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    const result = await submitRevisionAction(planId, note);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }, [planId, note, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 12 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] rounded-[12px] bg-[var(--color-neutral-800)] p-6"
      >
        <h2 className="mb-1 font-[family-name:var(--font-righteous)] text-[18px] text-[var(--color-brand-cream)]">
          Tell us what's off
        </h2>
        <p className="mb-4 text-[13px] text-[var(--color-neutral-500)]">
          You get one free revision on this plan. If you'd like more
          conversations about fit, that's something we can do as part of a
          retainer.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={"What doesn\u2019t fit? Be specific \u2014 \u201Cthe social posting cadence is too aggressive for my team size\u201D helps more than \u201Cit doesn\u2019t feel right.\u201D"}
          rows={5}
          className="w-full resize-none rounded-[8px] border border-[var(--color-neutral-600)] bg-[var(--color-neutral-900)] px-4 py-3 text-[14px] text-[var(--color-brand-cream)] placeholder:text-[var(--color-neutral-500)] focus:border-[var(--color-brand-orange)] focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`text-[12px] ${
              note.trim().length >= 40
                ? "text-[var(--color-neutral-500)]"
                : "text-[var(--color-brand-orange)]"
            }`}
          >
            {note.trim().length}/40 min
          </span>
          {error && (
            <span className="text-[12px] text-[var(--color-brand-red)]">
              {error}
            </span>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-[8px] px-4 py-2 text-[14px] text-[var(--color-neutral-500)] hover:text-[var(--color-brand-cream)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || note.trim().length < 40}
            className="rounded-[8px] bg-[var(--color-brand-red)] px-6 py-2 font-[family-name:var(--font-righteous)] text-[14px] text-[var(--color-brand-cream)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send revision note"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
