import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { sendWeeklyDigestEmail } from "@/lib/observatory/weekly-digest-email";

const handleWeeklyDigestSend: TaskHandler = async (_task) => {
  await sendWeeklyDigestEmail();
};

export const WEEKLY_DIGEST_SEND_HANDLERS: HandlerMap = {
  weekly_digest_send: handleWeeklyDigestSend,
};
