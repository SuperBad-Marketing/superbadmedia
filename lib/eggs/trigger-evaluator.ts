/**
 * Trigger evaluator framework for hidden eggs.
 *
 * Each egg trigger is a pure function: (context) => evidence | null.
 * Returns evidence object on match, null on no-match.
 * Fail-closed: ambiguous state returns null.
 */

export interface TriggerContext {
  nowMs: number;
  localHour: number;
  dayOfWeek: number;
  referrer: string;
  dwellMs: number;
  scrollDepth: number;
  scrollDurationMs: number;
  tabBackgroundedMs: number;
  timezone: string;
  visitCount: number;
  sessionId: string;
  isMobile: boolean;
  /** YYYY-MM-DD in Melbourne time, populated by the orchestration layer. */
  melbourneDateISO?: string;
  /** Melbourne local hour (0-23), populated by the orchestration layer. */
  melbourneHour?: number;
  /** Holiday name if today is a public holiday, null otherwise. */
  holidayName?: string | null;
  /** Current Melbourne precipitation mm/h from Open-Meteo, null if unknown. */
  weatherPrecipitationMm?: number | null;
  /** Egg IDs already fired in this session (for cross-egg suppression). */
  firedEggIdsInSession?: string[];
}

export type TriggerEvidence = Record<string, unknown>;

export type TriggerFn = (ctx: TriggerContext) => TriggerEvidence | null;

export interface RegisteredTrigger {
  eggId: string;
  evaluate: TriggerFn;
}

const triggers: RegisteredTrigger[] = [];

export function registerTrigger(eggId: string, evaluate: TriggerFn): void {
  triggers.push({ eggId, evaluate });
}

export function evaluateAllTriggers(
  ctx: TriggerContext,
): Array<{ eggId: string; evidence: TriggerEvidence }> {
  const results: Array<{ eggId: string; evidence: TriggerEvidence }> = [];
  for (const trigger of triggers) {
    const evidence = trigger.evaluate(ctx);
    if (evidence !== null) {
      results.push({ eggId: trigger.eggId, evidence });
    }
  }
  return results;
}

export function getRegisteredTriggers(): readonly RegisteredTrigger[] {
  return triggers;
}
