/**
 * Outreach-specific engagement signal processing for Resend webhooks.
 *
 * Called AFTER the CRM-level bounce/complaint handlers. Updates
 * `outreach_sends` columns and fires autonomy circuit breaker events.
 *
 * Owner: LG-10. Closes lg_8_circuit_breaker_webhook_wiring and
 * lg_9_circuit_breaker_from_webhooks patches.
 */

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { logActivity } from "@/lib/activity-log";
import { transitionAutonomyState } from "@/lib/lead-gen/autonomy";
type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

/**
 * Process a bounce event against outreach_sends. Called from the
 * dispatcher after the CRM-level handleEmailBounced runs.
 */
export async function processOutreachBounce(
  resendMessageId: string,
  bounceKind: "hard" | "soft",
  opts: { nowMs?: number; dbArg?: Db } = {},
): Promise<void> {
  const nowMs = opts.nowMs ?? Date.now();
  const database = (opts.dbArg ?? defaultDb) as Db;

  const [send] = await database
    .select()
    .from(outreachSends)
    .where(eq(outreachSends.resend_message_id, resendMessageId))
    .limit(1);

  if (!send) return;

  await database
    .update(outreachSends)
    .set({
      bounced_at: new Date(nowMs),
      bounce_kind: bounceKind,
    })
    .where(eq(outreachSends.id, send.id));

  if (bounceKind === "hard") {
    // Stop the sequence
    await database
      .update(outreachSequences)
      .set({
        status: "stopped_bounce",
        stopped_reason: "hard_bounce_webhook",
      })
      .where(eq(outreachSequences.id, send.sequence_id));

    // Fire circuit breaker
    const [seq] = await database
      .select({ track: outreachSequences.track })
      .from(outreachSequences)
      .where(eq(outreachSequences.id, send.sequence_id))
      .limit(1);

    if (seq) {
      await transitionAutonomyState(seq.track as "saas" | "retainer", {
        type: "hard_bounce",
        sendId: send.id,
      });
    }

    await logActivity({
      kind: "outreach_bounced",
      dealId: send.deal_id,
      body: `Hard bounce on outreach send ${send.id}`,
      createdBy: "system:resend_webhook",
      meta: { send_id: send.id, sequence_id: send.sequence_id, bounce_kind: bounceKind },
    });
  }
}

/**
 * Process a complaint event against outreach_sends. Called from the
 * dispatcher after the CRM-level handleEmailComplained runs.
 */
export async function processOutreachComplaint(
  resendMessageId: string,
  opts: { nowMs?: number; dbArg?: Db } = {},
): Promise<void> {
  const nowMs = opts.nowMs ?? Date.now();
  const database = (opts.dbArg ?? defaultDb) as Db;

  const [send] = await database
    .select()
    .from(outreachSends)
    .where(eq(outreachSends.resend_message_id, resendMessageId))
    .limit(1);

  if (!send) return;

  await database
    .update(outreachSends)
    .set({
      bounced_at: new Date(nowMs),
      bounce_kind: "complaint",
    })
    .where(eq(outreachSends.id, send.id));

  // Stop the sequence
  await database
    .update(outreachSequences)
    .set({
      status: "stopped_unsubscribe",
      stopped_reason: "spam_complaint_webhook",
    })
    .where(eq(outreachSequences.id, send.sequence_id));

  // Fire circuit breaker
  const [seq] = await database
    .select({ track: outreachSequences.track })
    .from(outreachSequences)
    .where(eq(outreachSequences.id, send.sequence_id))
    .limit(1);

  if (seq) {
    await transitionAutonomyState(seq.track as "saas" | "retainer", {
      type: "spam_complaint",
      sendId: send.id,
    });
  }

  await logActivity({
    kind: "outreach_unsubscribed",
    dealId: send.deal_id,
    body: `Spam complaint on outreach send ${send.id}`,
    createdBy: "system:resend_webhook",
    meta: { send_id: send.id, sequence_id: send.sequence_id },
  });
}

