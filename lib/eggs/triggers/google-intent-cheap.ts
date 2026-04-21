/**
 * @egg google_intent_cheap
 * @register public-bartender
 * @reads
 *   - TriggerContext.referrer (document.referrer URL with query string, browser-given)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [matchedTerm, query, reason]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

const CHEAP_TERMS = ["cheap", "discount", "affordable", "low cost", "budget", "free"];

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (!ctx.referrer) return null;

  let query = "";
  try {
    const url = new URL(ctx.referrer);
    query = (url.searchParams.get("q") ?? url.searchParams.get("query") ?? "").toLowerCase();
  } catch {
    return null;
  }

  if (!query) return null;

  const matched = CHEAP_TERMS.find((term) => query.includes(term));
  if (!matched) return null;

  return { matchedTerm: matched, query, reason: "search_query_contains_cheap_term" };
}

registerTrigger("google_intent_cheap", evaluate);
