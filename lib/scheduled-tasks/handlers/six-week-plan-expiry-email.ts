import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { runExpiryEmailSweep } from "@/lib/six-week-plan/expiry";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

async function scheduleNext() {
  const tomorrow = new Date();
  tomorrow.setUTCHours(21, 0, 0, 0); // ~07:00 AEST next day
  if (tomorrow.getTime() <= Date.now()) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  await enqueueTask({
    task_type: "six_week_plan_expiry_email",
    runAt: tomorrow,
    idempotencyKey: `six_week_plan_expiry_email:${tomorrow.toISOString().slice(0, 10)}`,
  });
}

export const SIX_WEEK_PLAN_EXPIRY_EMAIL_HANDLERS: HandlerMap = {
  six_week_plan_expiry_email: async () => {
    if (!killSwitches.plan_automations_enabled) {
      await scheduleNext();
      return;
    }
    await runExpiryEmailSweep();
    await scheduleNext();
  },
};
