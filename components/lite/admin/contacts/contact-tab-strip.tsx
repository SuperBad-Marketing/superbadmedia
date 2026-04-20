"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export type ContactTab =
  | "overview"
  | "tasks"
  | "comms"
  | "brand-dna"
  | "portal-chat"
  | "activity";

const TABS: { id: ContactTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "comms", label: "Comms" },
  { id: "brand-dna", label: "Brand DNA" },
  { id: "portal-chat", label: "Portal Chat" },
  { id: "activity", label: "Activity" },
];

const HOUSE_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

export function ContactTabStrip({
  contactId,
  activeTab,
}: {
  contactId: string;
  activeTab: ContactTab;
}) {
  return (
    <div
      role="tablist"
      aria-label="Contact sections"
      className="inline-flex items-center gap-1 rounded-[10px] p-1"
      style={{
        background: "rgba(15, 15, 14, 0.45)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      {TABS.map((t) => {
        const active = t.id === activeTab;
        const href =
          t.id === "overview"
            ? `/lite/admin/contacts/${contactId}`
            : `/lite/admin/contacts/${contactId}?tab=${t.id}`;
        return (
          <Link
            key={t.id}
            role="tab"
            aria-selected={active}
            scroll={false}
            href={href}
            className="relative rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              letterSpacing: "1.5px",
              color: active
                ? "var(--color-brand-cream)"
                : "var(--color-neutral-500)",
            }}
          >
            {active && (
              <motion.span
                layoutId="contact-tab-active"
                className="absolute inset-0 rounded-md"
                style={{
                  background: "var(--color-surface-2)",
                  boxShadow: "var(--surface-highlight)",
                }}
                transition={HOUSE_SPRING}
              />
            )}
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
