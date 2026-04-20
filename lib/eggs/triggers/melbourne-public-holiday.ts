/**
 * @egg melbourne_public_holiday
 * @register public-bartender
 * @reads
 *   - TriggerContext.melbourneDateISO (pre-resolved Melbourne date)
 *   - TriggerContext.holidayName (pre-resolved from /data/au-holidays.json)
 * @does_not_read
 *   - any authenticated-user data
 *   - any server-side state beyond the holiday calendar
 * @cross_client_inference false
 * @evidence_fields [melbourneDateISO, holidayName]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  if (!ctx.holidayName) return null;

  return {
    melbourneDateISO: ctx.melbourneDateISO,
    holidayName: ctx.holidayName,
    reason: "australian_public_holiday",
  };
}

registerTrigger("melbourne_public_holiday", evaluate);
