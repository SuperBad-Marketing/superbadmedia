import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";
import { runDiscoveryForAllOpenBriefs } from "@/lib/hiring/discovery/agent";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const CADENCE_MS: Record<string, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  fortnightly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export const handleHiringDiscoveryRun: TaskHandler = async () => {
  if (!killSwitches.hiring_discovery_enabled) {
    await scheduleNext();
    return;
  }

  await runDiscoveryForAllOpenBriefs();
  await scheduleNext();
};

async function scheduleNext() {
  const cadence = await settings.get("hiring.discovery.llm_run_cadence");
  const intervalMs = CADENCE_MS[cadence];
  if (!intervalMs) return;

  const nextRun = Date.now() + intervalMs;
  const dateKey = new Date(nextRun).toISOString().slice(0, 10);
  await enqueueTask({
    task_type: "hiring_discovery_run",
    runAt: nextRun,
    idempotencyKey: `hiring_discovery_run:${dateKey}`,
  });
}

export async function ensureHiringDiscoveryEnqueued(): Promise<void> {
  const cadence = await settings.get("hiring.discovery.llm_run_cadence");
  const intervalMs = CADENCE_MS[cadence];
  if (!intervalMs) return;

  const nextRun = Date.now() + intervalMs;
  const dateKey = new Date(nextRun).toISOString().slice(0, 10);
  await enqueueTask({
    task_type: "hiring_discovery_run",
    runAt: nextRun,
    idempotencyKey: `hiring_discovery_run:${dateKey}`,
  });
}

export const HIRING_DISCOVERY_HANDLERS: HandlerMap = {
  hiring_discovery_run: handleHiringDiscoveryRun,
};
