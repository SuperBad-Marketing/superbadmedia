/**
 * @egg fifth_time_visitor
 * @register public-bartender
 * @reads
 *   - TriggerContext.visitCount (cookie-counted distinct calendar-day visits)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [visitCount, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.visitCount !== 5) return null;

  return { visitCount: ctx.visitCount, reason: "fifth_distinct_calendar_day_visit" };
}

registerTrigger("fifth_time_visitor", evaluate);
