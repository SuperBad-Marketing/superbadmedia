/**
 * Empty-state copy bank — keyed by surface + context per the cross-cutting
 * Voice & Delight discipline (sales-pipeline §11A.1, design-system-baseline
 * empty-state rules). Copy lives here, never inline, so the sprinkle budget
 * stays readable in one place.
 *
 * Tone: dry-observational admin-roommate register for admin surfaces.
 * Never cheerleading, never exclamation marks, never "success" or "🎉".
 *
 * Future consumers (activity feed, company feed, etc.) register here even
 * before their render surface exists — the sprinkle claim is what gets
 * audited, not the DOM.
 */

export interface EmptyStateCopy {
  hero: string;
  message: string;
}

export const EMPTY_STATES = {
  // Sales Pipeline — 8 Kanban columns (sales-pipeline §11A.1).
  "pipeline.column.lead": {
    hero: "—",
    message: "No leads yet. Lead Gen will fill this in when it's built.",
  },
  "pipeline.column.contacted": {
    hero: "—",
    message: "Nothing out there waiting for a reply. Enviable.",
  },
  "pipeline.column.conversation": {
    hero: "—",
    message: "Nobody's talking. For now.",
  },
  "pipeline.column.trial_shoot": {
    hero: "—",
    message: "No trial shoots in flight.",
  },
  "pipeline.column.quoted": {
    hero: "—",
    message: "Nothing out for decision.",
  },
  "pipeline.column.negotiating": {
    hero: "—",
    message: "Nobody pushing back right now.",
  },
  "pipeline.column.won": {
    hero: "—",
    message: "Quiet in here. For now.",
  },
  "pipeline.column.lost": {
    hero: "—",
    message:
      "Either we're winning everything or you haven't updated this in a while. One of those.",
  },

  // Feed surfaces — sales-pipeline §11A.1. Consumers land in later sessions;
  // bank entries registered now so voice passes can audit in one place.
  "pipeline.deal_activity_feed": {
    hero: "—",
    message: "Nothing's happened here yet. Deal's too new to gossip about.",
  },
  "pipeline.company_feed_new": {
    hero: "—",
    message: "First note, first entry. Tidy.",
  },

  // Hiring Pipeline — 7 Kanban columns (hiring-pipeline §13.1).
  "hiring.column.sourced": {
    hero: "—",
    message: "Nobody scouted yet. Discovery kicks in weekly.",
  },
  "hiring.column.invited": {
    hero: "—",
    message: "No invites out. Quiet inbox, quiet column.",
  },
  "hiring.column.applied": {
    hero: "—",
    message: "Nobody's applied. The form is patient.",
  },
  "hiring.column.screened": {
    hero: "—",
    message: "Nothing to screen. Enjoy the silence.",
  },
  "hiring.column.trial": {
    hero: "—",
    message: "No trials in flight.",
  },
  "hiring.column.bench": {
    hero: "—",
    message: "Nobody on the bench. Bet there's a Role Brief waiting.",
  },
  "hiring.column.archived": {
    hero: "—",
    message: "Clean slate. Either early days or unrealistically picky.",
  },
} as const satisfies Record<string, EmptyStateCopy>;

export type EmptyStateKey = keyof typeof EMPTY_STATES;

export function getEmptyState(key: EmptyStateKey): EmptyStateCopy {
  return EMPTY_STATES[key];
}
