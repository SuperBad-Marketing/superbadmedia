/**
 * @egg returning_visitor
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
  if (ctx.visitCount < 2) return null;
  if (ctx.visitCount === 5) return null;

  return { visitCount: ctx.visitCount, reason: "returning_visitor_not_fifth" };
}

registerTrigger("returning_visitor", evaluate);
