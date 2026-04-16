"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";
import {
  MAX_REFINE_INSTRUCTION_CHARS,
  MAX_REFINE_TURNS,
  type RefineTurn,
} from "@/lib/graph/refine-draft-limits";
import { refineDraft } from "@/app/lite/inbox/compose/actions";
import { LowConfidenceFlags } from "./low-confidence-flags";

export function RefineSidecar({
  priorDraft,
  contactId,
  threadId,
  sendingAddress,
  llmEnabled,
  onAccept,
  onClose,
}: {
  priorDraft: string;
  contactId: string | null;
  threadId: string | null;
  sendingAddress: string;
  llmEnabled: boolean;
  onAccept: (body: string, flags: DraftReplyLowConfidenceFlag[]) => void;
  onClose: () => void;
}) {
  const [turns, setTurns] = React.useState<RefineTurn[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [latestBody, setLatestBody] = React.useState(priorDraft);
  const [latestFlags, setLatestFlags] = React.useState<DraftReplyLowConfidenceFlag[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const turnLimitHit = turns.length >= MAX_REFINE_TURNS;

  async function handleRedraft() {
    if (!instruction.trim() || busy || turnLimitHit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await refineDraft({
        priorDraft: latestBody,
        instruction: instruction.slice(0, MAX_REFINE_INSTRUCTION_CHARS),
        priorTurns: turns,
        contactId,
        threadId,
        sendingAddress,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.draft.outcome === "generated") {
        const newBody = result.draft.draft_body;
        setLatestBody(newBody);
        setLatestFlags(result.draft.low_confidence_flags);
        setTurns((prev) => [
          ...prev,
          { instruction, result_body: newBody },
        ]);
        setInstruction("");
      } else {
        // fallback → preserve prior
        setError(
          result.draft.outcome === "skipped_kill_switch"
            ? "Refine's paused — LLM calls off."
            : "Couldn't refine this time. Prior draft preserved.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.aside
      role="dialog"
      aria-label="Refine draft"
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
            Refine
          </span>
          <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
            Sharpen the draft
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close refine"
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
          <LowConfidenceFlags body={latestBody} flags={latestFlags} />
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
          onChange={(e) => setInstruction(e.target.value.slice(0, MAX_REFINE_INSTRUCTION_CHARS))}
          rows={2}
          placeholder="Make it warmer / drop the hedge / keep it tighter…"
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
              onClick={() => onAccept(latestBody, latestFlags)}
              disabled={latestBody === priorDraft && turns.length === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]",
                "outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Check size={12} strokeWidth={1.75} aria-hidden />
              Use this
            </button>
            <button
              type="button"
              onClick={handleRedraft}
              disabled={!llmEnabled || busy || !instruction.trim() || turnLimitHit}
              title={!llmEnabled ? "Refine's paused — LLM calls off." : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-3 py-1.5",
                "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                "outline-none transition-[filter] hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles size={12} strokeWidth={1.75} aria-hidden />
              {busy ? "Refining…" : "Re-draft"}
            </button>
          </div>
        </div>
      </footer>
    </motion.aside>
  );
}
