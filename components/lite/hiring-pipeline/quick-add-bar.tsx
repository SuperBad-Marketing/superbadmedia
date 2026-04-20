"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useToastWithSound } from "@/components/lite/toast-with-sound";
import {
  quickAddCandidateAction,
  confirmQuickAddInviteAction,
  type QuickAddResult,
} from "@/app/lite/admin/hiring/actions";

const HOUSE_SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

function scoreColor(score: number): string {
  if (score >= 0.8) return "var(--color-state-success)";
  if (score >= 0.5) return "var(--color-brand-orange)";
  return "var(--color-neutral-400)";
}

function confidenceLabel(c: number): string {
  if (c >= 0.85) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}

export function QuickAddBar() {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<QuickAddResult | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const toast = useToastWithSound();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setResult(null);

    const res = await quickAddCandidateAction(url.trim());

    if (!res.ok) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    setResult(res);
    setLoading(false);
    setUrl("");
  };

  const handleConfirmInvite = async () => {
    if (!result || confirming) return;
    setConfirming(true);

    const res = await confirmQuickAddInviteAction(result.candidateId);
    if (!res.ok) {
      toast.error(res.error);
      setConfirming(false);
      return;
    }

    toast("Moved to Invited.", { sound: "kanban-drop" });
    setResult(null);
    setConfirming(false);
    inputRef.current?.focus();
  };

  const handleDismiss = () => {
    toast("Saved in Sourced.");
    setResult(null);
    inputRef.current?.focus();
  };

  return (
    <div className="px-4 pb-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a portfolio URL…"
            disabled={loading}
            className="h-9 w-full rounded-lg border border-[color:var(--color-neutral-600)]/60 bg-[color:var(--color-neutral-800)]/50 px-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:border-[color:var(--color-brand-pink)] focus:outline-none disabled:opacity-50"
          />
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-neutral-500)] border-t-[color:var(--color-brand-pink)]" />
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!url.trim() || loading}
          className="h-9 rounded-lg bg-[color:var(--color-brand-pink)]/15 px-4 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-pink)] transition-colors hover:bg-[color:var(--color-brand-pink)]/25 disabled:opacity-40 disabled:hover:bg-[color:var(--color-brand-pink)]/15"
        >
          Add
        </button>
      </form>

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={HOUSE_SPRING}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-[color:var(--color-neutral-600)]/40 bg-[color:var(--color-neutral-800)]/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-display)] text-[16px] text-[color:var(--color-brand-cream)]">
                      {result.candidateName}
                    </span>
                    <span className="rounded-full bg-[color:var(--color-neutral-700)]/60 px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.2px] text-[color:var(--color-neutral-400)]">
                      {result.platform}
                    </span>
                  </div>

                  {result.roleName ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                        Matched to{" "}
                        <span className="text-[color:var(--color-brand-cream)]">
                          {result.roleName}
                        </span>
                      </span>
                      {result.score != null ? (
                        <span
                          className="rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] tabular-nums"
                          style={{
                            color: scoreColor(result.score),
                            backgroundColor: `color-mix(in srgb, ${scoreColor(result.score)} 12%, transparent)`,
                            letterSpacing: "1px",
                          }}
                        >
                          {Math.round(result.score * 100)}%
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                      No open roles — saved as unattached.
                    </p>
                  )}

                  {result.scoreReasoning ? (
                    <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-neutral-400)]">
                      {result.scoreReasoning}
                    </p>
                  ) : null}
                </div>
              </div>

              {result.inviteBody ? (
                <div className="mt-3 rounded-lg border border-[color:var(--color-neutral-700)]/40 bg-[color:var(--color-neutral-900)]/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
                      Draft invite
                    </span>
                    <span
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1px]"
                      style={{
                        color:
                          result.inviteConfidence >= 0.85
                            ? "var(--color-state-success)"
                            : result.inviteConfidence >= 0.5
                              ? "var(--color-brand-orange)"
                              : "var(--color-neutral-400)",
                      }}
                    >
                      {confidenceLabel(result.inviteConfidence)} confidence
                    </span>
                  </div>
                  {result.inviteSubject ? (
                    <p className="mt-2 font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                      {result.inviteSubject}
                    </p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap font-[family-name:var(--font-body)] text-[13px] leading-[1.55] text-[color:var(--color-neutral-300)]">
                    {result.inviteBody}
                  </p>
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmInvite}
                  disabled={confirming}
                  className="h-8 rounded-lg bg-[color:var(--color-brand-pink)] px-4 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-charcoal)] transition-colors hover:bg-[color:var(--color-brand-pink)]/80 disabled:opacity-50"
                >
                  {confirming ? "Moving…" : "Send invite"}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="h-8 rounded-lg border border-[color:var(--color-neutral-600)]/60 px-4 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-400)] transition-colors hover:border-[color:var(--color-neutral-400)] hover:text-[color:var(--color-neutral-300)]"
                >
                  Keep in Sourced
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
