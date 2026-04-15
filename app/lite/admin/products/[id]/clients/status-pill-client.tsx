"use client";

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { SaasProductStatus } from "@/lib/db/schema/saas-products";

const LABEL: Record<SaasProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const TONE: Record<
  SaasProductStatus,
  { background: string; color: string }
> = {
  draft: {
    background: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  active: {
    background: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
  },
  archived: {
    background: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
};

export function StatusPillClient({ status }: { status: SaasProductStatus }) {
  const tone = TONE[status];
  return (
    <motion.span
      key={status}
      layout
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={houseSpring}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{ letterSpacing: "1.5px", ...tone }}
      data-testid="product-status-pill"
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {LABEL[status]}
    </motion.span>
  );
}
