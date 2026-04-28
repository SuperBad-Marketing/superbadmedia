"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Plus } from "lucide-react";

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };

interface QuickCaptureProps {
  onCapture: (title: string, thought: string) => void;
  isSubmitting: boolean;
}

export function QuickCapture({ onCapture, isSubmitting }: QuickCaptureProps) {
  const [title, setTitle] = React.useState("");
  const [thought, setThought] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const titleRef = React.useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCapture(title.trim(), thought.trim());
    setTitle("");
    setThought("");
    setExpanded(false);
    titleRef.current?.focus();
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
      className="rounded-[12px] border border-[color:rgba(253,245,230,0.06)] p-4"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: "rgba(244, 160, 176, 0.12)" }}
        >
          <Plus className="size-4 text-[color:var(--color-brand-pink)]" strokeWidth={1.5} />
        </div>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value && !expanded) setExpanded(true);
          }}
          onFocus={() => { if (title) setExpanded(true); }}
          placeholder="Name an episode idea…"
          className="flex-1 border-none bg-transparent font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:outline-none"
        />
      </div>

      <motion.div
        initial={false}
        animate={{
          height: expanded ? "auto" : 0,
          opacity: expanded ? 1 : 0,
        }}
        transition={reduceMotion ? { duration: 0 } : HOUSE_SPRING}
        className="overflow-hidden"
      >
        <div className="pt-3">
          <textarea
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="What's the thought? A line is enough…"
            rows={2}
            className="w-full resize-none rounded-[8px] border border-[color:rgba(253,245,230,0.06)] bg-[color:rgba(253,245,230,0.02)] px-3 py-2.5 font-[family-name:var(--font-body)] text-[14px] leading-relaxed text-[color:var(--color-neutral-300)] placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
            style={{ transition: "border-color 180ms cubic-bezier(0.16,1,0.3,1)" }}
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[color:var(--color-neutral-500)]">
              <Sparkles className="size-3" strokeWidth={1.5} />
              <span
                className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{ letterSpacing: "1.5px" }}
              >
                Claude will brainstorm angles automatically
              </span>
            </div>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="cursor-pointer rounded-[8px] border-none px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] disabled:cursor-default disabled:opacity-40"
              style={{
                letterSpacing: "1.5px",
                background: "var(--color-brand-red)",
                transition: "opacity 180ms",
              }}
            >
              {isSubmitting ? "Capturing…" : "Capture"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.form>
  );
}
