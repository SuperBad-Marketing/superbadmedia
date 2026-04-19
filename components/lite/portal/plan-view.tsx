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
  const { plan, prospect, taskProgress } = data;
  const shouldReduceMotion = useReducedMotion();
  const isActivated = !!plan.activatedAtMs;
  const [expandedWeek, setExpandedWeek] = useState<number | null>(
    isActivated ? getCurrentWeekNumber(plan.activatedAtMs!) : null,
  );
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  const showRevisionReplyCard =
    plan.revisionReplySentAtMs && !plan.revisionReplyDismissedAtMs;
  const canRequestRevision =
    !plan.revisionRequestedAtMs && !isActivated;

  const handleActivate = useCallback(async () => {
    setActivating(true);
    const result = await activatePlanAction(plan.id);
    if (!result.ok) {
      setActivating(false);
    }
  }, [plan.id]);

  return (
    <div className="mx-auto max-w-[780px] px-4 md:px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10"
      >
        <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
          strategy
        </span>
        <h1 className="font-[family-name:var(--font-black-han-sans)] text-3xl leading-none text-[var(--color-brand-cream)] sm:text-4xl">
          Your Six-Week Plan
        </h1>
        <p className="mt-3 font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
          Built from everything we learned about your business — what you told
          us, what we found, and what we saw on shoot day.
        </p>
      </motion.div>

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
        className="py-8"
      >
        <p className="text-[16px] leading-relaxed text-[var(--color-brand-cream)]">
          {plan.planIntro}
        </p>
      </motion.div>

      {!isActivated && (
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
            className="rounded-[8px] bg-[var(--color-brand-red)] px-8 py-3 font-[family-name:var(--font-righteous)] text-[15px] uppercase tracking-[1px] text-[var(--color-brand-cream)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {activating ? "Starting…" : "Start Week 1"}
          </button>
          <span className="text-center text-[13px] text-[var(--color-neutral-500)]">
            You're running this. When you're ready, we'll start the clock.
          </span>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
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

      <div className="mt-10 flex flex-col items-center gap-4 border-t border-[rgba(253,245,230,0.06)] pb-12 pt-8">
        <a
          href={`/api/lite/portal/plan/${encodeURIComponent(plan.id)}/pdf`}
          className="text-[13px] text-[var(--color-neutral-500)] underline underline-offset-2 transition-colors hover:text-[var(--color-brand-cream)]"
        >
          Download as PDF
        </a>

        {canRequestRevision ? (
          <button
            onClick={() => setRevisionModalOpen(true)}
            className="text-[13px] text-[var(--color-neutral-500)] underline underline-offset-2 transition-colors hover:text-[var(--color-brand-cream)]"
          >
            {"This doesn\u2019t fit my business"}
          </button>
        ) : plan.revisionRequestedAtMs && !isActivated ? (
          <a
            href="mailto:andy@superbadmedia.com.au"
            className="text-[13px] text-[var(--color-neutral-500)] underline underline-offset-2 transition-colors hover:text-[var(--color-brand-cream)]"
          >
            Have more questions about this plan? Email Andy
          </a>
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
      className={`overflow-hidden rounded-[8px] border ${
        isCurrent
          ? "border-[var(--color-brand-orange)]/30 bg-[var(--color-neutral-800)]"
          : "border-[rgba(253,245,230,0.06)] bg-[var(--color-neutral-900)]"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1.5px] text-[var(--color-brand-orange)]">
            Week {week.week_number}
          </span>
          <span className="text-[15px] font-medium text-[var(--color-brand-cream)]">
            {week.theme}
          </span>
        </div>
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
              {`This week opens when Week ${week.week_number - 1} wraps.`}
            </span>
          )}
          <svg
            className={`h-4 w-4 text-[var(--color-neutral-500)] transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
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
            <div className="border-t border-[rgba(253,245,230,0.06)] px-5 pb-6 pt-4">
              <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-neutral-300)]">
                {week.why_this_week}
              </p>

              {week.content_angles.length > 0 && (
                <div className="mb-4">
                  <h4 className="mb-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[1.5px] text-[var(--color-neutral-500)]">
                    Content angles
                  </h4>
                  <div className="flex flex-col gap-2">
                    {week.content_angles.map((angle, i) => (
                      <div key={i} className="text-[13px] text-[var(--color-neutral-300)]">
                        <span className="mr-2 inline-block rounded bg-[var(--color-neutral-700)] px-2 py-0.5 text-[11px] text-[var(--color-brand-pink)]">
                          {angle.shoot_asset_ref}
                        </span>
                        {angle.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {week.channel_mix.length > 0 && (
                <div className="mb-4">
                  <h4 className="mb-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[1.5px] text-[var(--color-neutral-500)]">
                    Channels
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {week.channel_mix.map((ch) => (
                      <span
                        key={ch}
                        className="rounded-full bg-[var(--color-neutral-700)] px-3 py-1 text-[12px] text-[var(--color-brand-cream)]"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h4 className="mb-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[1.5px] text-[var(--color-neutral-500)]">
                  Tasks
                </h4>
                <div className="flex flex-col gap-2">
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

              <div className="mt-4 rounded-[8px] bg-[var(--color-neutral-800)] p-4">
                <div className="mb-2">
                  <span className="text-[12px] font-medium text-[var(--color-brand-orange)]">
                    Success signal
                  </span>
                  <p className="text-[13px] text-[var(--color-neutral-300)]">
                    {week.success_signal}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                    Fallback
                  </span>
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    {week.fallback}
                  </p>
                </div>
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
      className={`flex items-start gap-3 rounded-[6px] p-2 ${
        completed ? "opacity-60" : ""
      }`}
    >
      {canCheck ? (
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            completed
              ? "border-[var(--color-brand-orange)] bg-[var(--color-brand-orange)]"
              : "border-[var(--color-neutral-600)] bg-transparent"
          } transition-colors`}
        >
          {completed && (
            <svg
              className="h-3 w-3 text-[var(--color-neutral-900)]"
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
        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-neutral-600)]" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[14px] font-medium ${
              completed
                ? "text-[var(--color-neutral-500)] line-through"
                : "text-[var(--color-brand-cream)]"
            }`}
          >
            {task.title}
          </span>
          <span className="rounded bg-[var(--color-neutral-700)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.5px] text-[var(--color-neutral-500)]">
            {CATEGORY_LABELS[task.category] ?? task.category}
          </span>
          <span className="text-[10px] text-[var(--color-neutral-500)]">
            {EFFORT_LABELS[task.effort_estimate] ?? task.effort_estimate}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-[var(--color-neutral-500)]">
          {task.detail}
        </p>
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
