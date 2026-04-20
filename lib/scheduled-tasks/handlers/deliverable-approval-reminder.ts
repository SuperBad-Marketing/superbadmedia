import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { handleApprovalReminder } from "@/lib/tasks/approve";

export const DELIVERABLE_APPROVAL_REMINDER_HANDLERS: HandlerMap = {
  deliverable_approval_reminder: async (task: ScheduledTaskRow) => {
    const payload = task.payload as { taskId: string; contactId: string } | null;
    if (!payload?.taskId || !payload?.contactId) {
      throw new Error("Missing taskId or contactId in payload");
    }
    await handleApprovalReminder(payload);
  },
};
