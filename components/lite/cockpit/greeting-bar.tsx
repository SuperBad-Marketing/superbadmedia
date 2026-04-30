"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PenSquare } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning.";
  if (hour < 17) return "Afternoon.";
  return "Evening.";
}

interface GreetingBarProps {
  mantra: string;
  onBraindump: () => void;
  braindumpDone: boolean;
}

export function GreetingBar({ mantra, onBraindump, braindumpDone }: GreetingBarProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.header
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : houseSpring}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
            style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
          >
            Cockpit
          </div>
          <h1
            className="mt-3 text-balance font-[family-name:var(--font-display)]"
            style={{
              fontSize: "clamp(40px, 7vw, 56px)",
              lineHeight: 1,
              color: "var(--color-brand-cream)",
            }}
          >
            {getGreeting()}
          </h1>
          <p
            className="mt-2 max-w-md text-pretty font-[family-name:var(--font-narrative)] text-[15px] italic leading-relaxed"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {mantra}
          </p>
        </div>

        <motion.button
          type="button"
          onClick={onBraindump}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          transition={houseSpring}
          className="group mt-6 flex shrink-0 items-center gap-2.5 rounded-xl px-5 py-3 transition-colors"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-lg transition-colors group-hover:bg-[color:var(--color-surface-3)]"
            style={{ background: "var(--color-surface-1)" }}
          >
            <PenSquare
              size={16}
              strokeWidth={1.5}
              style={{
                color: braindumpDone
                  ? "var(--color-semantic-success)"
                  : "var(--color-brand-orange)",
              }}
            />
          </span>
          <span
            className="font-[family-name:var(--font-dm-sans)] text-[13px]"
            style={{ color: "var(--color-neutral-300)" }}
          >
            {braindumpDone ? "Dumped" : "Braindump"}
          </span>
        </motion.button>
      </div>
    </motion.header>
  );
}
