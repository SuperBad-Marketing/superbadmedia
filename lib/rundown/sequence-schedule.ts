/**
 * Schedules the 3-email Rundown nurture sequence on assessment completion.
 * Creates rundown_sequence_emails rows + enqueues scheduled tasks.
 */

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import type { RundownSequenceTrack } from "@/lib/db/schema/rundown-sequence-emails";

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_DAYS = [2, 5, 10] as const;

export interface ScheduleSequenceInput {
  sessionId: string;
  sessionToken: string;
  candidateId: string;
  track: RundownSequenceTrack;
  completedAtMs: number;
}

export async function scheduleRundownSequence(
  input: ScheduleSequenceInput,
): Promise<void> {
  const now = Date.now();

  for (const [idx, dayOffset] of SCHEDULE_DAYS.entries()) {
    const emailNumber = (idx + 1) as 1 | 2 | 3;
    const runAtMs = input.completedAtMs + dayOffset * DAY_MS;
    const emailId = randomUUID();
    const idempotencyKey = `rundown_seq_${input.sessionId}_email_${emailNumber}`;

    const task = await enqueueTask({
      task_type: "rundown_sequence_send",
      runAt: runAtMs,
      payload: {
        emailId,
        sessionId: input.sessionId,
        sessionToken: input.sessionToken,
        candidateId: input.candidateId,
        emailNumber,
        track: input.track,
      },
      idempotencyKey,
    });

    await db.insert(rundown_sequence_emails).values({
      id: emailId,
      session_id: input.sessionId,
      candidate_id: input.candidateId,
      email_number: emailNumber,
      track: input.track,
      scheduled_task_id: task?.id ?? null,
      status: "pending",
      created_at_ms: now,
    });
  }
}
