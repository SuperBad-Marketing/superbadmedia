import type { DealStage } from "@/lib/db/schema/deals";

/**
 * Closed list of 8 Sales Pipeline columns + presentation defaults per
 * sales-pipeline §5.2. Exact pixel tuning deferred to §15.1.
 * Warm-tint tokens resolve against the extended neutral scale in
 * `app/globals.css`. Cream / pink wash on Won & Trial Shoot per §5.2.
 */
export interface StageColumn {
  id: DealStage;
  label: string;
  tintVar: string;
  emptyHero: string;
  emptyMessage: string;
}

export const STAGE_COLUMNS: readonly StageColumn[] = [
  {
    id: "lead",
    label: "Lead",
    tintVar: "var(--color-neutral-100, oklch(0.97 0.005 70))",
    emptyHero: "—",
    emptyMessage: "No leads yet. Lead Gen will fill this in when it's built.",
  },
  {
    id: "contacted",
    label: "Contacted",
    tintVar: "var(--color-neutral-150, oklch(0.95 0.008 70))",
    emptyHero: "—",
    emptyMessage: "Nothing out there waiting for a reply. Enviable.",
  },
  {
    id: "conversation",
    label: "Conversation",
    tintVar: "var(--color-neutral-200, oklch(0.93 0.01 70))",
    emptyHero: "—",
    emptyMessage: "Nobody's talking. For now.",
  },
  {
    id: "trial_shoot",
    label: "Trial Shoot",
    tintVar: "color-mix(in oklab, var(--color-neutral-200, oklch(0.93 0.01 70)) 85%, var(--brand-pink) 15%)",
    emptyHero: "—",
    emptyMessage: "No trial shoots in flight.",
  },
  {
    id: "quoted",
    label: "Quoted",
    tintVar: "var(--color-neutral-250, oklch(0.91 0.012 70))",
    emptyHero: "—",
    emptyMessage: "Nothing out for decision.",
  },
  {
    id: "negotiating",
    label: "Negotiating",
    tintVar: "var(--color-neutral-300, oklch(0.88 0.014 70))",
    emptyHero: "—",
    emptyMessage: "Nobody pushing back right now.",
  },
  {
    id: "won",
    label: "Won",
    tintVar: "color-mix(in oklab, var(--color-neutral-150, oklch(0.95 0.008 70)) 75%, oklch(0.96 0.04 80) 25%)",
    emptyHero: "—",
    emptyMessage: "Quiet in here. For now.",
  },
  {
    id: "lost",
    label: "Lost",
    tintVar: "var(--color-neutral-400, oklch(0.82 0.008 70))",
    emptyHero: "—",
    emptyMessage:
      "Either we're winning everything or you haven't updated this in a while. One of those.",
  },
] as const;
