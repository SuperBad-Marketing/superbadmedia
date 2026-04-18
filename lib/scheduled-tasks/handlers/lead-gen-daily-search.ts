/**
 * Scheduled-task handler for `lead_gen_daily_search` — the 3am daily
 * search cron (spec §3.4).
 *
 * Self-perpetuating: after each run, enqueues the next day's run.
 *
 * Kill-switch: `lead_gen_enabled` (checked inside `runDailySearch`;
 * handler also gates at the top for fast exit).
 *
 * Owner: LG-4. Consumer: worker dispatch via HANDLER_REGISTRY.
 */
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { runDailySearch, next3amMelbourneMs } from "@/lib/lead-gen/daily-search";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export const handleLeadGenDailySearch: TaskHandler = async () => {
  if (!killSwitches.lead_gen_enabled) {
    await scheduleNext();
    return;
  }

  await runDailySearch({ trigger: "scheduled" });
  await scheduleNext();
};

async function scheduleNext() {
  const nextRun = next3amMelbourneMs();
  await enqueueTask({
    task_type: "lead_gen_daily_search",
    runAt: nextRun,
    idempotencyKey: `lead_gen_daily_search:${new Date(nextRun).toISOString().slice(0, 10)}`,
  });
}

/**
 * Bootstrap: enqueue the first daily search task. Called once from the
 * Lead Gen setup wizard completion or admin "Run now" button.
 */
export async function ensureLeadGenDailySearchEnqueued(): Promise<void> {
  const nextRun = next3amMelbourneMs();
  await enqueueTask({
    task_type: "lead_gen_daily_search",
    runAt: nextRun,
    idempotencyKey: `lead_gen_daily_search:${new Date(nextRun).toISOString().slice(0, 10)}`,
  });
}

export const LEAD_GEN_DAILY_SEARCH_HANDLERS: HandlerMap = {
  lead_gen_daily_search: handleLeadGenDailySearch,
};
