import type { WebhookResult } from "@/lib/db/schema/webhook-events";

export interface DispatchOutcome {
  result: WebhookResult;
  /** Human-readable reason. Stored verbatim in `webhook_events.error`.
   *  Set for `error` and `skipped`; omitted on `ok`. */
  error?: string;
}
