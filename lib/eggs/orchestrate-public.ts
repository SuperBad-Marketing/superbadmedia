/**
 * Public egg orchestration — server-side trigger evaluation.
 *
 * Called from the public egg API route with client-gathered context.
 * Resolves Melbourne time/weather/holidays server-side, runs all
 * 12 triggers, applies cadence gates, fires at most one egg.
 */

import settingsRegistry from "@/lib/settings";
import { PUBLIC_EGGS } from "./registry";
import { canFirePublicEgg, type PublicCadenceState } from "./cadence";
import { fireEgg } from "./fire-egg";
import { evaluateAllTriggers, type TriggerContext } from "./trigger-evaluator";
import { getMelbourneDateISO, getMelbourneHour, getHolidayName } from "./melbourne-holidays";
import { getMelbournePrecipitation } from "./melbourne-weather";
import "./triggers";

export interface PublicEggEvaluateInput {
  localHour: number;
  dayOfWeek: number;
  referrer: string;
  dwellMs: number;
  scrollDepth: number;
  scrollDurationMs: number;
  tabBackgroundedMs: number;
  timezone: string;
  visitCount: number;
  sessionId: string;
  isMobile: boolean;
  firstEggDeliveredAt: number | null;
  lastHiddenEggFiredAt: number | null;
  firedEggIds: string[];
  tricksDisabled: boolean;
  sessionFiredEggIds: string[];
}

export interface PublicEggEvaluateResult {
  fired: boolean;
  eggId: string | null;
  evidence: Record<string, unknown> | null;
  copy: string | null;
}

const NO_FIRE: PublicEggEvaluateResult = {
  fired: false,
  eggId: null,
  evidence: null,
  copy: null,
};

export async function orchestratePublicEggs(
  input: PublicEggEvaluateInput,
): Promise<PublicEggEvaluateResult> {
  const globalEnabled = await settingsRegistry.get("surprise.hidden_eggs_enabled");
  if (!globalEnabled) return NO_FIRE;
  if (input.tricksDisabled) return NO_FIRE;

  const nowMs = Date.now();
  const melbourneDateISO = getMelbourneDateISO(nowMs);
  const melbourneHour = getMelbourneHour(nowMs);
  const holidayName = getHolidayName(melbourneDateISO);

  let weatherPrecipitationMm: number | null = null;
  try {
    weatherPrecipitationMm = await getMelbournePrecipitation();
  } catch {
    // Weather unavailable — rain egg won't fire
  }

  const ctx: TriggerContext = {
    nowMs,
    localHour: input.localHour,
    dayOfWeek: input.dayOfWeek,
    referrer: input.referrer,
    dwellMs: input.dwellMs,
    scrollDepth: input.scrollDepth,
    scrollDurationMs: input.scrollDurationMs,
    tabBackgroundedMs: input.tabBackgroundedMs,
    timezone: input.timezone,
    visitCount: input.visitCount,
    sessionId: input.sessionId,
    isMobile: input.isMobile,
    melbourneDateISO,
    melbourneHour,
    holidayName,
    weatherPrecipitationMm,
    firedEggIdsInSession: input.sessionFiredEggIds,
  };

  const matches = evaluateAllTriggers(ctx);
  if (matches.length === 0) return NO_FIRE;

  const cadenceDays = await settingsRegistry.get("surprise.public_egg_cadence_per_days");

  const cadenceState: PublicCadenceState = {
    firstEggDeliveredAt: input.firstEggDeliveredAt,
    lastHiddenEggFiredAt: input.lastHiddenEggFiredAt,
    firedEggIds: input.firedEggIds,
    tricksDisabled: false,
  };

  for (const match of matches) {
    const eggDef = PUBLIC_EGGS.find((e) => e.id === match.eggId);
    if (!eggDef) continue;

    if (!canFirePublicEgg(eggDef, cadenceState, nowMs, cadenceDays)) continue;

    const visitorId = input.sessionId;

    await fireEgg({
      eggId: match.eggId,
      actorType: "public",
      visitorId,
      sessionId: input.sessionId,
      evidence: match.evidence,
    });

    return {
      fired: true,
      eggId: match.eggId,
      evidence: match.evidence,
      copy: null,
    };
  }

  return NO_FIRE;
}
