/**
 * @egg late_night_visitor
 * @register public-bartender
 * @reads
 *   - TriggerContext.localHour (client-side local time, freely given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [localHour, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.localHour >= 2 && ctx.localHour < 5) {
    return { localHour: ctx.localHour, reason: "visitor_local_time_0200_0459" };
  }
  return null;
}

registerTrigger("late_night_visitor", evaluate);
