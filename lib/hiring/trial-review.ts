import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { trial_tasks, type TrialTaskDisposition } from "@/lib/db/schema/trial-tasks";
import { candidates } from "@/lib/db/schema/candidates";
import { getTrialTaskById, updateTrialTask, getCandidateById } from "@/lib/hiring/queries";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { createCandidateArchive } from "@/lib/hiring/queries";
import { releaseContentItem } from "@/lib/content-engine/claimable-items";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";

// ── Mark Delivered ────────────────────────────────────────────────────

export interface MarkDeliveredInput {
  trialTaskId: string;
  deliveryUrl: string;
  by: string;
}

export type MarkDeliveredResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function markTrialTaskDelivered(
  input: MarkDeliveredInput,
): Promise<MarkDeliveredResult> {
  const task = await getTrialTaskById(input.trialTaskId);
  if (!task) return { ok: false, reason: "Trial task not found." };
  if (task.disposition !== "pending") {
    return { ok: false, reason: `Trial task disposition is '${task.disposition}', expected 'pending'.` };
  }

  const candidate = await getCandidateById(task.candidate_id);
  if (!candidate) return { ok: false, reason: "Candidate not found." };
  if (candidate.stage !== "trial") {
    return { ok: false, reason: `Candidate is in stage '${candidate.stage}', expected 'trial'.` };
  }

  await updateTrialTask(input.trialTaskId, {
    delivered_at_ms: Date.now(),
    delivery_url_or_asset: input.deliveryUrl,
  });

  await logActivity({
    kind: "candidate_trial_sent",
    body: `Trial task delivery received from ${candidate.name}: ${input.deliveryUrl}`,
    meta: {
      candidate_id: task.candidate_id,
      trial_task_id: input.trialTaskId,
      delivery_url: input.deliveryUrl,
    },
    createdBy: input.by,
  });

  return { ok: true };
}

// ── Review Trial Task ─────────────────────────────────────────────────

export interface ReviewTrialTaskInput {
  trialTaskId: string;
  notes: string;
  rating: number;
  disposition: TrialTaskDisposition;
  by: string;
}

export type ReviewTrialTaskResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function reviewTrialTask(
  input: ReviewTrialTaskInput,
): Promise<ReviewTrialTaskResult> {
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false, reason: "Rating must be 1–5." };
  }
  if (!["shipped", "archived", "redelivered"].includes(input.disposition)) {
    return { ok: false, reason: `Invalid disposition: '${input.disposition}'.` };
  }

  const task = await getTrialTaskById(input.trialTaskId);
  if (!task) return { ok: false, reason: "Trial task not found." };
  if (task.disposition !== "pending") {
    return { ok: false, reason: `Trial task already reviewed (disposition: '${task.disposition}').` };
  }

  const candidate = await getCandidateById(task.candidate_id);
  if (!candidate) return { ok: false, reason: "Candidate not found." };

  await updateTrialTask(input.trialTaskId, {
    andy_review_notes: input.notes,
    rating: input.rating,
    disposition: input.disposition,
  });

  if (input.disposition === "shipped") {
    await handleShipped(task.candidate_id, candidate.name, input);
  } else if (input.disposition === "archived") {
    await handleArchived(task.candidate_id, candidate.name, input);
  } else if (input.disposition === "redelivered") {
    await handleRedelivered(task, candidate.name, input);
  }

  return { ok: true };
}

// ── Disposition handlers ──────────────────────────────────────────────

async function handleShipped(
  candidateId: string,
  candidateName: string,
  input: ReviewTrialTaskInput,
): Promise<void> {
  await logActivity({
    kind: "candidate_trial_sent",
    body: `Trial task shipped by ${candidateName} (rating: ${input.rating}/5). Ready for bench consideration.`,
    meta: {
      candidate_id: candidateId,
      trial_task_id: input.trialTaskId,
      rating: input.rating,
      disposition: "shipped",
    },
    createdBy: input.by,
  });
}

async function handleArchived(
  candidateId: string,
  candidateName: string,
  input: ReviewTrialTaskInput,
): Promise<void> {
  const task = await getTrialTaskById(input.trialTaskId);

  if (task?.internal_content_ref) {
    await releaseContentItem(
      task.internal_content_ref,
      `Trial task archived — candidate ${candidateName} (rating ${input.rating}/5)`,
    );
  }

  await createCandidateArchive({
    candidate_id: candidateId,
    stage_when_archived: "trial",
    reason_code: "trial_not_shipped",
    reason_free_text: input.notes || null,
    reflection_text: null,
    disposition_direction: "we_archived",
  });

  transitionCandidateStage(candidateId, "archived", {
    by: input.by,
    meta: {
      trial_task_id: input.trialTaskId,
      rating: input.rating,
      reason: "trial_not_shipped",
    },
  });

  await logActivity({
    kind: "candidate_archived",
    body: `${candidateName} archived after trial (rating: ${input.rating}/5).`,
    meta: {
      candidate_id: candidateId,
      trial_task_id: input.trialTaskId,
      rating: input.rating,
      disposition: "archived",
    },
    createdBy: input.by,
  });
}

async function handleRedelivered(
  task: NonNullable<Awaited<ReturnType<typeof getTrialTaskById>>>,
  candidateName: string,
  input: ReviewTrialTaskInput,
): Promise<void> {
  const deadlineDays = await settings.get("hiring.trial.delivery_deadline_days");
  const newDueAtMs = Date.now() + deadlineDays * 24 * 60 * 60 * 1000;

  await updateTrialTask(input.trialTaskId, {
    due_at_ms: newDueAtMs,
    delivered_at_ms: null,
    delivery_url_or_asset: null,
    disposition: "pending",
  });

  const graceDays = await settings.get("hiring.trial.delivery_grace_days");
  const overdueAtMs = newDueAtMs + graceDays * 24 * 60 * 60 * 1000;
  await enqueueTask({
    task_type: "hiring_trial_task_overdue",
    runAt: overdueAtMs,
    payload: { trial_task_id: input.trialTaskId, candidate_id: task.candidate_id },
    idempotencyKey: `trial-overdue-redeliver-${input.trialTaskId}-${Date.now()}`,
  });

  await logActivity({
    kind: "candidate_trial_sent",
    body: `Revision requested for ${candidateName}'s trial task (rating: ${input.rating}/5). Deadline extended.`,
    meta: {
      candidate_id: task.candidate_id,
      trial_task_id: input.trialTaskId,
      rating: input.rating,
      disposition: "redelivered",
      new_due_at_ms: newDueAtMs,
    },
    createdBy: input.by,
  });
}
