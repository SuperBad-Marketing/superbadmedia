"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { transitionDealStage } from "@/lib/crm";
import { DEAL_STAGES, type DealStage } from "@/lib/db/schema/deals";

/**
 * Server Action — thin wrapper around `transitionDealStage`. Returns a
 * discriminated result so the client can animate bounce-back on error.
 * Won/Lost transitions are gated here too (client also guards via
 * `canDrop`) — SP-6 owns the full Won/Lost flow.
 */
export async function transitionDealAction(
  dealId: string,
  toStage: DealStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  if (!DEAL_STAGES.includes(toStage)) {
    return { ok: false, error: "Unknown stage." };
  }
  if (toStage === "won" || toStage === "lost") {
    return {
      ok: false,
      error: "Won/Lost flows ship in SP-6.",
    };
  }
  try {
    transitionDealStage(dealId, toStage, {
      by: `user:${session.user.id ?? "admin"}`,
    });
    revalidatePath("/lite/admin/pipeline");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transition failed.",
    };
  }
}
