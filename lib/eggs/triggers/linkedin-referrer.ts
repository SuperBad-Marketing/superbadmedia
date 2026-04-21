/**
 * @egg linkedin_referrer
 * @register public-bartender
 * @reads
 *   - TriggerContext.referrer (document.referrer, browser-given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [referrer, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

const LINKEDIN_PATTERNS = [
  "linkedin.com",
  "lnkd.in",
];

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  const referrerLower = ctx.referrer.toLowerCase();
  const fromLinkedIn = LINKEDIN_PATTERNS.some((p) => referrerLower.includes(p));
  if (!fromLinkedIn) return null;

  return { referrer: ctx.referrer, reason: "linkedin_referrer_detected" };
}

registerTrigger("linkedin_referrer", evaluate);
