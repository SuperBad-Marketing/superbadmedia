/**
 * Opus prompt — `six-week-plan-weeks`.
 *
 * Stage 2: per-week elaboration from strategy outline + context.
 * Populated by content mini-session before SWP-2.
 */

import type { SixWeekContextBundle, StrategyOutput } from "./strategy";

export type WeeksInput = {
  contextBundle: SixWeekContextBundle;
  strategyOutline: StrategyOutput;
  regenNote?: string | null;
  regenWeekNumbers?: number[] | null;
  selfReviewIssues?: string[] | null;
};

export type TaskCategory =
  | "infrastructure"
  | "content"
  | "distribution"
  | "conversion"
  | "measurement";

export type EffortEstimate = "quick" | "half_day" | "full_day" | "multi_day";

export type PlanTask = {
  title: string;
  detail: string;
  category: TaskCategory;
  effort_estimate: EffortEstimate;
};

export type ContentAngle = {
  description: string;
  shoot_asset_ref: string;
  caption_direction: string;
};

export type WeekPlan = {
  week_number: 1 | 2 | 3 | 4 | 5 | 6;
  theme: string;
  why_this_week: string;
  content_angles: ContentAngle[];
  channel_mix: string[];
  tasks: PlanTask[];
  success_signal: string;
  fallback: string;
};

export type WeeksOutput = {
  plan_intro: string;
  weeks: WeekPlan[];
};

export function buildWeeksPrompt(_input: WeeksInput): string {
  // Populated by content mini-session
  return "STUB — populated by content mini-session";
}
