/**
 * Handle `email.clicked` from Resend.
 *
 * Updates engagement columns when the clicked email matches either a
 * Lead Gen outreach send or a Rundown nurture sequence email (by
 * `resend_message_id`).
 */

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";

import type { DispatchOutcome, ResendWebhookEvent } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleEmailClickedOpts {
  nowMs?: number;
  eventId: string;
  dbArg?: Db;
}

export async function handleEmailClicked(
  event: ResendWebhookEvent,
  opts: HandleEmailClickedOpts,
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
    const isFirstClick = send.first_clicked_at == null;
    await database
      .update(outreachSends)
      .set({
        first_clicked_at: isFirstClick ? new Date(nowMs) : send.first_clicked_at,
        click_count: send.click_count + 1,
      })
      .where(eq(outreachSends.id, send.id));
    return { result: "ok" };
  }

  const [seqEmail] = await database
    .select({
      id: rundown_sequence_emails.id,
      clicked_at_ms: rundown_sequence_emails.clicked_at_ms,
      clicked_links: rundown_sequence_emails.clicked_links,
    })
    .from(rundown_sequence_emails)
    .where(eq(rundown_sequence_emails.resend_message_id, messageId))
    .limit(1);

  if (seqEmail) {
    const clickedUrl = event.data?.click?.url;
    const existingLinks = (seqEmail.clicked_links ?? []) as string[];
    const updatedLinks = clickedUrl && !existingLinks.includes(clickedUrl)
      ? [...existingLinks, clickedUrl]
      : existingLinks;

    await database
      .update(rundown_sequence_emails)
      .set({
        clicked_at_ms: seqEmail.clicked_at_ms ?? nowMs,
        clicked_links: updatedLinks,
      })
      .where(eq(rundown_sequence_emails.id, seqEmail.id));
    return { result: "ok" };
  }

  return { result: "skipped", error: "no_matching_send" };
}
