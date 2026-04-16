"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";
import {
  MAX_REFINE_INSTRUCTION_CHARS,
  MAX_REFINE_TURNS,
  type RefineTurn,
} from "@/lib/graph/refine-draft-limits";
import { refineDraft } from "@/app/lite/inbox/compose/actions";

/**
 * Single-line refine input for the mobile composer (spec §4.5 —
 * "simplified, single-line instruction input, re-draft, no sidecar
 * panel"). Submit → `refineDraft` → rewrites the composer body via
 * `onAccept`. Turns are tracked locally so MAX_REFINE_TURNS still bites.
 */
export function MobileRefineInline({
  priorDraft,
  contactId,
  threadId,
  sendingAddress,
  llmEnabled,
  onAccept,
  visible,
}: {
  priorDraft: string;
  contactId: string | null;
  threadId: string | null;
  sendingAddress: string;
  llmEnabled: boolean;
  onAccept: (body: string, flags: DraftReplyLowConfidenceFlag[]) => void;
  visible: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [turns, setTurns] = React.useState<RefineTurn[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const turnLimitHit = turns.length >= MAX_REFINE_TURNS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instruction.trim() || busy || turnLimitHit || !llmEnabled) return;
    setBusy(true);
    setError(null);
    try {
      const result = await refineDraft({
        priorDraft,
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
        setTurns((prev) => [...prev, { instruction, result_body: newBody }]);
        setInstruction("");
        onAccept(newBody, result.draft.low_confidence_flags);
      } else {
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
    <AnimatePresence>
      {visible && (
        <motion.form
          key="mobile-refine"
          onSubmit={handleSubmit}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={reducedMotion ? { duration: 0.18 } : houseSpring}
          className={cn(
            "flex flex-col gap-1 border-t border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)]/50 px-4 py-2",
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className="shrink-0 text-[color:var(--color-brand-pink)]"
            />
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={MAX_REFINE_INSTRUCTION_CHARS}
              disabled={busy || turnLimitHit || !llmEnabled}
              placeholder={
                turnLimitHit
                  ? "That's enough refining."
                  : "Tell me what's off."
              }
              aria-label="Refine instruction"
              className={cn(
                "flex-1 rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]",
                "outline-none focus-visible:border-[color:var(--color-accent-cta)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
            <button
              type="submit"
              disabled={
                busy || turnLimitHit || !llmEnabled || !instruction.trim()
              }
              className={cn(
                "rounded-sm px-3 py-2",
                "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                "outline-none transition-[filter] hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {busy ? "…" : "Go"}
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-brand-pink)]"
            >
              {error}
            </p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
