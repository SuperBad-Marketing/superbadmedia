"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Send,
  Camera,
  Receipt,
  Loader2,
  Check,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { QuickMove, QuickMoveType } from "@/lib/cockpit/quick-moves";

const MOVE_ICONS: Record<QuickMoveType, typeof Sparkles> = {
  generate_post: Sparkles,
  draft_followup: Send,
  prep_shoot_brief: Camera,
  chase_invoices: Receipt,
};

const MOVE_COLORS: Record<QuickMoveType, string> = {
  generate_post: "var(--color-brand-orange)",
  draft_followup: "var(--color-neutral-300)",
  prep_shoot_brief: "var(--color-brand-pink)",
  chase_invoices: "var(--color-semantic-warning)",
};

interface QuickMovesProps {
  moves: QuickMove[];
}

export function QuickMoves({ moves }: QuickMovesProps) {
  const reducedMotion = useReducedMotion();

  if (moves.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {moves.map((move) => (
        <QuickMoveCard key={move.type} move={move} reducedMotion={!!reducedMotion} />
      ))}
    </div>
  );
}

function QuickMoveCard({
  move,
  reducedMotion,
}: {
  move: QuickMove;
  reducedMotion: boolean;
}) {
  const Icon = MOVE_ICONS[move.type];
  const color = MOVE_COLORS[move.type];
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (status !== "idle") return;
    setStatus("running");

    startTransition(async () => {
      try {
        const res = await fetch("/api/lite/cockpit/quick-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: move.type, meta: move.meta }),
        });

        if (res.ok) {
          setStatus("done");
          setTimeout(() => setStatus("idle"), 2000);
        } else {
          setStatus("idle");
        }
      } catch {
        setStatus("idle");
      }
    });
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={status === "running"}
      whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
      transition={houseSpring}
      className="group flex flex-shrink-0 flex-col gap-2 rounded-xl px-4 py-3.5 text-left transition-all disabled:opacity-60"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
        boxShadow: "var(--surface-highlight)",
        minWidth: "180px",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-md"
          style={{ background: "var(--color-surface-1)" }}
        >
          <AnimatePresence mode="wait">
            {status === "running" ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Loader2 size={14} className="animate-spin" style={{ color }} />
              </motion.span>
            ) : status === "done" ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Check size={14} style={{ color: "var(--color-semantic-success)" }} />
              </motion.span>
            ) : (
              <motion.span
                key="icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Icon size={14} strokeWidth={1.5} style={{ color }} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <span
        className="font-[family-name:var(--font-dm-sans)] text-[13px] leading-tight"
        style={{ color: "var(--color-neutral-100)" }}
      >
        {move.label}
      </span>
      <span
        className="font-[family-name:var(--font-dm-sans)] text-[11px] leading-tight"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {move.sublabel}
      </span>
    </motion.button>
  );
}
