"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  transitionDealStage,
  finaliseDealAsWon,
  finaliseDealAsLost,
} from "@/lib/crm";
import {
  DEAL_STAGES,
  DEAL_WON_OUTCOMES,
  DEAL_LOSS_REASONS,
  type DealStage,
  type DealWonOutcome,
  type DealLossReason,
} from "@/lib/db/schema/deals";

type ActionResult = { ok: true } | { ok: false; error: string };

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

/**
 * Non-terminal transitions. Won/Lost drops get routed through
 * `finaliseWonAction` / `finaliseLostAction`; this action rejects them.
 */
export async function transitionDealAction(
  dealId: string,
  toStage: DealStage,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  if (!DEAL_STAGES.includes(toStage)) {
    return { ok: false, error: "Unknown stage." };
  }
  if (toStage === "won" || toStage === "lost") {
    return {
      ok: false,
      error: "Use the Won/Lost finalisation action.",
    };
  }
  try {
    transitionDealStage(dealId, toStage, { by });
    revalidatePath("/lite/admin/pipeline");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transition failed.",
    };
  }
}

export async function finaliseWonAction(
  dealId: string,
  wonOutcome: DealWonOutcome,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  if (!DEAL_WON_OUTCOMES.includes(wonOutcome)) {
    return { ok: false, error: "Unknown outcome." };
  }
  try {
    finaliseDealAsWon(dealId, { won_outcome: wonOutcome }, { by });
    revalidatePath("/lite/admin/pipeline");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Won transition failed.",
    };
  }
}

export async function finaliseLostAction(
  dealId: string,
  lossReason: DealLossReason,
  lossNotes: string | null,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  if (!DEAL_LOSS_REASONS.includes(lossReason)) {
    return { ok: false, error: "Unknown loss reason." };
  }
  const notes =
    lossNotes != null && lossNotes.trim().length > 0 ? lossNotes.trim() : null;
  if (lossReason === "other" && notes == null) {
    return { ok: false, error: "Notes required when reason is 'Other'." };
  }
  try {
    finaliseDealAsLost(
      dealId,
      { loss_reason: lossReason, loss_notes: notes },
      { by },
    );
    revalidatePath("/lite/admin/pipeline");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lost transition failed.",
    };
  }
}
