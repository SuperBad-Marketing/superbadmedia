"use client";

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { SaasProductStatus } from "@/lib/db/schema/saas-products";

const LABEL: Record<SaasProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const CLASSES: Record<SaasProductStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  archived: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export function StatusPillClient({ status }: { status: SaasProductStatus }) {
  return (
    <motion.span
      key={status}
      layout
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={houseSpring}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${CLASSES[status]}`}
      data-testid="product-status-pill"
    >
      {LABEL[status]}
    </motion.span>
  );
}
