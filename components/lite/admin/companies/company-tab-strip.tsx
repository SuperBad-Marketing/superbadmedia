"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export type CompanyTab = "overview" | "trial-shoot" | "billing";

const TABS: { id: CompanyTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "trial-shoot", label: "Trial Shoot" },
  { id: "billing", label: "Billing" },
];

const HOUSE_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

export function CompanyTabStrip({
  companyId,
  activeTab,
}: {
  companyId: string;
  activeTab: CompanyTab;
}) {
  return (
    <div
      role="tablist"
      aria-label="Company sections"
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
            ? `/lite/admin/companies/${companyId}`
            : `/lite/admin/companies/${companyId}?tab=${t.id}`;
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
                layoutId="company-tab-active"
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
