import type { ActorType } from "@/lib/db/schema/hidden-egg-fires";
import type { EggDefinition } from "./registry";

const MS_PER_DAY = 86_400_000;

export interface CadenceState {
  actorType: ActorType;
  lastHiddenEggFiredAtMs: number | null;
  firedEggIdsRecent: string[];
  tricksEnabled: boolean;
}

export interface PublicCadenceState {
  firstEggDeliveredAt: number | null;
  lastHiddenEggFiredAt: number | null;
  firedEggIds: string[];
  tricksDisabled: boolean;
}

export function canFireAuthenticatedEgg(
  egg: EggDefinition,
  state: CadenceState,
  now: number,
  cadenceDays: number,
): boolean {
  if (!state.tricksEnabled) return false;

  if (
    state.lastHiddenEggFiredAtMs !== null &&
    now - state.lastHiddenEggFiredAtMs < cadenceDays * MS_PER_DAY
  ) {
    return false;
  }

  if (!egg.exemptFromBudget && egg.cooldownDays > 0) {
    if (state.firedEggIdsRecent.includes(egg.id)) {
      return false;
    }
  }

  return true;
}

export function canFirePublicEgg(
  egg: EggDefinition,
  state: PublicCadenceState,
  now: number,
  publicCadenceDays: number,
): boolean {
  if (state.tricksDisabled) return false;

  if (egg.exemptFromBudget) return true;

  if (state.firstEggDeliveredAt === null) return true;

  const budgetWindowMs = publicCadenceDays * MS_PER_DAY;
  const recentFires = state.lastHiddenEggFiredAt ?? 0;
  const firedInWindow = now - recentFires < budgetWindowMs;
  const countInWindow = state.firedEggIds.length;

  if (firedInWindow && countInWindow >= 2) return false;

  if (egg.cooldownDays === Infinity) {
    if (state.firedEggIds.includes(egg.id)) return false;
  } else if (egg.cooldownDays > 0) {
    if (state.firedEggIds.includes(egg.id)) return false;
  }

  return true;
}

export function updateFiredEggIds(
  current: string[],
  newEggId: string,
  maxEntries = 50,
): string[] {
  const updated = [...current, newEggId];
  if (updated.length > maxEntries) {
    return updated.slice(updated.length - maxEntries);
  }
  return updated;
}
