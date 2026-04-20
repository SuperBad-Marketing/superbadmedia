"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { createCandidateArchive } from "@/lib/hiring/queries";
import {
  CANDIDATE_STAGES,
  type CandidateStage,
} from "@/lib/db/schema/candidates";
import {
  SKIP_TRIAL_REASONS,
  type SkipTrialReason,
} from "@/lib/hiring/stages";
import type { ArchiveResult } from "@/components/lite/hiring-pipeline/archive-modal";

type ActionResult = { ok: true } | { ok: false; error: string };

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function transitionCandidateAction(
  candidateId: string,
  toStage: CandidateStage,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };
  if (!CANDIDATE_STAGES.includes(toStage)) {
    return { ok: false, error: "Unknown stage." };
  }
  try {
    transitionCandidateStage(candidateId, toStage, { by });
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transition failed.",
    };
  }
}

export async function archiveCandidateAction(
  candidateId: string,
  fromStage: CandidateStage,
  archive: ArchiveResult,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  try {
    await createCandidateArchive({
      candidate_id: candidateId,
      stage_when_archived: fromStage,
      reason_code: archive.reason_code,
      reason_free_text: archive.reason_free_text,
      reflection_text: archive.reflection_text,
      disposition_direction: archive.disposition_direction,
    });

    transitionCandidateStage(candidateId, "archived", { by });
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Archive failed.",
    };
  }
}

export async function skipTrialAction(
  candidateId: string,
  reason: SkipTrialReason,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (!SKIP_TRIAL_REASONS.includes(reason)) {
    return { ok: false, error: "Unknown skip-trial reason." };
  }

  try {
    transitionCandidateStage(candidateId, "bench", {
      by,
      meta: { skip_trial_reason: reason },
    });
    revalidatePath("/lite/admin/hiring");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Skip-trial failed.",
    };
  }
}
