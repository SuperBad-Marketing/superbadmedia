import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { logActivity } from "@/lib/activity-log";

const handleHiringInviteFollowupCheck: TaskHandler = async (task) => {
  const payload = task.payload as { candidate_id?: string } | null;
  const candidateId = payload?.candidate_id;
  if (!candidateId) return;

  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, candidateId),
  });
  if (!candidate) return;
  if (candidate.stage !== "applied") return;
  if (candidate.followup_status !== "pending") return;

  await db
    .update(candidates)
    .set({
      followup_status: "no_reply",
      updated_at_ms: Date.now(),
    })
    .where(eq(candidates.id, candidateId))
    .run();

  await logActivity({
    kind: "candidate_followup_received",
    body: `Follow-up question timed out — no reply from ${candidate.name}.`,
    meta: {
      candidate_id: candidateId,
      followup_status: "no_reply",
      timeout: true,
    },
  });
};

export const HIRING_FOLLOWUP_CHECK_HANDLERS: HandlerMap = {
  hiring_invite_followup_check: handleHiringInviteFollowupCheck,
};
