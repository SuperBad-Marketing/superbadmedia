/**
 * Schedules the 12-email Rundown nurture sequence on assessment completion.
 *
 * Cadence:
 *   Email 1: 3 hours    — Brand Pack + gap observations
 *   Email 2: 48 hours   — First progressive disclosure
 *   Emails 3-12: every 3-4 days — progressive Brand DNA disclosure
 *
 * CTA rhythm:
 *   - Subtle footer on most emails ("book your trial shoot")
 *   - Proper (but understated) CTA reminder every 3rd-4th email
 */

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import type { RundownSequenceTrack } from "@/lib/db/schema/rundown-sequence-emails";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SCHEDULE_OFFSETS_MS = [
  3 * HOUR_MS,       // Email 1: 3 hours
  48 * HOUR_MS,      // Email 2: 48 hours
  5 * DAY_MS,        // Email 3: day 5
  8 * DAY_MS,        // Email 4: day 8
  12 * DAY_MS,       // Email 5: day 12
  15 * DAY_MS,       // Email 6: day 15
  19 * DAY_MS,       // Email 7: day 19
  22 * DAY_MS,       // Email 8: day 22
  26 * DAY_MS,       // Email 9: day 26
  30 * DAY_MS,       // Email 10: day 30
  34 * DAY_MS,       // Email 11: day 34
  38 * DAY_MS,       // Email 12: day 38
] as const;

export const TOTAL_EMAILS = SCHEDULE_OFFSETS_MS.length;

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

  for (let idx = 0; idx < SCHEDULE_OFFSETS_MS.length; idx++) {
    const emailNumber = idx + 1;
    const runAtMs = input.completedAtMs + SCHEDULE_OFFSETS_MS[idx];
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
