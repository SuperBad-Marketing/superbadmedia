/**
 * Admin egg orchestration layer.
 *
 * Called on admin session load (cockpit/any page). Evaluates all admin
 * egg triggers, applies suppression + cadence gates, fires at most one.
 *
 * Returns the egg ID + evidence if one fires, null otherwise.
 */

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/user";
import { eq } from "drizzle-orm";
import settingsRegistry from "@/lib/settings";
import { ADMIN_EGGS, type EggDefinition } from "./registry";
import { canFireAuthenticatedEgg, type CadenceState } from "./cadence";
import { fireEgg } from "./fire-egg";
import { evaluateCrtTurnOff, type CrtTurnOffResult } from "./admin-triggers/crt-turn-off";
import { scanForMilestones, generateMilestoneDraft, type DetectedMilestone } from "./admin-triggers/milestone-spotter";

export interface OrchestrateAdminResult {
  fired: boolean;
  eggId: string | null;
  evidence: Record<string, unknown> | null;
}

const NO_FIRE: OrchestrateAdminResult = {
  fired: false,
  eggId: null,
  evidence: null,
};

export async function orchestrateAdminEggs(
  userId: string,
): Promise<OrchestrateAdminResult> {
  const globalEnabled = await settingsRegistry.get("surprise.hidden_eggs_enabled");
  if (!globalEnabled) return NO_FIRE;

  const row = await db
    .select({
      hidden_egg_tricks_enabled: user.hidden_egg_tricks_enabled,
      last_hidden_egg_fired_at_ms: user.last_hidden_egg_fired_at_ms,
      fired_egg_ids_recent: user.fired_egg_ids_recent,
    })
    .from(user)
    .where(eq(user.id, userId))
    .then((rows) => rows[0]);

  if (!row) return NO_FIRE;
  if (!row.hidden_egg_tricks_enabled) return NO_FIRE;

  const cadenceDays = await settingsRegistry.get("surprise.admin_egg_cadence_per_days");
  const nowMs = Date.now();

  const cadenceState: CadenceState = {
    actorType: "admin",
    lastHiddenEggFiredAtMs: row.last_hidden_egg_fired_at_ms,
    firedEggIdsRecent: (row.fired_egg_ids_recent as string[]) ?? [],
    tricksEnabled: true,
  };

  const candidates: Array<{ egg: EggDefinition; evaluate: () => Promise<{ shouldFire: boolean; evidence: Record<string, unknown> }> }> = [];

  for (const egg of ADMIN_EGGS) {
    if (!canFireAuthenticatedEgg(egg, cadenceState, nowMs, cadenceDays)) continue;

    switch (egg.id) {
      case "crt_turn_off":
        candidates.push({
          egg,
          evaluate: async () => {
            const result: CrtTurnOffResult = await evaluateCrtTurnOff(userId, nowMs);
            return { shouldFire: result.shouldFire, evidence: result.evidence as unknown as Record<string, unknown> };
          },
        });
        break;
      case "milestone_spotter":
        candidates.push({
          egg,
          evaluate: async () => {
            const milestones: DetectedMilestone[] = await scanForMilestones(nowMs);
            if (milestones.length === 0) return { shouldFire: false, evidence: {} };
            const draft = await generateMilestoneDraft(milestones[0]);
            return {
              shouldFire: true,
              evidence: {
                milestone: milestones[0],
                draft,
              },
            };
          },
        });
        break;
      // three_wons is event-driven (fires inline on 3rd Won), not session-load
    }
  }

  for (const candidate of candidates) {
    const result = await candidate.evaluate();
    if (result.shouldFire) {
      await fireEgg({
        eggId: candidate.egg.id,
        actorType: "admin",
        userId,
        evidence: result.evidence,
      });
      return {
        fired: true,
        eggId: candidate.egg.id,
        evidence: result.evidence,
      };
    }
  }

  return NO_FIRE;
}
