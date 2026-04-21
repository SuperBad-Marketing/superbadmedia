/**
 * @egg rapid_scroller
 * @register public-bartender
 * @reads
 *   - TriggerContext.scrollDepth (scroll position ratio, browser-given)
 *   - TriggerContext.scrollDurationMs (time from first scroll to bottom, browser-given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [scrollDepth, scrollDurationMs, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.scrollDepth < 0.9) return null;
  if (ctx.scrollDurationMs >= 6_000) return null;
  if (ctx.scrollDurationMs <= 0) return null;

  return {
    scrollDepth: ctx.scrollDepth,
    scrollDurationMs: ctx.scrollDurationMs,
    reason: "scrolled_full_page_under_6s",
  };
}

registerTrigger("rapid_scroller", evaluate);
