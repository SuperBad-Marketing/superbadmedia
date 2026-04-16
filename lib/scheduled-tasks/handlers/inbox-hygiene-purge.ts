/**
 * Inbox hygiene purge — daily sweep at 23:00 Melbourne (spec §9.3, Q12).
 *
 * Two passes on every fire:
 *  1. Soft-delete pass — messages whose `keep_until_ms` has elapsed, the
 *     thread has no keep-override, the message has no engagement signal,
 *     and it isn't already deleted. Sets `deleted_at_ms = now`.
 *  2. Hard-delete pass — messages soft-deleted more than
 *     TRASH_RETENTION_DAYS ago. Physical row delete.
 *
 * Logs an `inbox_hygiene_purged` activity-log row with counts by
 * category. Self-perpetuates by re-enqueuing itself for the next 23:00
 * Melbourne slot.
 *
 * Gated by `inbox_sync_enabled`. When off, the handler is a no-op and
 * does NOT re-enqueue — the bootstrap helper below is the entry point
 * when the kill switch flips back on.
 */
import { and, eq, isNull, isNotNull, lt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { recomputeThreadKeepUntil } from "@/lib/graph/signal-noise";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

const TRASH_RETENTION_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const INBOX_HYGIENE_TASK_KEY_PREFIX = "inbox_hygiene_purge:";

// ── Handler ──────────────────────────────────────────────────────────

export async function handleInboxHygienePurge(): Promise<void> {
  if (!killSwitches.inbox_sync_enabled) return;

  const nowMs = Date.now();

  const softDeleted = await runSoftDeletePass(nowMs);
  const hardDeleted = await runHardDeletePass(nowMs);

  if (softDeleted.total > 0 || hardDeleted > 0) {
    await logActivity({
      companyId: null,
      contactId: null,
      kind: "inbox_hygiene_purged",
      body: `Hygiene sweep: soft-deleted ${softDeleted.total} (signal ${softDeleted.signal}, noise ${softDeleted.noise}, spam ${softDeleted.spam}); hard-deleted ${hardDeleted} past trash retention.`,
      meta: {
        soft_deleted_total: softDeleted.total,
        soft_deleted_noise: softDeleted.noise,
        soft_deleted_spam: softDeleted.spam,
        soft_deleted_signal: softDeleted.signal,
        hard_deleted: hardDeleted,
        swept_at_ms: nowMs,
      },
    });
  }

  // Self-perpetuate: enqueue the next run.
  await ensureInboxHygieneEnqueued(nowMs);
}

interface SoftDeleteCounts {
  total: number;
  signal: number;
  noise: number;
  spam: number;
}

async function runSoftDeletePass(nowMs: number): Promise<SoftDeleteCounts> {
  // Pull candidate messages: live, keep_until has passed, not engaged.
  // Thread / contact overrides are checked in-pass (cheaper than a
  // multi-join in SQLite, and keeps the override logic in one place).
  const candidates = await db
    .select({
      id: messages.id,
      thread_id: messages.thread_id,
      priority_class: messages.priority_class,
    })
    .from(messages)
    .where(
      and(
        isNotNull(messages.keep_until_ms),
        lt(messages.keep_until_ms, nowMs),
        isNull(messages.deleted_at_ms),
        eq(messages.is_engaged, false),
      ),
    );

  if (candidates.length === 0) {
    return { total: 0, signal: 0, noise: 0, spam: 0 };
  }

  // Group by thread to batch the override lookup.
  const byThread = new Map<string, typeof candidates>();
  for (const row of candidates) {
    const bucket = byThread.get(row.thread_id) ?? [];
    bucket.push(row);
    byThread.set(row.thread_id, bucket);
  }

  const threadIds = Array.from(byThread.keys());
  const threadRows = await db
    .select({
      id: threads.id,
      contact_id: threads.contact_id,
      keep_pinned: threads.keep_pinned,
    })
    .from(threads)
    .where(inArray(threads.id, threadIds));

  const contactIds = threadRows
    .map((t) => t.contact_id)
    .filter((id): id is string => id !== null);
  const contactRows =
    contactIds.length > 0
      ? await db
          .select({
            id: contacts.id,
            always_keep_noise: contacts.always_keep_noise,
          })
          .from(contacts)
          .where(inArray(contacts.id, contactIds))
      : [];
  const alwaysKeepByContact = new Map(
    contactRows.map((c) => [c.id, c.always_keep_noise]),
  );

  const deletable: string[] = [];
  const countsByClass: SoftDeleteCounts = {
    total: 0,
    signal: 0,
    noise: 0,
    spam: 0,
  };
  const touchedThreadIds = new Set<string>();

  for (const thread of threadRows) {
    if (thread.keep_pinned) continue;
    const alwaysKeep = thread.contact_id
      ? (alwaysKeepByContact.get(thread.contact_id) ?? false)
      : false;
    if (alwaysKeep) continue;

    const threadCandidates = byThread.get(thread.id) ?? [];
    for (const msg of threadCandidates) {
      deletable.push(msg.id);
      countsByClass.total++;
      if (msg.priority_class === "signal") countsByClass.signal++;
      else if (msg.priority_class === "noise") countsByClass.noise++;
      else if (msg.priority_class === "spam") countsByClass.spam++;
    }
    touchedThreadIds.add(thread.id);
  }

  if (deletable.length === 0) return countsByClass;

  await db
    .update(messages)
    .set({ deleted_at_ms: nowMs, updated_at_ms: nowMs })
    .where(inArray(messages.id, deletable));

  for (const threadId of touchedThreadIds) {
    await recomputeThreadKeepUntil(threadId);
  }

  return countsByClass;
}

async function runHardDeletePass(nowMs: number): Promise<number> {
  const cutoffMs = nowMs - TRASH_RETENTION_DAYS * MS_PER_DAY;

  const expired = await db
    .select({ id: messages.id, thread_id: messages.thread_id })
    .from(messages)
    .where(
      and(
        isNotNull(messages.deleted_at_ms),
        lt(messages.deleted_at_ms, cutoffMs),
      ),
    );

  if (expired.length === 0) return 0;

  const ids = expired.map((r) => r.id);
  await db.delete(messages).where(inArray(messages.id, ids));

  // Hard-deleted rows can't contribute to thread MAX anymore; recompute
  // the affected threads so thread.keep_until_ms reflects live rows only.
  const affectedThreads = Array.from(new Set(expired.map((r) => r.thread_id)));
  for (const threadId of affectedThreads) {
    await recomputeThreadKeepUntil(threadId);
  }

  return expired.length;
}

// ── Schedule helpers ─────────────────────────────────────────────────

/**
 * Compute the next 23:00 Melbourne wall-clock instant as epoch-ms.
 * If the current time is already past today's 23:00 Melbourne, returns
 * tomorrow's. Handles DST transitions correctly because the Melbourne
 * offset is re-derived at the candidate instant.
 */
export function next23MelbourneMs(nowMs: number): number {
  const today = melbourneWallDate(nowMs);
  let candidate = melbourneWallToUtcMs(today.year, today.month, today.day, 23);
  if (candidate <= nowMs) {
    const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
    candidate = melbourneWallToUtcMs(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
      23,
    );
  }
  return candidate;
}

function melbourneWallDate(utcMs: number): { year: number; month: number; day: number } {
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

/**
 * Idempotently enqueue the next hygiene sweep. Called from the handler
 * (self-perpetuation) and intended to be called once during Graph API
 * admin wizard completion as the initial bootstrap. Safe to call more
 * than once — the idempotency key collapses duplicates per run slot.
 */
export async function ensureInboxHygieneEnqueued(
  nowMs: number = Date.now(),
): Promise<void> {
  const runAtMs = next23MelbourneMs(nowMs);
  await enqueueTask({
    task_type: "inbox_hygiene_purge",
    runAt: runAtMs,
    idempotencyKey: `${INBOX_HYGIENE_TASK_KEY_PREFIX}${runAtMs}`,
  });
}

// ── Registry wiring ──────────────────────────────────────────────────

export const INBOX_HYGIENE_HANDLERS: HandlerMap = {
  inbox_hygiene_purge: handleInboxHygienePurge,
};
