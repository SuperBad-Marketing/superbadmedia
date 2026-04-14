/**
 * Enqueue helpers for wizard nudge / expiry / expire tasks.
 *
 * Call `scheduleWizardNudges(row)` whenever a `wizard_progress` row is
 * created OR its `last_active_at_ms` advances. The resume-nudge task
 * carries the scheduling `last_active_at_ms` in its payload; stale
 * nudges fire and no-op (see `handlers.ts`).
 *
 * Call `cancelWizardNudges(progressId)` on completion or abandonment
 * to release pending rows.
 *
 * Owner: SW-8. Consumers: the `wizard_progress` write path (SW-1
 * runtime, when it lands) + the completion orchestrator in
 * `app/lite/setup/critical-flight/[key]/actions-*.ts`.
 */

import { and, eq, or, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import type { WizardProgressRow } from "@/lib/db/schema/wizard-progress";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";

/**
 * Enqueue the three lifecycle tasks for an in-flight `wizard_progress` row.
 * Idempotent per `(task_type, progressId, activityMoment)`:
 *   - resume-nudge: tied to current `last_active_at_ms` — re-invoke after
 *     each activity update, older tasks fire and no-op.
 *   - expiry-warn + expire: tied to the row lifetime, enqueued once.
 */
export async function scheduleWizardNudges(
  row: Pick<
    WizardProgressRow,
    "id" | "last_active_at_ms" | "expires_at_ms"
  >,
): Promise<void> {
  const resumeNudgeHours = await settings.get("wizards.resume_nudge_hours");
  const nudgeFireAt = row.last_active_at_ms + resumeNudgeHours * 60 * 60 * 1000;

  await enqueueTask({
    task_type: "wizard_resume_nudge",
    runAt: nudgeFireAt,
    payload: {
      progressId: row.id,
      scheduledForLastActiveAtMs: row.last_active_at_ms,
    },
    idempotencyKey: `wizard_resume_nudge:${row.id}:${row.last_active_at_ms}`,
  });

  const warnFireAt = row.expires_at_ms - 24 * 60 * 60 * 1000;
  await enqueueTask({
    task_type: "wizard_expiry_warn",
    runAt: warnFireAt,
    payload: { progressId: row.id },
    idempotencyKey: `wizard_expiry_warn:${row.id}`,
  });

  await enqueueTask({
    task_type: "wizard_expire",
    runAt: row.expires_at_ms,
    payload: { progressId: row.id },
    idempotencyKey: `wizard_expire:${row.id}`,
  });
}

/**
 * Delete any still-pending lifecycle tasks for the given progress row.
 * Called on completion (`wizard_completed`) or manual abandonment.
 * Matches by idempotency_key prefix (which encodes progressId).
 */
export async function cancelWizardNudges(progressId: string): Promise<void> {
  await db
    .delete(scheduled_tasks)
    .where(
      and(
        eq(scheduled_tasks.status, "pending"),
        or(
          like(scheduled_tasks.idempotency_key, `wizard_resume_nudge:${progressId}:%`),
          eq(scheduled_tasks.idempotency_key, `wizard_expiry_warn:${progressId}`),
          eq(scheduled_tasks.idempotency_key, `wizard_expire:${progressId}`),
        ),
      ),
    );
}
