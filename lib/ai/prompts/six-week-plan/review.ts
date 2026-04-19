/**
 * Haiku prompt — `six-week-plan-review`.
 *
 * Self-review pass after stage 2 elaboration.
 * Populated by content mini-session before SWP-2.
 */

import type { WeeksOutput } from "./weeks";

export type ReviewInput = {
  planJson: WeeksOutput;
  signalEnergy: number;
};

export type ReviewOutput = {
  passes: boolean;
  issues: string[];
};

export function buildReviewPrompt(_input: ReviewInput): string {
  // Populated by content mini-session
  return "STUB — populated by content mini-session";
}
