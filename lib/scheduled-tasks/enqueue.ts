import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  scheduled_tasks,
  type ScheduledTaskRow,
  type ScheduledTaskType,
} from "@/lib/db/schema/scheduled-tasks";

export interface EnqueueTaskInput {
  task_type: ScheduledTaskType;
  runAt: Date | number;
  payload?: Record<string, unknown> | null;
  idempotencyKey?: string;
}

/**
 * Enqueue a row into `scheduled_tasks`. Safe to call multiple times with
 * the same `idempotencyKey` — duplicates are silently ignored.
 *
 * Does **not** check `killSwitches.scheduled_tasks_enabled` — enqueuing
 * is always allowed; only the worker dispatch path is gated.
 */
export async function enqueueTask(
  input: EnqueueTaskInput,
): Promise<ScheduledTaskRow | null> {
  const runAtMs =
    typeof input.runAt === "number" ? input.runAt : input.runAt.getTime();
  const row = {
    id: randomUUID(),
    task_type: input.task_type,
    run_at_ms: runAtMs,
    payload: input.payload ?? null,
    status: "pending" as const,
    attempts: 0,
    idempotency_key: input.idempotencyKey ?? null,
    created_at_ms: Date.now(),
  };
  const inserted = await db
    .insert(scheduled_tasks)
    .values(row)
    .onConflictDoNothing({ target: scheduled_tasks.idempotency_key })
    .returning();
  return inserted[0] ?? null;
}
