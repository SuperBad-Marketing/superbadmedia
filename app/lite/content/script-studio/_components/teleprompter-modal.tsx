"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, ChevronRight, Check } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { ScriptRow } from "@/lib/db/schema/talking-head";

export function TeleprompterModal({
  script,
  onClose,
  onFilmed,
}: {
  script: ScriptRow;
  onClose: () => void;
  onFilmed: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const data = script.script_json as Record<string, unknown>;
  const isMid = script.format === "mid";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(10, 10, 9, 0.97)" }}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed right-6 top-6 z-50 flex size-10 items-center justify-center rounded-full transition-colors"
        style={{
          backgroundColor: "rgba(253, 245, 230, 0.06)",
          color: "var(--color-neutral-500)",
        }}
        aria-label="Exit teleprompter"
      >
        <X size={18} />
      </button>

      {/* Title bar */}
      <div className="fixed left-0 right-0 top-0 flex items-center justify-center px-6 py-4">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
          style={{ letterSpacing: "2px" }}
        >
          {script.title}
        </span>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[680px] px-8">
        {isMid ? (
          <MidFormPrompter data={data} />
        ) : (
          <ShortFormPrompter data={data} />
        )}
      </div>

      {/* Mark as filmed */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center px-6 py-6">
        <button
          onClick={onFilmed}
          className="flex items-center gap-2 rounded-lg px-6 py-3 text-[13px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out"
          style={{
            letterSpacing: "1.5px",
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
          }}
        >
          <Check size={14} strokeWidth={2} />
          Mark as Filmed
        </button>
      </div>
    </motion.div>
  );
}

function ShortFormPrompter({ data }: { data: Record<string, unknown> }) {
  const blocks = (data.blocks ?? []) as Array<{
    text: string;
    cue: string | null;
  }>;

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => (
        <div key={i}>
          <p
            className="text-center font-[family-name:var(--font-body)] text-[28px] leading-[1.5] font-light"
            style={{ color: "var(--color-brand-cream)" }}
          >
            {block.text}
          </p>
          {block.cue && (
            <p
              className="mt-2 text-center font-[family-name:var(--font-label)] text-[11px] uppercase"
              style={{
                letterSpacing: "2px",
                color: "var(--color-brand-orange)",
              }}
            >
              {block.cue.replace("_", " ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function MidFormPrompter({ data }: { data: Record<string, unknown> }) {
  const segments = (data.segments ?? []) as Array<{
    number: number;
    duration_hint_sec: number;
    blocks: Array<{ text: string; cue: string | null }>;
    b_cam_after: boolean;
  }>;

  const [activeSegment, setActiveSegment] = useState(0);
  const segment = segments[activeSegment];
  const isLast = activeSegment === segments.length - 1;

  if (!segment) return null;

  return (
    <div>
      {/* Segment counter */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {segments.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveSegment(i)}
            className="size-2 rounded-full transition-colors duration-150"
            style={{
              backgroundColor:
                i === activeSegment
                  ? "var(--color-brand-cream)"
                  : i < activeSegment
                    ? "var(--color-neutral-500)"
                    : "var(--color-neutral-700)",
            }}
            aria-label={`Segment ${i + 1}`}
          />
        ))}
      </div>

      {/* Segment label */}
      <div className="mb-6 text-center">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
          style={{ letterSpacing: "2px" }}
        >
          Segment {segment.number} · ~{segment.duration_hint_sec}s
        </span>
      </div>

      {/* Blocks */}
      <div className="space-y-6">
        {segment.blocks.map((block, j) => (
          <div key={j}>
            <p
              className="text-center font-[family-name:var(--font-body)] text-[28px] leading-[1.5] font-light"
              style={{ color: "var(--color-brand-cream)" }}
            >
              {block.text}
            </p>
            {block.cue && (
              <p
                className="mt-2 text-center font-[family-name:var(--font-label)] text-[11px] uppercase"
                style={{
                  letterSpacing: "2px",
                  color: "var(--color-brand-orange)",
                }}
              >
                {block.cue.replace("_", " ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* B cam indicator */}
      {segment.b_cam_after && (
        <div className="mt-8 text-center">
          <span
            className="rounded-full px-3 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-brand-pink)]"
            style={{
              letterSpacing: "1px",
              backgroundColor: "rgba(244, 160, 176, 0.08)",
            }}
          >
            B cam cut after this segment
          </span>
        </div>
      )}

      {/* Next segment */}
      <div className="mt-10 flex justify-center">
        {!isLast ? (
          <button
            onClick={() => setActiveSegment((s) => s + 1)}
            className="flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[12px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out"
            style={{
              letterSpacing: "1px",
              backgroundColor: "rgba(253, 245, 230, 0.06)",
              color: "var(--color-brand-cream)",
            }}
          >
            Next Segment
            <ChevronRight size={14} />
          </button>
        ) : (
          <span
            className="font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-neutral-500)]"
          >
            That's the last one.
          </span>
        )}
      </div>
    </div>
  );
}
