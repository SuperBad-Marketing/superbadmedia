/**
 * Opus prompt — `six-week-plan-strategy`.
 *
 * Stage 1: strategy outline from full context bundle.
 * Populated by content mini-session before SWP-2.
 */

export type StrategyInput = {
  contextBundle: SixWeekContextBundle;
  regenNote?: string | null;
};

export type SixWeekContextBundle = {
  questionnaireAnswers: Record<string, unknown> | null;
  enrichmentProfile: Record<string, unknown> | null;
  shootDayNotes: ShootDayNotesContext | null;
  brandDnaProfile: Record<string, unknown> | null;
  trialShootOffer: string;
};

export type ShootDayNotesContext = {
  infrastructure: Record<string, unknown>;
  goals: Array<{ priority: number; text: string }>;
  signals: {
    energy: number;
    fluency: number;
    icp_clarity: number;
    conversion_ready: number;
  };
  observations: string;
};

export type FlaggedAssumption = {
  statement: string;
  confidence: "low" | "medium" | "high";
  what_to_verify: string;
};

export type WeeklyTheme = {
  week_number: 1 | 2 | 3 | 4 | 5 | 6;
  theme: string;
};

export type StrategyOutput = {
  current_state_diagnosis: string;
  primary_goal: string;
  chosen_primitives: string[];
  theme_arc: WeeklyTheme[];
  flagged_assumptions: FlaggedAssumption[];
};

export function buildStrategyPrompt(_input: StrategyInput): string {
  // Populated by content mini-session
  return "STUB — populated by content mini-session";
}
