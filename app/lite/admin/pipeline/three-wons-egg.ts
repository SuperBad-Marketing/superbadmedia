"use server";

import { auth } from "@/lib/auth/session";
import settings from "@/lib/settings";

/**
 * Surprise & Delight — "three Wons in a session" admin easter egg.
 *
 * Spec anchors:
 *   - sales-pipeline.md §11A.4 — admin-roommate register, ≤ once/month,
 *     registry-gated, reads only `deals` + Andy's session timestamps.
 *   - surprise-and-delight.md admin egg catalogue — entry #3 (patched as
 *     part of SP-9).
 *
 * Returns `true` only when the monthly cooldown has elapsed and the
 * caller should render the egg toast. The session-local counter lives on
 * the client (`PipelineBoard`); the server-side gate is the real cap.
 *
 * PATCHES_OWED — once the S&D spec's `hidden_egg_fires` table lands, this
 * function migrates to writing a row there instead of stamping the
 * settings key.
 */
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export async function maybeFireThreeWonsEgg(): Promise<boolean> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return false;

  const now = Date.now();
  const lastFired = await settings.get(
    "pipeline.sd_three_wons_last_fired_ms",
  );
  if (typeof lastFired === "number" && now - lastFired < COOLDOWN_MS) {
    return false;
  }
  await settings.set("pipeline.sd_three_wons_last_fired_ms", String(now));
  return true;
}
