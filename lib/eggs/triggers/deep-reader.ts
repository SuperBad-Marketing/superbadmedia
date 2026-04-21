/**
 * @egg deep_reader
 * @register public-bartender
 * @reads
 *   - TriggerContext.dwellMs (session dwell, browser-given)
 *   - TriggerContext.scrollDepth (scroll position ratio, browser-given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [dwellMs, scrollDepth, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.dwellMs < 240_000) return null;
  if (ctx.scrollDepth < 0.7) return null;

  return {
    dwellMs: ctx.dwellMs,
    scrollDepth: ctx.scrollDepth,
    reason: "dwell_4min_plus_scroll_70pct_plus",
  };
}

registerTrigger("deep_reader", evaluate);
