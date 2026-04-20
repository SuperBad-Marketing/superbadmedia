import type { CandidateStage } from "@/lib/db/schema/candidates";
import { EMPTY_STATES, type EmptyStateKey } from "@/lib/copy/empty-states";

export interface HiringStageColumn {
  id: CandidateStage;
  label: string;
  tintVar: string;
  emptyKey: EmptyStateKey;
}

export const HIRING_STAGE_COLUMNS: readonly HiringStageColumn[] = [
  {
    id: "sourced",
    label: "Sourced",
    tintVar: "var(--color-neutral-100, oklch(0.97 0.005 70))",
    emptyKey: "hiring.column.sourced",
  },
  {
    id: "invited",
    label: "Invited",
    tintVar: "var(--color-neutral-150, oklch(0.95 0.008 70))",
    emptyKey: "hiring.column.invited",
  },
  {
    id: "applied",
    label: "Applied",
    tintVar: "var(--color-neutral-200, oklch(0.93 0.01 70))",
    emptyKey: "hiring.column.applied",
  },
  {
    id: "screened",
    label: "Screened",
    tintVar: "var(--color-neutral-250, oklch(0.91 0.012 70))",
    emptyKey: "hiring.column.screened",
  },
  {
    id: "trial",
    label: "Trial",
    tintVar:
      "color-mix(in oklab, var(--color-neutral-200, oklch(0.93 0.01 70)) 85%, var(--brand-pink) 15%)",
    emptyKey: "hiring.column.trial",
  },
  {
    id: "bench",
    label: "Bench",
    tintVar:
      "color-mix(in oklab, var(--color-neutral-150, oklch(0.95 0.008 70)) 75%, oklch(0.96 0.04 80) 25%)",
    emptyKey: "hiring.column.bench",
  },
  {
    id: "archived",
    label: "Archived",
    tintVar: "var(--color-neutral-400, oklch(0.82 0.008 70))",
    emptyKey: "hiring.column.archived",
  },
] as const;

export function getStageEmptyState(column: HiringStageColumn) {
  return EMPTY_STATES[column.emptyKey];
}
