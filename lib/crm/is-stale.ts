import type { DealStage } from "@/lib/db/schema/deals";

export type PipelineStaleThresholds = {
  lead_days: number;
  contacted_days: number;
  conversation_days: number;
  trial_shoot_days: number;
  quoted_days: number;
  negotiating_days: number;
};

const THRESHOLD_KEY_FOR_STAGE: Partial<Record<DealStage, keyof PipelineStaleThresholds>> = {
  lead: "lead_days",
  contacted: "contacted_days",
  conversation: "conversation_days",
  trial_shoot: "trial_shoot_days",
  quoted: "quoted_days",
  negotiating: "negotiating_days",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IsDealStaleInput {
  stage: DealStage;
  last_stage_change_at_ms: number | null;
  snoozed_until_ms: number | null;
}

/**
 * Pure per-deal staleness check (spec sales-pipeline §8.1).
 *
 * - Won / Lost are terminal and never stale.
 * - An unsnoozed deal is stale when `now - last_stage_change_at_ms` exceeds
 *   the per-stage threshold (days → ms).
 * - A deal with a future `snoozed_until_ms` is suppressed; once the snooze
 *   has passed, staleness is recomputed normally.
 * - Nullish `last_stage_change_at_ms` is treated as not-stale (defensive —
 *   every real deal carries the column NOT NULL, but this keeps the pure
 *   function total).
 */
export function isDealStale(
  deal: IsDealStaleInput,
  thresholds: PipelineStaleThresholds,
  nowMs: number,
): boolean {
  const key = THRESHOLD_KEY_FOR_STAGE[deal.stage];
  if (!key) return false;
  if (deal.last_stage_change_at_ms == null) return false;
  if (deal.snoozed_until_ms != null && deal.snoozed_until_ms > nowMs) {
    return false;
  }
  const thresholdMs = thresholds[key] * DAY_MS;
  return nowMs - deal.last_stage_change_at_ms > thresholdMs;
}
