import type { WebhookResult } from "@/lib/db/schema/webhook-events";

/**
 * Resend webhook event shape. Covers only the fields SP-8 consumes —
 * Resend's schema is broader but the rest is ignored. Defined as a
 * minimal nominal type to keep the dispatch surface narrow; we never
 * pass through un-parsed Resend payloads.
 */
export const RESEND_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
] as const;

export type ResendEventType = (typeof RESEND_EVENT_TYPES)[number];

export function isResendEventType(value: string): value is ResendEventType {
  return (RESEND_EVENT_TYPES as readonly string[]).includes(value);
}

export interface ResendWebhookEvent {
  type: string;
  /** Resend event id — primary key for idempotency. */
  data: ResendEventData;
  created_at?: string;
}

export interface ResendEventData {
  /** Resend message id (`em_...`). */
  email_id?: string;
  to?: string[] | string;
  from?: string;
  subject?: string;
  created_at?: string;
  /** Bounce sub-payload (Resend nests it). */
  bounce?: {
    type?: "hard" | "soft" | string;
    message?: string;
    subType?: string;
  };
  /** Some Resend payloads send the bounce classification at top-level. */
  bounce_type?: "hard" | "soft" | string;
  tags?: Record<string, string> | Array<{ name: string; value: string }>;
}

export interface DispatchOutcome {
  result: WebhookResult;
  /** Human-readable reason. Stored verbatim in `webhook_events.error`.
   *  Set for `error` and `skipped`; omitted on `ok`. */
  error?: string;
}
