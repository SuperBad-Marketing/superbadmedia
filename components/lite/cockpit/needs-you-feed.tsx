"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Mail,
  MessageCircle,
  FileText,
  Send,
  Camera,
  Ticket,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { NeedsYouItem, NeedsYouItemType } from "@/lib/cockpit/needs-you";
import { NeedsYouActionPanel } from "./needs-you-action-panel";

const TYPE_CONFIG: Record<
  NeedsYouItemType,
  { icon: typeof Mail; label: string; color: string }
> = {
  outreach_draft: {
    icon: Send,
    label: "Outreach",
    color: "var(--color-brand-orange)",
  },
  instagram_reply: {
    icon: Camera,
    label: "Instagram",
    color: "var(--color-brand-pink)",
  },
  content_draft: {
    icon: FileText,
    label: "Content",
    color: "var(--color-semantic-success)",
  },
  unreplied_email: {
    icon: Mail,
    label: "Email",
    color: "var(--color-neutral-300)",
  },
  support_ticket: {
    icon: Ticket,
    label: "Ticket",
    color: "var(--color-semantic-warning)",
  },
  draft_quote: {
    icon: FileText,
    label: "Quote",
    color: "var(--color-brand-cream)",
  },
  expiring_quote: {
    icon: FileText,
    label: "Quote",
    color: "var(--color-semantic-error)",
  },
};

interface NeedsYouFeedProps {
  items: NeedsYouItem[];
}

export function NeedsYouFeed({ items }: NeedsYouFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const reducedMotion = useReducedMotion();

  const handleToggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const handleResolved = useCallback((id: string) => {
    setExpandedId(null);
    setResolvedIds((prev) => new Set(prev).add(id));
  }, []);

  const visibleItems = items.filter((item) => !resolvedIds.has(item.id));

  if (visibleItems.length === 0) {
    return (
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl px-5 py-6 text-center"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        <p
          className="font-[family-name:var(--font-narrative)] text-[15px] italic"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Nothing waiting on you. Suspicious.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {visibleItems.map((item) => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          const isExpanded = expandedId === item.id;

          return (
            <motion.div
              key={item.id}
              layout
              initial={reducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } }
              }
              transition={reducedMotion ? { duration: 0 } : houseSpring}
              className="overflow-hidden rounded-xl"
              style={{
                background: "var(--color-surface-2)",
                border: isExpanded
                  ? "1px solid rgba(253, 245, 230, 0.08)"
                  : "1px solid rgba(253, 245, 230, 0.03)",
                boxShadow: isExpanded
                  ? "0 8px 32px rgba(0,0,0,0.3)"
                  : "var(--surface-highlight)",
              }}
            >
              {/* Collapsed card — tap to expand */}
              <button
                type="button"
                onClick={() => handleToggle(item.id)}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--color-surface-1)" }}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: config.color }}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                      style={{
                        letterSpacing: "1.2px",
                        color: config.color,
                      }}
                    >
                      {config.label}
                    </span>
                    <span
                      className="font-[family-name:var(--font-dm-sans)] text-[13px] truncate"
                      style={{ color: "var(--color-neutral-100)" }}
                    >
                      {item.label}
                    </span>
                  </div>
                  {item.sublabel && (
                    <p
                      className="mt-0.5 truncate font-[family-name:var(--font-dm-sans)] text-[12px]"
                      style={{ color: "var(--color-neutral-500)" }}
                    >
                      {item.sublabel}
                    </p>
                  )}
                </div>

                <motion.span
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={houseSpring}
                  className="shrink-0"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  <ChevronRight size={14} />
                </motion.span>
              </button>

              {/* Expanded action panel — breathes open */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : {
                            height: { ...houseSpring, stiffness: 180 },
                            opacity: { duration: 0.2 },
                          }
                    }
                    className="overflow-hidden"
                  >
                    <div
                      className="mx-4 mb-4 rounded-lg px-4 py-4"
                      style={{
                        background: "var(--color-surface-1)",
                        border: "1px solid rgba(253, 245, 230, 0.04)",
                      }}
                    >
                      <NeedsYouActionPanel
                        item={item}
                        onResolved={() => handleResolved(item.id)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
