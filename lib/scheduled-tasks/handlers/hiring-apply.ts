/**
 * Scheduled-task handler for the apply-form follow-up question.
 *
 * Fires ~2 min after application submission. Ingests portfolio,
 * generates a tailored LLM follow-up question, and sends it via email.
 *
 * Spec: hiring-pipeline §7.2.
 * Owner: HP-7.
 */

import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { generateAndSendFollowup } from "@/lib/hiring/apply";

export const handleHiringApplyFollowupSend: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const payload = task.payload as { candidate_id?: string } | null;
  const candidateId = payload?.candidate_id;
  if (!candidateId) return;

  await generateAndSendFollowup(candidateId);
};

export const HIRING_APPLY_HANDLERS: HandlerMap = {
  hiring_apply_followup_send: handleHiringApplyFollowupSend,
};
