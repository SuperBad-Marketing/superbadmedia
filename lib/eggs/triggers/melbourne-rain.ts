/**
 * @egg melbourne_rain
 * @register public-bartender
 * @reads
 *   - TriggerContext.timezone (client-side, freely given)
 *   - TriggerContext.weatherPrecipitationMm (pre-fetched from Open-Meteo)
 * @does_not_read
 *   - any authenticated-user data
 *   - IP geolocation or GPS
 * @cross_client_inference false
 * @evidence_fields [timezone, weatherPrecipitationMm]
 */

import { registerTrigger, type TriggerContext, type TriggerEvidence } from "../trigger-evaluator";

const MELBOURNE_TIMEZONES = [
  "australia/melbourne",
  "australia/hobart",
  "australia/sydney",
  "australia/act",
  "australia/canberra",
];

function evaluate(ctx: TriggerContext): TriggerEvidence | null {
  const tz = ctx.timezone.toLowerCase();
  if (!MELBOURNE_TIMEZONES.some((mtz) => tz.includes(mtz))) return null;

  if (ctx.weatherPrecipitationMm == null || ctx.weatherPrecipitationMm <= 0) return null;

  return {
    timezone: ctx.timezone,
    weatherPrecipitationMm: ctx.weatherPrecipitationMm,
    reason: "melbourne_timezone_active_precipitation",
  };
}

registerTrigger("melbourne_rain", evaluate);
