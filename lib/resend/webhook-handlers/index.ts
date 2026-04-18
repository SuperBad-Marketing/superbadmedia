import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import settings from "@/lib/settings";
import { handleEmailBounced } from "./email-bounced";
import { handleEmailComplained } from "./email-complained";
import { handleEmailOpened } from "./email-opened";
import { handleEmailClicked } from "./email-clicked";
import {
  processOutreachBounce,
  processOutreachComplaint,
} from "./outreach-engagement";
import type { DispatchOutcome, ResendWebhookEvent } from "./types";

export type { DispatchOutcome, ResendWebhookEvent } from "./types";
export { RESEND_EVENT_TYPES, isResendEventType } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface DispatchResendEventOpts {
  nowMs?: number;
  dbArg?: Db;
  /** Idempotency id (Resend message id or Svix id). Stamped onto every
   *  activity_log + suppression row the handlers write. */
  eventId: string;
}

/**
 * Route a verified Resend event to its CRM-side handler. Kill-switch
 * gated: when `pipeline.resend_webhook_dispatch_enabled = false`, every
 * event returns `skipped:kill_switch` without touching the CRM.
 *
 * Pure-ish: no HTTP, no signature verification. The caller
 * (`app/api/resend/webhook/route.ts`) owns those, plus the
 * `webhook_events` idempotency write.
 */
export async function dispatchResendEvent(
  event: ResendWebhookEvent,
  opts: DispatchResendEventOpts,
): Promise<DispatchOutcome> {
  const enabled = await settings.get(
    "pipeline.resend_webhook_dispatch_enabled",
  );
  if (!enabled) {
    return { result: "skipped", error: "kill_switch" };
  }

  const handlerOpts = {
    nowMs: opts.nowMs,
    dbArg: opts.dbArg,
    eventId: opts.eventId,
  };

  switch (event.type) {
    case "email.bounced": {
      const result = await handleEmailBounced(event, handlerOpts);
      // LG-10: also update outreach_sends + fire circuit breakers
      const msgId = event.data?.email_id;
      if (msgId) {
        const bounceType =
          event.data?.bounce?.type ?? event.data?.bounce_type ?? "hard";
        await processOutreachBounce(
          msgId,
          bounceType === "soft" ? "soft" : "hard",
          { nowMs: opts.nowMs, dbArg: opts.dbArg },
        );
      }
      return result;
    }
    case "email.complained": {
      const result = await handleEmailComplained(event, handlerOpts);
      // LG-10: also update outreach_sends + fire circuit breakers
      const msgId = event.data?.email_id;
      if (msgId) {
        await processOutreachComplaint(msgId, {
          nowMs: opts.nowMs,
          dbArg: opts.dbArg,
        });
      }
      return result;
    }
    case "email.opened":
      return handleEmailOpened(event, handlerOpts);
    case "email.clicked":
      return handleEmailClicked(event, handlerOpts);
    default:
      return {
        result: "skipped",
        error: `unhandled_event_type:${event.type}`,
      };
  }
}
