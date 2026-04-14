import type { DealStage } from "@/lib/db/schema/deals";

import { EMPTY_STATES, type EmptyStateKey } from "@/lib/copy/empty-states";

/**
 * Closed list of 8 Sales Pipeline columns + presentation defaults per
 * sales-pipeline §5.2. Exact pixel tuning deferred to §15.1.
 * Warm-tint tokens resolve against the extended neutral scale in
 * `app/globals.css`. Cream / pink wash on Won & Trial Shoot per §5.2.
 *
 * Empty-state copy pulls from `lib/copy/empty-states.ts` (§11A.1) — do
 * not inline column copy here.
 */
export interface StageColumn {
  id: DealStage;
  label: string;
  tintVar: string;
  emptyKey: EmptyStateKey;
}

export const STAGE_COLUMNS: readonly StageColumn[] = [
  {
    id: "lead",
    label: "Lead",
    tintVar: "var(--color-neutral-100, oklch(0.97 0.005 70))",
    emptyKey: "pipeline.column.lead",
  },
  {
    id: "contacted",
    label: "Contacted",
    tintVar: "var(--color-neutral-150, oklch(0.95 0.008 70))",
    emptyKey: "pipeline.column.contacted",
  },
  {
    id: "conversation",
    label: "Conversation",
    tintVar: "var(--color-neutral-200, oklch(0.93 0.01 70))",
    emptyKey: "pipeline.column.conversation",
  },
  {
    id: "trial_shoot",
    label: "Trial Shoot",
    tintVar:
      "color-mix(in oklab, var(--color-neutral-200, oklch(0.93 0.01 70)) 85%, var(--brand-pink) 15%)",
    emptyKey: "pipeline.column.trial_shoot",
  },
  {
    id: "quoted",
    label: "Quoted",
    tintVar: "var(--color-neutral-250, oklch(0.91 0.012 70))",
    emptyKey: "pipeline.column.quoted",
  },
  {
    id: "negotiating",
    label: "Negotiating",
    tintVar: "var(--color-neutral-300, oklch(0.88 0.014 70))",
    emptyKey: "pipeline.column.negotiating",
  },
  {
    id: "won",
    label: "Won",
    tintVar:
      "color-mix(in oklab, var(--color-neutral-150, oklch(0.95 0.008 70)) 75%, oklch(0.96 0.04 80) 25%)",
    emptyKey: "pipeline.column.won",
  },
  {
    id: "lost",
    label: "Lost",
    tintVar: "var(--color-neutral-400, oklch(0.82 0.008 70))",
    emptyKey: "pipeline.column.lost",
  },
] as const;

export function getStageEmptyState(column: StageColumn) {
  return EMPTY_STATES[column.emptyKey];
}
