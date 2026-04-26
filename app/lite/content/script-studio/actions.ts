"use server";

import { auth } from "@/lib/auth/session";
import {
  createSessionPack,
  updateScriptStatus,
  updatePackEnergy,
} from "@/lib/talking-head/session-pack";
import type { EnergyLevel } from "@/lib/db/schema/talking-head";

export async function generatePackAction(energy: EnergyLevel, count: number) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return createSessionPack(energy, count);
}

export async function updateScriptStatusAction(
  scriptId: string,
  status: "approved" | "skipped" | "filmed",
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return updateScriptStatus(scriptId, status);
}

export async function updatePackEnergyAction(
  packId: string,
  energy: EnergyLevel,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return updatePackEnergy(packId, energy);
}
