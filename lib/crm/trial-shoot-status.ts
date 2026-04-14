import {
  TRIAL_SHOOT_STATUSES,
  type TrialShootStatus,
} from "@/lib/db/schema/companies";

export { TRIAL_SHOOT_STATUSES };
export type { TrialShootStatus };

/**
 * Ordered sequence of trial-shoot sub-statuses. Index defines the
 * canonical forward progression per `docs/specs/sales-pipeline.md §9`.
 * `none` is the pre-booking placeholder; every real lifecycle event
 * advances toward `completed_feedback_provided`.
 */
export const TRIAL_SHOOT_SEQUENCE = TRIAL_SHOOT_STATUSES;

function indexOf(status: TrialShootStatus): number {
  return TRIAL_SHOOT_SEQUENCE.indexOf(status);
}

export function isForwardTransition(
  from: TrialShootStatus,
  to: TrialShootStatus,
): boolean {
  return indexOf(to) > indexOf(from);
}

export function isTrialShootComplete(status: TrialShootStatus): boolean {
  return (
    status === "completed_awaiting_feedback" ||
    status === "completed_feedback_provided"
  );
}

/**
 * Return the statuses strictly ahead of `from` in the sequence. Used by
 * the admin Advance control to render only legal targets.
 */
export function legalForwardTargets(
  from: TrialShootStatus,
): readonly TrialShootStatus[] {
  const i = indexOf(from);
  return TRIAL_SHOOT_SEQUENCE.slice(i + 1);
}
