"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Lightbulb, Clock, Quote } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { RotatingCardType } from "@/lib/cockpit/mantras";

const CARD_CONFIG: Record<
  RotatingCardType,
  { icon: typeof BookOpen; label: string; color: string }
> = {
  mantra: { icon: Quote, label: "Mantra", color: "var(--color-brand-red)" },
  random_fact: {
    icon: Lightbulb,
    label: "Random Fact",
    color: "var(--color-brand-orange)",
  },
  word_of_the_day: {
    icon: BookOpen,
    label: "Word of the Day",
    color: "var(--color-brand-cream)",
  },
  this_day_in_history: {
    icon: Clock,
    label: "This Day in History",
    color: "var(--color-neutral-300)",
  },
};

interface RotatingCardProps {
  type: RotatingCardType;
  content: string;
  subtitle?: string;
}

export function RotatingCard({ type, content, subtitle }: RotatingCardProps) {
  const config = CARD_CONFIG[type];
  const Icon = config.icon;
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : houseSpring}
      className="rounded-xl px-5 py-4"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={12} strokeWidth={1.5} style={{ color: config.color }} />
        <span
          className="font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{ letterSpacing: "1.2px", color: config.color }}
        >
          {config.label}
        </span>
      </div>
      {type === "mantra" ? (
        <p
          className="text-pretty font-[family-name:var(--font-narrative)] text-[16px] italic leading-relaxed"
          style={{ color: "var(--color-neutral-200)" }}
        >
          {content}
        </p>
      ) : type === "word_of_the_day" ? (
        <div>
          <p
            className="font-[family-name:var(--font-serif)] text-[20px] italic"
            style={{ color: "var(--color-neutral-100)" }}
          >
            {content}
          </p>
          {subtitle && (
            <p
              className="mt-1 font-[family-name:var(--font-dm-sans)] text-[13px] leading-relaxed"
              style={{ color: "var(--color-neutral-500)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      ) : (
        <p
          className="text-pretty font-[family-name:var(--font-dm-sans)] text-[14px] leading-relaxed"
          style={{ color: "var(--color-neutral-300)" }}
        >
          {content}
        </p>
      )}
    </motion.div>
  );
}
