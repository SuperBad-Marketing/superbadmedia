/**
 * @egg public_crt_turn_off
 * @register public-bartender
 * @reads
 *   - TriggerContext.melbourneHour (pre-resolved Melbourne local hour)
 *   - TriggerContext.dwellMs (session dwell, browser-given)
 *   - TriggerContext.firedEggIdsInSession (cross-egg suppression)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation
 * @cross_client_inference false
 * @evidence_fields [melbourneHour, dwellMs, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

const MIN_DWELL_MS = 3 * 60 * 1000; // 3 minutes continuous

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.melbourneHour == null) return null;
  if (ctx.melbourneHour < 1 || ctx.melbourneHour >= 5) return null;
  if (ctx.dwellMs < MIN_DWELL_MS) return null;

  const firedInSession = ctx.firedEggIdsInSession ?? [];
  if (firedInSession.includes("late_night_visitor")) return null;

  return {
    melbourneHour: ctx.melbourneHour,
    dwellMs: ctx.dwellMs,
    reason: "melbourne_0100_0459_3min_dwell_no_late_night_egg",
  };
}

registerTrigger("public_crt_turn_off", evaluate);
