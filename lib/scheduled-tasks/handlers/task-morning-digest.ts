import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import {
  buildTaskDigestContent,
  sendTaskDigestEmail,
  hasAdminSignedInToday,
  melbourneStartAndEndOfDay,
} from "@/lib/tasks/digest";
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

function melbourneWallDate(utcMs: number): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function melbourneWallToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
): number {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  const offsetMs = melbourneOffsetMsAt(naiveUtc);
  return naiveUtc - offsetMs;
}

function melbourneOffsetMsAt(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const melbAsIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === "24" ? "00" : map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return melbAsIfUtc - utcMs;
}

function parseDigestHour(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 8;
  return Number(match[1]);
}

async function nextTaskDigestMs(nowMs: number): Promise<number> {
  const timeStr = await settingsRegistry.get("tasks.morning_digest_time");
  const hour = parseDigestHour(timeStr);
  const today = melbourneWallDate(nowMs);
  let candidate = melbourneWallToUtcMs(today.year, today.month, today.day, hour);
  if (candidate <= nowMs) {
    const tomorrow = new Date(
      Date.UTC(today.year, today.month - 1, today.day + 1),
    );
    candidate = melbourneWallToUtcMs(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
      hour,
    );
  }
  return candidate;
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
