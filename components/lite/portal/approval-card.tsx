"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import {
  handleTokenApprove,
  handleTokenReject,
} from "@/app/lite/portal/approve/[token]/actions";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  checked_at: string | null;
}

interface ApprovalCardProps {
  taskId: string;
  contactId: string;
  title: string;
  body: string | null;
  checklist: ChecklistItem[] | null;
  token: string;
}

export function ApprovalCard({
  taskId,
  contactId,
  title,
  body,
  checklist,
  token,
}: ApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { type: "approved" } | { type: "rejected" } | { type: "error"; reason: string } | null
  >(null);
  const shouldReduceMotion = useReducedMotion();

  function onApprove() {
    startTransition(async () => {
      const res = await handleTokenApprove(taskId, contactId, token);
      if (res.ok) {
        setResult({ type: "approved" });
      } else {
        setResult({ type: "error", reason: res.reason ?? "Something went wrong." });
      }
    });
  }

  function onReject() {
    if (!feedback.trim()) return;
    startTransition(async () => {
      const res = await handleTokenReject(taskId, contactId, token, feedback);
      if (res.ok) {
        setResult({ type: "rejected" });
      } else {
        setResult({ type: "error", reason: res.reason ?? "Something went wrong." });
      }
    });
  }

  if (result?.type === "approved") {
    return (
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="w-full max-w-lg rounded-[var(--radius-card)] border border-[rgba(42,107,74,0.3)] bg-[rgba(34,34,31,0.8)] p-8 text-center"
      >
        <div className="mb-4 text-3xl">✓</div>
        <h2 className="mb-2 font-[family-name:var(--font-playfair-display)] text-xl text-[var(--color-brand-cream)]">
          Approved
        </h2>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-[var(--color-neutral-500)]">
          You&rsquo;re all set. We&rsquo;ll take it from here.
        </p>
      </motion.div>
    );
  }

  if (result?.type === "rejected") {
    return (
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="w-full max-w-lg rounded-[var(--radius-card)] border border-[rgba(244,160,176,0.25)] bg-[rgba(34,34,31,0.8)] p-8 text-center"
      >
        <h2 className="mb-2 font-[family-name:var(--font-playfair-display)] text-xl text-[var(--color-brand-cream)]">
          Feedback sent
        </h2>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-[var(--color-neutral-500)]">
          Andy&rsquo;s on it. You&rsquo;ll see the updated version in your portal.
        </p>
      </motion.div>
    );
  }

  const progress = checklist
    ? { done: checklist.filter((c) => c.checked).length, total: checklist.length }
    : null;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
      className="w-full max-w-lg rounded-[var(--radius-card)] border border-[rgba(253,245,230,0.08)] bg-[rgba(34,34,31,0.8)] p-8"
    >
      <p className="mb-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
        Awaiting your approval
      </p>

      <h1 className="mb-4 font-[family-name:var(--font-playfair-display)] text-2xl text-[var(--color-brand-cream)]">
        {title}
      </h1>

      {body && (
        <p className="mb-5 font-[family-name:var(--font-dm-sans)] text-sm leading-relaxed text-[var(--color-neutral-300)]">
          {body}
        </p>
      )}

      {checklist && checklist.length > 0 && (
        <div className="mb-6">
          <p className="mb-2.5 text-[13px] text-[var(--color-neutral-500)]">
            {progress!.done} of {progress!.total} items complete
          </p>
          <div className="flex flex-col gap-1.5">
            {checklist.map((item) => (
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
        </div>
      )}

      {result?.type === "error" && (
        <p className="mb-4 text-xs text-[var(--color-brand-red)]">
          {result.reason}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-transparent bg-[#2A6B4A] px-5 py-2.5 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-brand-cream)] transition-colors duration-200 hover:bg-[#1F5538] disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => setRejectOpen((prev) => !prev)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-[rgba(253,245,230,0.15)] bg-transparent px-5 py-2.5 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-neutral-300)] transition-colors duration-200 hover:border-[rgba(253,245,230,0.3)] disabled:opacity-50"
        >
          Request changes
        </button>
      </div>

      <AnimatePresence>
        {rejectOpen && (
          <motion.div
            initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="what needs to change? be specific — it goes straight to Andy."
                className="h-24 w-full resize-none rounded-lg border border-[rgba(253,245,230,0.1)] bg-[rgba(26,26,24,0.6)] p-3 font-[family-name:var(--font-dm-sans)] text-sm text-[var(--color-brand-cream)] outline-none placeholder:italic placeholder:text-[var(--color-neutral-500)]"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={onReject}
                  disabled={isPending || !feedback.trim()}
                  className="rounded-[var(--radius-button)] border border-transparent bg-[var(--color-brand-red)] px-4 py-2.5 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1px] text-[var(--color-brand-cream)] transition-colors duration-200 hover:bg-[#8F1D3A] disabled:opacity-50"
                >
                  Send feedback
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
