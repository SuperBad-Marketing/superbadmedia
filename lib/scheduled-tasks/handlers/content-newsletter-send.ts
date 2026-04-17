/**
 * Content Engine — newsletter send handler (spec §4.1, §2.2).
 *
 * Self-perpetuating hourly check: queries `newsletter_sends` rows whose
 * `scheduled_for_ms` has passed and `sent_at_ms` is null, then delivers
 * each to active subscribers via `sendNewsletter()`.
 *
 * Gated by `content_newsletter_enabled` kill switch (separate from
 * `content_automations_enabled` so content generation can run without
 * sending newsletters).
 *
 * Owner: CE-7. Consumer: scheduled-tasks worker.
 */
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import {
  getDueNewsletterSends,
  sendNewsletter,
} from "@/lib/content-engine/newsletter-send";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

/** Check interval: 1 hour in milliseconds. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const TASK_KEY_PREFIX = "content_newsletter_send:";

// ── Handler ─────────────────────────────────────────────────────────

export async function handleContentNewsletterSend(): Promise<void> {
  if (!killSwitches.content_newsletter_enabled) return;

  const nowMs = Date.now();
  const dueSends = await getDueNewsletterSends(nowMs);

  for (const send of dueSends) {
    try {
      const result = await sendNewsletter(send);

      if (!result.ok) {
        await logActivity({
          companyId: send.company_id,
          kind: "content_newsletter_sent",
          body: `Newsletter send skipped: ${result.reason}.`,
          meta: {
            newsletter_send_id: send.id,
            reason: result.reason,
          },
        });
      }
      // Success logging is handled inside sendNewsletter()
    } catch (err) {
      // Log and continue to next send — one failure shouldn't block others
      await logActivity({
        companyId: send.company_id,
        kind: "content_newsletter_sent",
        body: `Newsletter send failed: ${err instanceof Error ? err.message : "unknown error"}.`,
        meta: {
          newsletter_send_id: send.id,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  // Self-perpetuate: enqueue next check
  await ensureNewsletterSendEnqueued(nowMs);
}

// ── Schedule helpers ────────────────────────────────────────────────

/**
 * Idempotently enqueue the next newsletter send check. Called from the
 * handler (self-perpetuation) and intended to be called once during
 * Content Engine setup wizard completion as the initial bootstrap.
 *
 * Initial bootstrap uses a 5-minute delay so the fan-out pipeline
 * has time to create newsletter_sends rows first.
 */
export async function ensureNewsletterSendEnqueued(
  nowMs: number = Date.now(),
  initialDelayMs: number = CHECK_INTERVAL_MS,
): Promise<void> {
  const runAtMs = nowMs + initialDelayMs;
  await enqueueTask({
    task_type: "content_newsletter_send",
    runAt: runAtMs,
    idempotencyKey: `${TASK_KEY_PREFIX}${runAtMs}`,
  });
}

// ── Registry wiring ─────────────────────────────────────────────────

export const CONTENT_NEWSLETTER_SEND_HANDLERS: HandlerMap = {
  content_newsletter_send: handleContentNewsletterSend,
};
