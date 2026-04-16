/**
 * Client-safe constants for the refine sidecar. Lives in a bundler-safe
 * module (no `@/lib/db` import) so `"use client"` components can pull
 * the limits without dragging better-sqlite3 into the browser bundle.
 *
 * `@/lib/graph/refine-draft` re-exports these so server callers can
 * still import them from a single module.
 */
export const MAX_REFINE_INSTRUCTION_CHARS = 500;
export const MAX_REFINE_TURNS = 6;

export interface RefineTurn {
  /** The instruction Andy typed on that turn. */
  instruction: string;
  /** The draft body the generator produced for that turn. */
  result_body: string;
}
