"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { PortalTask, ChecklistItem, TaskStatus } from "@/lib/tasks/types";
import { handleApprove, handleReject } from "@/app/lite/portal/[token]/deliverables/actions";

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "awaiting_approval":
      return "Awaiting approval";
    case "in_progress":
      return "In progress";
    case "delivered":
      return "Delivered";
    case "done":
      return "Done";
    case "blocked":
      return "Blocked";
    case "todo":
      return "To do";
    case "cancelled":
      return "Cancelled";
  }
}

function statusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case "awaiting_approval":
      return "bg-[rgba(242,140,82,0.15)] text-[var(--color-brand-orange)]";
    case "in_progress":
      return "bg-[rgba(244,160,176,0.12)] text-[var(--color-brand-pink)]";
    case "delivered":
    case "done":
      return "bg-[rgba(42,107,74,0.2)] text-[#5FBF8A]";
    case "blocked":
      return "bg-[rgba(178,40,72,0.15)] text-[var(--color-brand-red)]";
    default:
      return "bg-[rgba(253,245,230,0.06)] text-[var(--color-neutral-500)]";
  }
}

function checklistProgress(checklist: ChecklistItem[] | null): {
  done: number;
  total: number;
  percent: number;
} {
  if (!checklist || checklist.length === 0) return { done: 0, total: 0, percent: 0 };
  const done = checklist.filter((c) => c.checked).length;
  return { done, total: checklist.length, percent: Math.round((done / checklist.length) * 100) };
}

function formatDueDate(dateStr: string | null, status: TaskStatus): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const formatted = d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (status === "delivered" || status === "done") return `Delivered ${formatted}`;
  return `Due ${formatted}`;
}

