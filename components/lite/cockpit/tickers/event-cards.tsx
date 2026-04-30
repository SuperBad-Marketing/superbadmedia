"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

export interface SportEvent {
  id: string;
  league: "epl" | "ufc" | "f1" | "nfl";
  headline: string;
  detail: string;
  timestamp?: string;
}

export interface AiRelease {
  id: string;
  vendor: "anthropic" | "openai";
  headline: string;
  detail: string;
}

type EventCard = SportEvent | AiRelease;

const LEAGUE_LABELS: Record<string, { label: string; color: string }> = {
  epl: { label: "EPL", color: "var(--color-semantic-success)" },
  ufc: { label: "UFC", color: "var(--color-semantic-error)" },
  f1: { label: "F1", color: "var(--color-brand-orange)" },
  nfl: { label: "NFL", color: "var(--color-neutral-300)" },
  anthropic: { label: "Anthropic", color: "var(--color-brand-cream)" },
  openai: { label: "OpenAI", color: "var(--color-neutral-500)" },
};

export function EventCards() {
  const [cards, setCards] = useState<EventCard[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/lite/cockpit/tickers/events");
        if (res.ok) {
          const data = await res.json();
          setCards(data.events ?? []);
        }
      } catch {
        // Events unavailable
      }
    }

    fetchEvents();
    const interval = setInterval(fetchEvents, 600000);
    return () => clearInterval(interval);
  }, []);

  if (cards.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <AnimatePresence mode="popLayout">
        {cards.map((card) => {
          const key = "league" in card ? card.league : card.vendor;
          const config = LEAGUE_LABELS[key] ?? {
            label: key,
            color: "var(--color-neutral-500)",
          };

          return (
            <motion.div
              key={card.id}
              layout
              initial={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={reducedMotion ? { duration: 0 } : houseSpring}
              className="flex flex-shrink-0 flex-col gap-1 rounded-xl px-4 py-3"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid rgba(253, 245, 230, 0.03)",
                boxShadow: "var(--surface-highlight)",
                minWidth: "200px",
                maxWidth: "260px",
              }}
            >
              <span
                className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{ letterSpacing: "1.2px", color: config.color }}
              >
                {config.label}
              </span>
              <span
                className="font-[family-name:var(--font-dm-sans)] text-[13px] leading-tight"
                style={{ color: "var(--color-neutral-100)" }}
              >
                {card.headline}
              </span>
              <span
                className="font-[family-name:var(--font-dm-sans)] text-[11px] leading-tight"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {card.detail}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
