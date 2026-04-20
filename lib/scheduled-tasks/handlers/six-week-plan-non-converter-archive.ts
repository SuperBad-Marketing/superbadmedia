import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { runPortalArchiveSweep } from "@/lib/six-week-plan/expiry";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

async function scheduleNext() {
  const tomorrow = new Date();
  tomorrow.setUTCHours(21, 30, 0, 0); // ~07:30 AEST next day, offset from expiry email
  if (tomorrow.getTime() <= Date.now()) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  await enqueueTask({
    task_type: "six_week_plan_non_converter_expiry",
    runAt: tomorrow,
    idempotencyKey: `six_week_plan_non_converter_expiry:${tomorrow.toISOString().slice(0, 10)}`,
  });
}

export const SIX_WEEK_PLAN_NON_CONVERTER_ARCHIVE_HANDLERS: HandlerMap = {
  six_week_plan_non_converter_expiry: async () => {
    if (!killSwitches.plan_automations_enabled) {
      await scheduleNext();
      return;
    }
    await runPortalArchiveSweep();
    await scheduleNext();
  },
};
