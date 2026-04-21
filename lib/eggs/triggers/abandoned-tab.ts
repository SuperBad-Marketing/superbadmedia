/**
 * @egg abandoned_tab
 * @register public-bartender
 * @reads
 *   - TriggerContext.tabBackgroundedMs (Page Visibility API duration, browser-given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [tabBackgroundedMs, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.tabBackgroundedMs < 600_000) return null;

  return {
    tabBackgroundedMs: ctx.tabBackgroundedMs,
    reason: "tab_backgrounded_10min_plus",
  };
}

registerTrigger("abandoned_tab", evaluate);
