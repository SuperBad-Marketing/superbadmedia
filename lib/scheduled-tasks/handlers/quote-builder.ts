import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskType } from "@/lib/db/schema/scheduled-tasks";

/**
 * Quote Builder — scheduled-task handler slots.
 *
 * QB-1 ships stubs only. Real logic lands in QB-6 per
 * `docs/specs/quote-builder.md` §8.3. Every stub registered here is
 * reachable by the worker's dispatch path — throwing `NotImplementedError`
 * from a live handler is the intended behaviour at this stage (the
 * worker catches the throw, records `last_error`, and retries with
 * backoff; failed rows surface in the admin "needs attention" queue).
 *
 * Tasks owned by QB (6):
 *   - quote_expire
 *   - quote_reminder_3d
 *   - manual_invoice_generate
 *   - manual_invoice_send
 *   - subscription_pause_resume_reminder
 *   - subscription_pause_resume
 */
export class NotImplementedError extends Error {
  constructor(taskType: ScheduledTaskType) {
    super(`QB-6: handler not implemented (${taskType})`);
    this.name = "NotImplementedError";
  }
}

function stub(taskType: ScheduledTaskType) {
  return async () => {
    throw new NotImplementedError(taskType);
  };
}

export const QUOTE_BUILDER_HANDLERS: HandlerMap = {
  quote_expire: stub("quote_expire"),
  quote_reminder_3d: stub("quote_reminder_3d"),
  manual_invoice_generate: stub("manual_invoice_generate"),
  manual_invoice_send: stub("manual_invoice_send"),
  subscription_pause_resume_reminder: stub("subscription_pause_resume_reminder"),
  subscription_pause_resume: stub("subscription_pause_resume"),
};

export const QUOTE_BUILDER_TASK_TYPES: readonly ScheduledTaskType[] = [
  "quote_expire",
  "quote_reminder_3d",
  "manual_invoice_generate",
  "manual_invoice_send",
  "subscription_pause_resume_reminder",
  "subscription_pause_resume",
];
