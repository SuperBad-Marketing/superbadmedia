"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_REFINE_INSTRUCTION_CHARS,
  MAX_REFINE_TURNS,
  type RefineTurn,
} from "@/lib/graph/refine-draft-limits";
import { nudgeRewriteAction, applyNudgeAction } from "../actions";

export function NudgeSidecar({
  draftId,
  initialBody,
  llmEnabled,
  onClose,
  onApplied,
}: {
  draftId: string;
  initialBody: string;
  llmEnabled: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [turns, setTurns] = React.useState<RefineTurn[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [latestBody, setLatestBody] = React.useState(initialBody);
  const [busy, setBusy] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const turnLimitHit = turns.length >= MAX_REFINE_TURNS;

  async function handleRedraft() {
    if (!instruction.trim() || busy || turnLimitHit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await nudgeRewriteAction(
        draftId,
        instruction.slice(0, MAX_REFINE_INSTRUCTION_CHARS),
        latestBody,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const newBody = result.body;
      setLatestBody(newBody);
      setTurns((prev) => [
        ...prev,
        { instruction, result_body: newBody },
      ]);
      setInstruction("");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (turns.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const nudgeThread = turns.flatMap((t) => [
        { role: "user", content: t.instruction },
        { role: "assistant", content: t.result_body },
      ]);
      const result = await applyNudgeAction(draftId, latestBody, nudgeThread);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <motion.aside
      role="dialog"
      aria-label="Nudge draft"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-[28rem] max-w-full flex-col",
        "border-l border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] shadow-2xl",
      )}
    >
      <header className="flex items-center justify-between border-b border-[color:var(--color-neutral-700)] px-5 py-4">
        <div className="flex flex-col">
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Nudge
          </span>
          <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
            Steer the draft
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close nudge"
          className="rounded-sm p-2 text-[color:var(--color-neutral-300)] outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {turns.length === 0 && (
          <em className="mb-4 block font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
            Tell me what&rsquo;s off. Short is fine.
          </em>
        )}

        <div className="mb-4 rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2">
          <p
            className="mb-1 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Current draft
          </p>
          <p className="whitespace-pre-wrap font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
            {latestBody}
          </p>
        </div>

        {turns.length > 0 && (
          <ul className="mb-4 flex flex-col gap-3">
            {turns.map((t, idx) => (
              <li
                key={idx}
                className="rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-2"
              >
                <p
                  className="mb-1 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-brand-pink)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Turn {idx + 1}
                </p>
                <p className="mb-1 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]">
                  <span className="text-[color:var(--color-neutral-500)]">Asked:</span>{" "}
                  {t.instruction}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-[color:var(--color-neutral-700)] px-5 py-4">
        {error && (
          <p
            role="alert"
            className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-brand-pink)]"
          >
            {error}
          </p>
        )}

        <textarea
          aria-label="What should change"
          value={instruction}
          onChange={(e) =>
            setInstruction(
              e.target.value.slice(0, MAX_REFINE_INSTRUCTION_CHARS),
            )
          }
          rows={2}
          placeholder="Warmer intro / drop the CTA / shorter…"
          disabled={!llmEnabled || turnLimitHit}
          className={cn(
            "resize-none rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2",
            "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]",
            "outline-none focus-visible:border-[color:var(--color-accent-cta)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />

        <div className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
            {turns.length}/{MAX_REFINE_TURNS} turns ·{" "}
            {instruction.length}/{MAX_REFINE_INSTRUCTION_CHARS}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={turns.length === 0 || applying}
              className={cn(
                "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]",
                "outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Check size={12} strokeWidth={1.75} aria-hidden />
              {applying ? "Saving…" : "Use this"}
            </button>
            <button
              type="button"
              onClick={handleRedraft}
              disabled={!llmEnabled || busy || !instruction.trim() || turnLimitHit}
              title={!llmEnabled ? "LLM calls are paused." : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-3 py-1.5",
                "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                "outline-none transition-[filter] hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles size={12} strokeWidth={1.75} aria-hidden />
              {busy ? "Rewriting…" : "Re-draft"}
            </button>
          </div>
        </div>
      </footer>
    </motion.aside>
  );
}
