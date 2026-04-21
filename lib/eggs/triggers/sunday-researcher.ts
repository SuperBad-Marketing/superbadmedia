/**
 * @egg sunday_researcher
 * @register public-bartender
 * @reads
 *   - TriggerContext.dayOfWeek (client-side, freely given)
 *   - TriggerContext.dwellMs (session dwell, browser-given)
 *   - TriggerContext.referrer (document.referrer, browser-given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [dayOfWeek, dwellMs, referrer, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

const SEARCH_ENGINES = [
  "google.com",
  "google.com.au",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "ecosia.org",
];

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (ctx.dayOfWeek !== 0) return null;
  if (ctx.dwellMs < 45_000) return null;

  const referrerLower = ctx.referrer.toLowerCase();
  const fromSearch = SEARCH_ENGINES.some((engine) => referrerLower.includes(engine));
  if (!fromSearch) return null;

  return {
    dayOfWeek: ctx.dayOfWeek,
    dwellMs: ctx.dwellMs,
    referrer: ctx.referrer,
    reason: "sunday_search_engine_45s_dwell",
  };
}

registerTrigger("sunday_researcher", evaluate);
