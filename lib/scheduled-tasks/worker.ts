import { and, eq, lte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { killSwitches } from "@/lib/kill-switches";
import {
  scheduled_tasks,
  worker_heartbeats,
  type ScheduledTaskRow,
  type ScheduledTaskType,
} from "@/lib/db/schema/scheduled-tasks";

export type TaskHandler = (task: ScheduledTaskRow) => Promise<void>;
export type HandlerMap = Partial<Record<ScheduledTaskType, TaskHandler>>;

const WORKER_NAME = "scheduled-tasks";
const STALE_RUNNING_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5 * 60 * 1000;
const BATCH_SIZE = 50;

/**
 * Single tick of the scheduled-tasks worker.
 *
 * Flow per spec (`docs/specs/quote-builder.md` §8.2):
 *   1. Reclaim any row stuck in `running` longer than 15 min (worker died).
 *   2. Pull up to BATCH_SIZE rows where status=pending and run_at <= now.
 *   3. Mark each as running, dispatch via handler map.
 *   4. Success → status=done, done_at=now.
 *   5. Failure → attempts++, exponential backoff (5 min × 6^attempts).
 *   6. attempts >= 3 → status=failed.
 *   7. Write heartbeat.
 *
 * Gated on `killSwitches.scheduled_tasks_enabled` — if off, the tick
 * writes a heartbeat (so the admin banner knows the worker loop is
 * alive) but processes zero tasks.
 */
export async function tick(handlers: HandlerMap): Promise<number> {
  const now = Date.now();

  if (!killSwitches.scheduled_tasks_enabled) {
    await writeHeartbeat(now, 0);
    return 0;
  }

  await reclaimStale(now);

  const due = await db
    .select()
    .from(scheduled_tasks)
    .where(
      and(
        eq(scheduled_tasks.status, "pending"),
        lte(scheduled_tasks.run_at_ms, now),
      ),
    )
    .limit(BATCH_SIZE);

  let processed = 0;
  for (const task of due) {
    const claimed = await claim(task.id);
    if (!claimed) continue;
    const handler = handlers[task.task_type];
    if (!handler) {
      await markFailed(task, new Error(`no handler for ${task.task_type}`));
      processed++;
      continue;
    }
    try {
      await handler(claimed);
      await markDone(claimed.id);
    } catch (err) {
      await handleFailure(claimed, err);
    }
    processed++;
  }

  await writeHeartbeat(now, processed);
  return processed;
}

async function reclaimStale(now: number): Promise<void> {
  const threshold = now - STALE_RUNNING_MS;
  await db
    .update(scheduled_tasks)
    .set({ status: "pending", reclaimed_at_ms: now })
    .where(
      and(
        eq(scheduled_tasks.status, "running"),
        lt(scheduled_tasks.last_attempted_at_ms, threshold),
      ),
    );
}

async function claim(id: string): Promise<ScheduledTaskRow | null> {
  const now = Date.now();
  const result = await db
    .update(scheduled_tasks)
    .set({ status: "running", last_attempted_at_ms: now })
    .where(
      and(eq(scheduled_tasks.id, id), eq(scheduled_tasks.status, "pending")),
    )
    .returning();
  return result[0] ?? null;
}

async function markDone(id: string): Promise<void> {
  await db
    .update(scheduled_tasks)
    .set({ status: "done", done_at_ms: Date.now(), last_error: null })
    .where(eq(scheduled_tasks.id, id));
}

async function handleFailure(
  task: ScheduledTaskRow,
  err: unknown,
): Promise<void> {
  const attempts = (task.attempts ?? 0) + 1;
  const message = err instanceof Error ? err.message : String(err);
  if (attempts >= MAX_ATTEMPTS) {
    await markFailed(task, err);
    return;
  }
  const backoff = BASE_BACKOFF_MS * Math.pow(6, attempts);
  await db
    .update(scheduled_tasks)
    .set({
      status: "pending",
      attempts,
      last_error: message,
      run_at_ms: Date.now() + backoff,
    })
    .where(eq(scheduled_tasks.id, task.id));
}

async function markFailed(task: ScheduledTaskRow, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await db
    .update(scheduled_tasks)
    .set({
      status: "failed",
      attempts: (task.attempts ?? 0) + 1,
      last_error: message,
    })
    .where(eq(scheduled_tasks.id, task.id));
}

async function writeHeartbeat(now: number, processed: number): Promise<void> {
  await db
    .insert(worker_heartbeats)
    .values({
      worker_name: WORKER_NAME,
      last_tick_at_ms: now,
      last_tick_tasks_processed: processed,
    })
    .onConflictDoUpdate({
      target: worker_heartbeats.worker_name,
      set: {
        last_tick_at_ms: now,
        last_tick_tasks_processed: processed,
      },
    });
}

export interface StartWorkerOptions {
  handlers: HandlerMap;
  intervalMs?: number;
}

/**
 * Start the polling loop. Returns a stop fn. Intended to be called from
 * the Next.js instrumentation hook on server boot.
 */
export function startWorker(options: StartWorkerOptions): () => void {
  const interval = options.intervalMs ?? 60_000;
  const id = setInterval(() => {
    tick(options.handlers).catch((err) => {
      // Swallow to keep the loop alive; each tick self-logs via heartbeat.
      console.error("[scheduled-tasks] tick failed", err);
    });
  }, interval);
  return () => clearInterval(id);
}
