/**
 * Inbox morning digest handler — fires at 08:00 Melbourne daily.
 *
 * Reads silent notifications from the last N hours, builds a voice-treated
 * email, sends via Resend, and self-perpetuates by enqueuing the next
 * day's run. Gated by `inbox_digest_enabled`.
 *
 * Follows the same DST-safe scheduling pattern as the hygiene purge
 * handler (`next23MelbourneMs` → `next8amMelbourneMs`).
 *
 * Spec: unified-inbox.md §10.3.
 * Owner: UI-13.
 */
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { buildDigestContent, sendDigestEmail } from "@/lib/graph/digest";
import settingsRegistry from "@/lib/settings";
import { nextMelbourneHourMs } from "@/lib/time/melbourne";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

export const INBOX_DIGEST_TASK_KEY_PREFIX = "inbox_morning_digest:";

// ── Handler ─────────────────────────────────────────────────────────

export async function handleInboxMorningDigest(): Promise<void> {
  if (!killSwitches.inbox_digest_enabled) return;

  const nowMs = Date.now();

  const content = await buildDigestContent(nowMs);

  if (content) {
    const result = await sendDigestEmail(content);

    if (result.sent) {
      await logActivity({
        companyId: null,
        contactId: null,
        kind: "inbox_digest_sent",
        body: `Morning digest sent — ${content.totalSilenced} silenced message${content.totalSilenced === 1 ? "" : "s"} across ${content.groups.length} categor${content.groups.length === 1 ? "y" : "ies"}.`,
        meta: {
          total_silenced: content.totalSilenced,
          groups: content.groups.map((g) => ({
            category: g.category,
            count: g.count,
          })),
          has_import_note: !!content.importNote,
        },
      });
    }
  }

  // Self-perpetuate: enqueue the next run
  await ensureInboxDigestEnqueued(nowMs);
}

// ── Schedule helpers ────────────────────────────────────────────────

export async function next8amMelbourneMs(nowMs: number): Promise<number> {
  const hour = await settingsRegistry.get("inbox.digest_hour");
  return nextMelbourneHourMs(nowMs, hour);
}

/**
 * Idempotently enqueue the next morning digest. Called from the handler
 * (self-perpetuation) and intended to be called once during Graph API
 * admin wizard completion as the initial bootstrap.
 */
export async function ensureInboxDigestEnqueued(
  nowMs: number = Date.now(),
): Promise<void> {
  const runAtMs = await next8amMelbourneMs(nowMs);
  await enqueueTask({
    task_type: "inbox_morning_digest",
    runAt: runAtMs,
    idempotencyKey: `${INBOX_DIGEST_TASK_KEY_PREFIX}${runAtMs}`,
  });
}

// ── Registry wiring ─────────────────────────────────────────────────

export const INBOX_DIGEST_HANDLERS: HandlerMap = {
  inbox_morning_digest: handleInboxMorningDigest,
};
