/**
 * Outreach warmup cap enforcement.
 *
 * TODO: LG-6 will implement real warmup ramp (4-week schedule: 5/10/15/20/30
 * sends/day, non-overrideable per spec §10.2). This stub always reports
 * remaining = 10 so the orchestrator can run end-to-end before LG-6 ships.
 *
 * Owner: LG-6. Consumer: LG-4 orchestrator.
 */

export interface WarmupCapResult {
  cap: number;
  used: number;
  remaining: number;
  can_send: boolean;
}

/**
 * Returns the current warmup sending capacity.
 *
 * Stub implementation — LG-6 will replace this with the real warmup ramp.
 */
export async function enforceWarmupCap(): Promise<WarmupCapResult> {
  // TODO: LG-6 will implement real warmup ramp
  return { cap: 10, used: 0, remaining: 10, can_send: true };
}
