/**
 * Scheduled-task handlers for Lead Gen sequence engine:
 *   - `sequence_scheduler` — runs the sequence engine to process due follow-ups
 *   - `engagement_tier_evaluator` — classifies engagement tiers after cooloff
 *   - `auto_send_execute` — executes a delayed auto-send for graduated tracks
 *
 * Kill-switch: `outreach_send_enabled` (checked inside the engine functions).
 *
 * Owner: LG-9. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { runSequenceScheduler, executeSend } from "@/lib/lead-gen/sequence-engine";
import { evaluateEngagementTiers } from "@/lib/lead-gen/engagement-evaluator";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const SEQUENCE_RUN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const ENGAGEMENT_EVAL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export const handleSequenceScheduler: TaskHandler = async () => {
  if (!killSwitches.outreach_send_enabled) {
    await scheduleNextSequenceRun();
    return;
  }

  await runSequenceScheduler();
  await scheduleNextSequenceRun();
};

export const handleEngagementTierEvaluator: TaskHandler = async () => {
  if (!killSwitches.outreach_send_enabled) {
    await scheduleNextEngagementEval();
    return;
  }

  await evaluateEngagementTiers();
  await scheduleNextEngagementEval();
};

export const handleAutoSendExecute: TaskHandler = async (task) => {
  if (!killSwitches.outreach_send_enabled) return;

  const p = task.payload as {
    draft_id: string;
    sequence_id: string;
    candidate_id: string;
    autonomy_mode: "probation" | "auto_send";
  } | null;

  if (!p?.draft_id || !p?.sequence_id || !p?.candidate_id) return;

  await executeSend(
    p.draft_id,
    p.sequence_id,
    p.candidate_id,
    p.autonomy_mode ?? "auto_send",
  );
};

async function scheduleNextSequenceRun() {
  const nextRun = Date.now() + SEQUENCE_RUN_INTERVAL_MS;
  await enqueueTask({
    task_type: "sequence_scheduler",
    runAt: nextRun,
    idempotencyKey: `sequence_scheduler:${Math.floor(nextRun / SEQUENCE_RUN_INTERVAL_MS)}`,
  });
}

async function scheduleNextEngagementEval() {
  const nextRun = Date.now() + ENGAGEMENT_EVAL_INTERVAL_MS;
  await enqueueTask({
    task_type: "engagement_tier_evaluator",
    runAt: nextRun,
    idempotencyKey: `engagement_tier_evaluator:${Math.floor(nextRun / ENGAGEMENT_EVAL_INTERVAL_MS)}`,
  });
}

export const LEAD_GEN_SEQUENCE_HANDLERS: HandlerMap = {
  sequence_scheduler: handleSequenceScheduler,
  engagement_tier_evaluator: handleEngagementTierEvaluator,
  auto_send_execute: handleAutoSendExecute,
};
