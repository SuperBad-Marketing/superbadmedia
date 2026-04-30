import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";

import type { DispatchOutcome, ResendWebhookEvent } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleEmailDeliveredOpts {
  nowMs?: number;
  eventId: string;
  dbArg?: Db;
}

export async function handleEmailDelivered(
  event: ResendWebhookEvent,
  opts: HandleEmailDeliveredOpts,
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
    if (!send.delivered_at) {
      await database
        .update(outreachSends)
        .set({ delivered_at: new Date(nowMs) })
        .where(eq(outreachSends.id, send.id));
    }
    return { result: "ok" };
  }

  return { result: "skipped", error: "no_matching_send" };
}
