"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PenSquare, CheckSquare, Image, Video, ChevronRight } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { BraindumpModal } from "@/components/lite/braindump/braindump-modal";
import type { BraindumpRow } from "@/lib/db/schema/braindumps";

interface BraindumpSectionProps {
  todayBraindump: BraindumpRow | null;
}

const PROMPT_LINES = [
  "What's rattling around in your head?",
  "Dump it. We'll sort it.",
  "Tasks, ideas, scripts. All welcome.",
  "Morning brain. Go.",
  "What's on the list today?",
  "Anything brewing?",
];

function pickPrompt(): string {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return PROMPT_LINES[dayIndex % PROMPT_LINES.length];
}

function StatPill({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: "var(--color-surface-3)" }}>
      <span className="text-[color:var(--color-neutral-500)]">{icon}</span>
      <span
        className="font-[family-name:var(--font-label)] text-[10px] tabular-nums uppercase tracking-[1.5px]"
        style={{ color: "var(--color-neutral-300)" }}
      >
        {count} {label}
      </span>
    </span>
  );
}

export function BraindumpSection({ todayBraindump }: BraindumpSectionProps) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const reducedMotion = useReducedMotion();

  const handleOpen = React.useCallback(() => setModalOpen(true), []);
  const handleClose = React.useCallback(() => setModalOpen(false), []);

  const isDone = !!todayBraindump;

  return (
    <>
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        {isDone ? (
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenSquare
                  size={14}
                  strokeWidth={1.5}
                  className="text-[color:var(--color-semantic-success)]"
                />
                <span
                  className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]"
                  style={{ color: "var(--color-neutral-300)" }}
                >
                  Brain dumped.
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpen}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] outline-none transition-colors hover:bg-[color:var(--color-surface-3)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                Add more
                <ChevronRight size={10} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatPill
                icon={<CheckSquare size={10} strokeWidth={1.5} />}
                count={todayBraindump.task_count}
                label={todayBraindump.task_count === 1 ? "task" : "tasks"}
              />
              <StatPill
                icon={<Image size={10} strokeWidth={1.5} />}
                count={todayBraindump.content_count}
                label={todayBraindump.content_count === 1 ? "post" : "posts"}
              />
              <StatPill
                icon={<Video size={10} strokeWidth={1.5} />}
                count={todayBraindump.script_count}
                label={todayBraindump.script_count === 1 ? "script" : "scripts"}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="group flex w-full items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-[color:var(--color-surface-3)]"
              style={{ background: "var(--color-surface-1)" }}
            >
              <PenSquare
                size={18}
                strokeWidth={1.5}
                className="text-[color:var(--color-brand-orange)]"
              />
            </span>
            <span className="flex-1">
              <span
                className="block font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]"
                style={{ color: "var(--color-neutral-100)" }}
              >
                Morning Braindump
              </span>
              <span
                className="block font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] italic"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {pickPrompt()}
              </span>
            </span>
            <ChevronRight
              size={16}
              className="shrink-0 text-[color:var(--color-neutral-500)] transition-transform group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <BraindumpModal onClose={handleClose} surfaceContext={null} />
        )}
      </AnimatePresence>
    </>
  );
}
