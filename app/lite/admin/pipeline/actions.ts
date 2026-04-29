"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  transitionDealStage,
  finaliseDealAsWon,
  finaliseDealAsLost,
} from "@/lib/crm";
import { createDealFromLead } from "@/lib/crm/create-deal-from-lead";
import { autoEnrichCompanyIfNeeded } from "@/lib/crm/auto-enrich";
import { maybeFireThreeWonsEgg } from "@/lib/eggs/admin-triggers/three-wons";
import {
  DEAL_STAGES,
  DEAL_WON_OUTCOMES,
  DEAL_LOSS_REASONS,
  type DealStage,
  type DealWonOutcome,
  type DealLossReason,
} from "@/lib/db/schema/deals";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function checkThreeWonsEggAction(): Promise<boolean> {
  try {
    return await maybeFireThreeWonsEgg();
  } catch {
    return false;
  }
}

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

export interface AddLeadInput {
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  contactRole?: string;
  notes?: string;
  stage?: DealStage;
}

type AddLeadResult =
  | { ok: true; dealId: string; companyReused: boolean; contactReused: boolean }
  | { ok: false; error: string };

export async function addLeadAction(input: AddLeadInput): Promise<AddLeadResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  if (!companyName) return { ok: false, error: "Company name is required." };
  if (!contactName) return { ok: false, error: "Contact name is required." };

  const stage = input.stage ?? "lead";
  if (!DEAL_STAGES.includes(stage)) {
    return { ok: false, error: "Unknown stage." };
  }

  try {
    const result = createDealFromLead({
      company: { name: companyName },
      contact: {
        name: contactName,
        email: input.contactEmail?.trim() || null,
        phone: input.contactPhone?.trim() || null,
        role: input.contactRole?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      source: "manual_admin",
      stage,
    });
    // Fire-and-forget enrichment for the company (non-blocking)
    void autoEnrichCompanyIfNeeded(result.company.id, {
      by: `user:${session.user.id ?? "admin"}`,
    });

    revalidatePath("/lite/admin/pipeline");
    return {
      ok: true,
      dealId: result.deal.id,
      companyReused: result.companyReused,
      contactReused: result.contactReused,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create lead.",
    };
  }
}
