/**
 * Handle `email.opened` from Resend.
 *
 * Updates engagement columns when the opened email matches either a
 * Lead Gen outreach send or a Rundown nurture sequence email (by
 * `resend_message_id`).
 */

import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";

import type { DispatchOutcome, ResendWebhookEvent } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleEmailOpenedOpts {
  nowMs?: number;
  eventId: string;
  dbArg?: Db;
}

export async function handleEmailOpened(
  event: ResendWebhookEvent,
  opts: HandleEmailOpenedOpts,
): Promise<DispatchOutcome> {
  const nowMs = opts.nowMs ?? Date.now();
  const database = (opts.dbArg ?? defaultDb) as Db;

  const messageId = event.data?.email_id;
  if (!messageId) {
    return { result: "skipped", error: "missing_email_id" };
  }

  const [send] = await database
    .select()
    .from(outreachSends)
    .where(eq(outreachSends.resend_message_id, messageId))
    .limit(1);

  if (send) {
    const isFirstOpen = send.first_opened_at == null;
    await database
      .update(outreachSends)
      .set({
        first_opened_at: isFirstOpen ? new Date(nowMs) : send.first_opened_at,
        open_count: send.open_count + 1,
      })
      .where(eq(outreachSends.id, send.id));
    return { result: "ok" };
  }

  const [seqEmail] = await database
    .select({ id: rundown_sequence_emails.id, opened_at_ms: rundown_sequence_emails.opened_at_ms })
    .from(rundown_sequence_emails)
    .where(eq(rundown_sequence_emails.resend_message_id, messageId))
    .limit(1);

  if (seqEmail) {
    await database
      .update(rundown_sequence_emails)
      .set({
        opened_at_ms: seqEmail.opened_at_ms ?? nowMs,
        open_count: sql`${rundown_sequence_emails.open_count} + 1`,
      })
      .where(eq(rundown_sequence_emails.id, seqEmail.id));
    return { result: "ok" };
  }

  return { result: "skipped", error: "no_matching_send" };
}
