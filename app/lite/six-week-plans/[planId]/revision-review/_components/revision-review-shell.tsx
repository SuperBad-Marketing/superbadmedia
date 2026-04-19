"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { PlanForReview } from "@/lib/six-week-plan/queries";
import {
  regenerateWithRevisionNote,
  draftRevisionReply,
  sendRevisionReply,
} from "@/lib/six-week-plan/revision-actions";

type Props = {
  plan: PlanForReview["plan"];
  prospect: PlanForReview["prospect"];
};

export function RevisionReviewShell({ plan, prospect }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [replyMode, setReplyMode] = useState<"idle" | "drafting" | "manual" | "editing">("idle");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [draftSource, setDraftSource] = useState<"llm_drafted" | "hand_written">("hand_written");
  const [sent, setSent] = useState(!!plan.revisionReplySentAtMs);
  const [regenerated, setRegenerated] = useState(plan.revisionResolution === "regenerated");

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    const result = await regenerateWithRevisionNote(plan.id);
    if (result.ok) {
      setRegenerated(true);
    }
    setRegenerating(false);
  }, [plan.id]);

  const handleDraftReply = useCallback(async () => {
    setReplyMode("drafting");
    setDraftSource("llm_drafted");
    const result = await draftRevisionReply(plan.id);
    if (result.ok && result.draft) {
      setReplyText(result.draft);
      setReplyMode("editing");
    } else {
      setReplyMode("idle");
    }
  }, [plan.id]);

  const handleManualReply = useCallback(() => {
    setReplyMode("manual");
    setDraftSource("hand_written");
    setReplyText("");
  }, []);

  const handleSend = useCallback(async () => {
    if (!replyText.trim()) return;
    setSending(true);
    const result = await sendRevisionReply(plan.id, replyText, draftSource);
    if (result.ok) {
      setSent(true);
    }
    setSending(false);
  }, [plan.id, replyText, draftSource]);

  if (regenerated) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-lg font-medium">Plan is regenerating</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The prospect's revision note has been injected into a fresh generation.
          Check the{" "}
          <a
            href={`/lite/six-week-plans/${plan.id}/review`}
            className="underline hover:text-foreground"
          >
            review page
          </a>{" "}
          when the pipeline finishes.
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-lg font-medium">Reply sent</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The prospect has been notified. The plan stands as-is.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: plan summary */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Current plan — v{plan.generationVersion}
        </h2>
        {plan.weeksJson?.weeks.map((week) => (
          <motion.div
            key={week.week_number}
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { ...houseSpring, delay: 0.03 * week.week_number }
            }
            className="mb-3 border-b pb-3 last:border-b-0"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-orange-400">
                W{week.week_number}
              </span>
              <span className="text-sm font-medium">{week.theme}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {week.why_this_week}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Right: revision note + actions */}
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Prospect's revision note
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {plan.revisionNote ?? "No revision note."}
          </p>
        </div>

        {replyMode === "idle" && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {regenerating ? "Regenerating…" : "Regenerate with this note"}
            </button>
            <button
              onClick={handleDraftReply}
              className="rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Draft a reply
            </button>
            <button
              onClick={handleManualReply}
              className="rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Write my own reply
            </button>
          </div>
        )}

        {replyMode === "drafting" && (
          <div className="flex items-center justify-center rounded-lg border bg-card p-8">
            <p className="text-sm text-muted-foreground">Drafting reply…</p>
          </div>
        )}

        <AnimatePresence>
          {(replyMode === "editing" || replyMode === "manual") && (
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
              className="rounded-lg border bg-card p-5"
            >
              <h3 className="mb-2 text-sm font-semibold">
                {replyMode === "editing"
                  ? "LLM draft — edit freely"
                  : "Your reply"}
              </h3>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Write your reply to the prospect's revision note..."
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => {
                    setReplyMode("idle");
                    setReplyText("");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send reply"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
