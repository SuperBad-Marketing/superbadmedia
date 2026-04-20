import { killSwitches } from "@/lib/kill-switches";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { sendInviteDraft } from "@/lib/hiring/send-invite";

type TaskHandler = (task: ScheduledTaskRow) => Promise<void>;
type HandlerMap = Record<string, TaskHandler>;

const handleHiringInviteSend: TaskHandler = async (task) => {
  if (!killSwitches.outreach_send_enabled) return;

  const payload = task.payload as { draft_id?: string } | null;
  if (!payload?.draft_id) {
    throw new Error("hiring_invite_send: missing draft_id in payload");
  }

  const result = await sendInviteDraft(payload.draft_id, "system:invite_task");
  if (!result.sent && result.reason) {
    throw new Error(`hiring_invite_send: ${result.reason}`);
  }
};

export const HIRING_INVITE_HANDLERS: HandlerMap = {
  hiring_invite_send: handleHiringInviteSend,
};
