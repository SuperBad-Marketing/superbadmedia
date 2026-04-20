import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import {
  buildTaskDigestContent,
  sendTaskDigestEmail,
  hasAdminSignedInToday,
} from "@/lib/tasks/digest";
import { nextMelbourneHourMs } from "@/lib/time/melbourne";
import settingsRegistry from "@/lib/settings";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

export const TASK_DIGEST_TASK_KEY_PREFIX = "task_morning_digest:";

// ── Handler ─────────────────────────────────────────────────────────

export async function handleTaskMorningDigest(): Promise<void> {
  if (!killSwitches.tasks_digest_enabled) return;

  const enabled = await settingsRegistry.get("tasks.morning_digest_enabled");
  if (!enabled) return;

  const nowMs = Date.now();

  const signedIn = await hasAdminSignedInToday(nowMs);
  if (signedIn) {
    await ensureTaskDigestEnqueued(nowMs);
    return;
  }

  const content = await buildTaskDigestContent(nowMs);

  if (content) {
    const result = await sendTaskDigestEmail(content);

    if (result.sent) {
      await logActivity({
        companyId: null,
        contactId: null,
        kind: "task_digest_sent",
        body: `Task digest sent — ${content.overdue.length} overdue, ${content.dueToday.length} due today, ${content.approvalOutcomes.length} approval outcome${content.approvalOutcomes.length === 1 ? "" : "s"}.`,
        meta: {
          overdue_count: content.overdue.length,
          due_today_count: content.dueToday.length,
          approval_outcomes_count: content.approvalOutcomes.length,
        },
      });
    }
  }

  await ensureTaskDigestEnqueued(nowMs);
}

// ── Schedule helpers ────────────────────────────────────────────────

function parseDigestHour(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 8;
  return Number(match[1]);
}

async function nextTaskDigestMs(nowMs: number): Promise<number> {
  const timeStr = await settingsRegistry.get("tasks.morning_digest_time");
  const hour = parseDigestHour(timeStr);
  return nextMelbourneHourMs(nowMs, hour);
}

export async function ensureTaskDigestEnqueued(
  nowMs: number = Date.now(),
): Promise<void> {
  const runAtMs = await nextTaskDigestMs(nowMs);
  await enqueueTask({
    task_type: "task_morning_digest",
    runAt: runAtMs,
    idempotencyKey: `${TASK_DIGEST_TASK_KEY_PREFIX}${runAtMs}`,
  });
}

// ── Registry wiring ─────────────────────────────────────────────────

export const TASK_DIGEST_HANDLERS: HandlerMap = {
  task_morning_digest: handleTaskMorningDigest,
};
