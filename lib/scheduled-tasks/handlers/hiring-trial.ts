/**
 * Scheduled-task handler for trial task overdue processing.
 *
 * Fires at due_at + grace_days. Sends a reminder to Andy, then
 * auto-archives the candidate after grace + 2 days if no delivery.
 *
 * Spec: hiring-pipeline §9.3.
 * Owner: HP-9.
 */

import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";
import {
  getTrialTaskById,
  getCandidateById,
  updateTrialTask,
} from "@/lib/hiring/queries";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { createCandidateArchive } from "@/lib/hiring/queries";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export const handleHiringTrialTaskOverdue: TaskHandler = async (task) => {
  if (!killSwitches.scheduled_tasks_enabled) return;

  const payload = task.payload as {
    trial_task_id?: string;
    candidate_id?: string;
    is_final?: boolean;
  } | null;

  const trialTaskId = payload?.trial_task_id;
  const candidateId = payload?.candidate_id;
  if (!trialTaskId || !candidateId) return;

  const trialTask = await getTrialTaskById(trialTaskId);
  if (!trialTask) return;

  if (trialTask.delivered_at_ms || trialTask.disposition !== "pending") return;

  const candidate = await getCandidateById(candidateId);
  if (!candidate) return;
  if (candidate.stage !== "trial") return;

  if (payload?.is_final) {
    await createCandidateArchive({
      candidate_id: candidateId,
      stage_when_archived: "trial",
      reason_code: "didnt_deliver",
      reason_free_text: "Trial task not delivered within deadline + grace period.",
      disposition_direction: "we_archived",
    });

    transitionCandidateStage(candidateId, "archived", {
      by: "system:trial-overdue",
      meta: { trial_task_id: trialTaskId, reason: "didnt_deliver" },
    });

    await updateTrialTask(trialTaskId, { disposition: "archived" });

    await logActivity({
      kind: "candidate_archived",
      body: `Auto-archived ${candidate.name}: trial task not delivered.`,
      meta: {
        candidate_id: candidateId,
        trial_task_id: trialTaskId,
        reason: "didnt_deliver",
        auto: true,
      },
    });

    return;
  }

  await logActivity({
    kind: "candidate_trial_sent",
    body: `Trial task overdue for ${candidate.name} — deadline passed + grace period.`,
    meta: {
      candidate_id: candidateId,
      trial_task_id: trialTaskId,
      overdue: true,
    },
  });

  const autoArchiveDelayMs = 2 * 24 * 60 * 60 * 1000;
  await enqueueTask({
    task_type: "hiring_trial_task_overdue",
    runAt: Date.now() + autoArchiveDelayMs,
    payload: {
      trial_task_id: trialTaskId,
      candidate_id: candidateId,
      is_final: true,
    },
    idempotencyKey: `trial-overdue-final-${trialTaskId}`,
  });
};

export const HIRING_TRIAL_HANDLERS: HandlerMap = {
  hiring_trial_task_overdue: handleHiringTrialTaskOverdue,
};
