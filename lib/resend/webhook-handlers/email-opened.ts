/**
 * Handle `email.opened` from Resend.
 *
 * Updates `outreach_sends` engagement columns when the opened email
 * matches a Lead Gen send (by `resend_message_id`). Non-outreach
 * opens are silently skipped.
 *
 * Owner: LG-10. Spec: lead-generation.md §4.3 (engagement signals).
 */

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";

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

  if (!send) {
    return { result: "skipped", error: "not_outreach_send" };
  }

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
