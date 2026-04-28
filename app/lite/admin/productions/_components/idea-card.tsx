"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Lightbulb, MessageCircle, ArrowRight } from "lucide-react";
import type { ProductionRow } from "@/lib/db/schema/productions";

interface Angle {
  angle: string;
  story: string;
  momentToHunt: string;
  voiceoverHook: string;
}

interface IdeaCardProps {
  production: ProductionRow;
  chatCount: number;
  onClick: () => void;
}

export function IdeaCard({ production, chatCount, onClick }: IdeaCardProps) {
  const reduceMotion = useReducedMotion();
  const angles = (production.generated_angles_json ?? []) as Angle[];
  const isGenerating = !production.generated_angles_json;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}
      className="group w-full cursor-pointer rounded-[12px] border border-[color:rgba(253,245,230,0.06)] p-4 text-left"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        transition: "border-color 200ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Title + type */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-[family-name:var(--font-display)] text-[18px] leading-tight text-[color:var(--color-brand-cream)] group-hover:text-[color:var(--color-brand-pink)]"
            style={{
              letterSpacing: "-0.2px",
              transition: "color 200ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {production.title}
          </h3>
          {production.subject_type && (
            <span
              className="mt-1 inline-block font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {production.subject_type}
            </span>
          )}
        </div>
        <ArrowRight
          className="mt-1 size-4 shrink-0 text-[color:var(--color-neutral-600)] group-hover:text-[color:var(--color-brand-pink)]"
          strokeWidth={1.5}
          style={{ transition: "color 200ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </div>

      {/* Initial thought */}
      {production.initial_thought && (
        <p className="mt-2.5 line-clamp-2 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[color:var(--color-neutral-400)]">
          {production.initial_thought}
        </p>
      )}

      {/* Angles */}
      <div className="mt-3">
        {isGenerating ? (
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3 animate-pulse text-[color:var(--color-brand-pink)]" strokeWidth={1.5} />
            <span
              className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-brand-pink)]"
              style={{ letterSpacing: "1.2px" }}
            >
              Generating angles…
            </span>
          </div>
        ) : angles.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {angles.slice(0, 2).map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-[6px] px-2.5 py-1.5"
                style={{ background: "rgba(253, 245, 230, 0.03)" }}
              >
                <Lightbulb
                  className="mt-0.5 size-3 shrink-0 text-[color:var(--color-brand-orange)]"
                  strokeWidth={1.5}
                />
                <span className="line-clamp-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)]">
                  {a.angle}
                </span>
              </div>
            ))}
            {angles.length > 2 && (
              <span
                className="px-2.5 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.2px" }}
              >
                +{angles.length - 2} more
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {chatCount > 0 && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-[color:rgba(253,245,230,0.04)] pt-2.5">
          <MessageCircle
            className="size-3 text-[color:var(--color-neutral-500)]"
            strokeWidth={1.5}
          />
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.2px" }}
          >
            {chatCount} message{chatCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </motion.button>
  );
}