function DeliverableCard({ task }: { task: PortalTask }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const progress = checklistProgress(task.checklist);
  const isAwaitingApproval = task.status === "awaiting_approval";
  const isDelivered = task.status === "delivered" || task.status === "done";
  const isInProgress = task.status === "in_progress" || task.status === "todo" || task.status === "blocked";

  function onApprove(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await handleApprove(task.id);
      if (!result.ok) {
        setActionResult(result.reason ?? "Something went wrong.");
      } else {
        setActionResult("Approved.");
      }
    });
  }

  function onRejectToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setRejectOpen((prev) => !prev);
  }

  function onRejectSend(e: React.MouseEvent) {
    e.stopPropagation();
    if (!feedback.trim()) return;
    startTransition(async () => {
      const result = await handleReject(task.id, feedback);
      if (!result.ok) {
        setActionResult(result.reason ?? "Something went wrong.");
      } else {
        setActionResult("Feedback sent.");
        setFeedback("");
        setRejectOpen(false);
      }
    });
  }

  const dueLine = formatDueDate(task.due_at, task.status);
  const itemCount =
    progress.total > 0 ? ` · ${progress.total} items` : "";

  return (
    <motion.div
      layout={!shouldReduceMotion}
      className={`mb-3.5 cursor-pointer rounded-[var(--radius-card)] border bg-[rgba(34,34,31,0.6)] p-6 transition-colors duration-300 ${
        expanded
          ? "cursor-default border-[rgba(244,160,176,0.25)]"
          : "border-[rgba(253,245,230,0.08)] hover:border-[rgba(253,245,230,0.14)]"
      }`}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Top row: title + status badge */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-base font-medium text-[var(--color-brand-cream)]">
            {task.title}
          </div>
          <div className="mt-1 text-xs text-[var(--color-neutral-500)]">
            {dueLine}{itemCount}
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded px-2.5 py-1 font-[family-name:var(--font-righteous)] text-[9px] uppercase tracking-[1.5px] ${statusBadgeClass(task.status)}`}
        >
          {statusLabel(task.status)}
        </span>
      </div>

      {/* Checklist progress summary */}
      {progress.total > 0 && (
        <>
          <div className="text-[13px] text-[var(--color-neutral-500)]">
            {progress.done} of {progress.total} items complete
          </div>
          <div className="mt-3.5 h-1 overflow-hidden rounded-sm bg-[rgba(253,245,230,0.06)]">
            <motion.div
              className="h-full rounded-sm bg-[var(--color-brand-pink)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress.percent}%` }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </>
      )}

      {/* Expandable preview panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-4.5 border-t border-[rgba(253,245,230,0.06)] pt-4.5">
              {/* In-progress message */}
              {isInProgress && (
                <p className="py-5 font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
                  Still in progress. You&rsquo;ll see it here when it&rsquo;s ready for your eyes.
                </p>
              )}

              {/* Checklist items */}
              {task.checklist && task.checklist.length > 0 && (
                <div className="mb-4.5 flex flex-col gap-1.5">
                  {task.checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 rounded-lg bg-[rgba(26,26,24,0.4)] px-3.5 py-2.5 text-sm"
                    >
                      {item.checked ? (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgba(42,107,74,0.3)] text-[11px] text-[#5FBF8A]">
                          ✓
                        </span>
                      ) : (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgba(242,140,82,0.15)] text-[11px] text-[var(--color-brand-orange)]">
                          ○
                        </span>
                      )}
                      <span
                        className={
                          item.checked
                            ? "text-[var(--color-neutral-500)] line-through"
                            : "text-[var(--color-neutral-300)]"
                        }
                      >
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions row */}
              {(isAwaitingApproval || isDelivered) && (
                <div className="flex gap-2 border-t border-[rgba(253,245,230,0.05)] pt-3.5">
                  {isAwaitingApproval && (
                    <>
                      <button
                        onClick={onApprove}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-transparent bg-[#2A6B4A] px-3.5 py-2 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-brand-cream)] transition-colors duration-200 hover:bg-[#1F5538] disabled:opacity-50"
                      >
                        {progress.total > 1 ? "Approve all" : "Approve"}
                      </button>
                      <button
                        onClick={onRejectToggle}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-[rgba(253,245,230,0.15)] bg-transparent px-3.5 py-2 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-neutral-300)] transition-colors duration-200 hover:border-[rgba(253,245,230,0.3)] disabled:opacity-50"
                      >
                        Request changes
                      </button>
                    </>
                  )}
                  {isDelivered && (
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-[rgba(253,245,230,0.15)] bg-transparent px-3.5 py-2 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-neutral-300)] transition-colors duration-200 hover:border-[rgba(253,245,230,0.3)]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-3.5 w-3.5"
                      >
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download
                    </button>
                  )}
                </div>
              )}

              {/* Reject feedback input */}
              <AnimatePresence>
                {rejectOpen && (
                  <motion.div
                    initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3">
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="what needs to change? be specific — it goes straight to Andy."
                        className="h-20 w-full resize-none rounded-lg border border-[rgba(253,245,230,0.1)] bg-[rgba(26,26,24,0.6)] p-3 font-[family-name:var(--font-dm-sans)] text-sm text-[var(--color-brand-cream)] outline-none placeholder:italic placeholder:text-[var(--color-neutral-500)]"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={onRejectSend}
                          disabled={isPending || !feedback.trim()}
                          className="rounded-[var(--radius-button)] border border-transparent bg-[var(--color-brand-red)] px-3.5 py-2 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-brand-cream)] transition-colors duration-200 hover:bg-[#8F1D3A] disabled:opacity-50"
                        >
                          Send feedback
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action result feedback */}
              {actionResult && (
                <p className="mt-2 text-xs italic text-[var(--color-neutral-500)]">
                  {actionResult}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface DeliverablesListProps {
  tasks: PortalTask[];
}

export function DeliverablesList({ tasks }: DeliverablesListProps) {
  const shouldReduceMotion = useReducedMotion();

  if (tasks.length === 0) {
    return (
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : { ...houseSpring, delay: 0.15 }}
        className="flex min-h-[40vh] items-center justify-center"
      >
        <p className="text-center font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]">
          nothing here yet. when there is, you&rsquo;ll know.
        </p>
      </motion.div>
    );
  }

  const awaiting = tasks.filter((t) => t.status === "awaiting_approval");
  const inProgress = tasks.filter(
    (t) => t.status === "in_progress" || t.status === "todo" || t.status === "blocked",
  );
  const delivered = tasks.filter(
    (t) => t.status === "delivered" || t.status === "done",
  );

  return (
    <div className="space-y-6">
      {awaiting.length > 0 && (
        <Section label="Awaiting your approval" tasks={awaiting} shouldReduceMotion={shouldReduceMotion} delay={0} />
      )}
      {inProgress.length > 0 && (
        <Section label="In progress" tasks={inProgress} shouldReduceMotion={shouldReduceMotion} delay={awaiting.length > 0 ? 0.1 : 0} />
      )}
      {delivered.length > 0 && (
        <Section label="Delivered" tasks={delivered} shouldReduceMotion={shouldReduceMotion} delay={(awaiting.length > 0 ? 0.1 : 0) + (inProgress.length > 0 ? 0.1 : 0)} />
      )}
    </div>
  );
}

function Section({
  label,
  tasks,
  shouldReduceMotion,
  delay,
}: {
  label: string;
  tasks: PortalTask[];
  shouldReduceMotion: boolean | null;
  delay: number;
}) {
  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { ...houseSpring, delay }}
    >
      <h3 className="mb-3 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
        {label}
      </h3>
      {tasks.map((task) => (
        <DeliverableCard key={task.id} task={task} />
      ))}
    </motion.div>
  );
}
