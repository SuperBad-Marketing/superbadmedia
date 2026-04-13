/**
 * Email transport adapter — the single approved path for sending email
 * from SuperBad Lite.
 *
 * `sendEmail()` enforces:
 *   1. Kill switch gate (`outreach_send_enabled` for non-transactional)
 *   2. Suppression check via `canSendTo()`
 *   3. Quiet window check via `isWithinQuietWindow()` (non-transactional only)
 *   4. Resend SDK send
 *   5. `external_call_log` entry for cost tracking
 *
 * ESLint carve-out: `lib/channels/` is excluded from
 * `no-direct-resend-send` so this file may import and call Resend directly.
 *
 * Owner: A7. Consumer: every wave that sends email.
 */
import { Resend } from "resend";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { killSwitches } from "@/lib/kill-switches";
import { canSendTo } from "@/lib/channels/email/can-send-to";
import { isWithinQuietWindow } from "@/lib/channels/email/quiet-window";
import type { EmailClassification } from "@/lib/channels/email/classifications";
import { isTransactional } from "@/lib/channels/email/classifications";

// Resend client singleton
const globalForResend = globalThis as unknown as { _resend?: Resend };
const resend: Resend =
  globalForResend._resend ??
  new Resend(process.env.RESEND_API_KEY ?? "");

if (process.env.NODE_ENV !== "production") {
  globalForResend._resend = resend;
}

export interface SendEmailParams {
  /** Recipient email address */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** HTML body content — LLM-generated upstream, transport-only here */
  body: string;
  /** Classification governs kill-switch gating and suppression scope */
  classification: EmailClassification;
  /** Human-readable purpose for logging + future frequency cap */
  purpose: string;
  /** Optional reply-to address (defaults to EMAIL_FROM env var) */
  replyTo?: string;
  /** Optional Resend tags for analytics */
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Send an email via Resend, enforcing kill switches, suppression, and
 * quiet window gates.
 *
 * Returns `{ sent: false, skipped: true, reason }` instead of throwing
 * when gated — callers handle the skipped case explicitly.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, body, classification, purpose, replyTo, tags } = params;
  const recipients = Array.isArray(to) ? to : [to];
  const transactional = isTransactional(classification);

  // --- Kill switch gate (non-transactional only) ---
  if (!transactional && !killSwitches.outreach_send_enabled) {
    return {
      sent: false,
      skipped: true,
      reason: "kill_switch:outreach_send_enabled=false",
    };
  }

  // --- Per-recipient suppression check ---
  for (const recipient of recipients) {
    const gate = await canSendTo(recipient, classification, purpose);
    if (!gate.allowed) {
      return { sent: false, skipped: true, reason: gate.reason };
    }
  }

  // --- Quiet window check (non-transactional only) ---
  if (!transactional) {
    const inWindow = await isWithinQuietWindow();
    if (!inWindow) {
      return {
        sent: false,
        skipped: true,
        reason: "quiet_window:outside_send_hours",
      };
    }
  }

  // --- Send via Resend ---
  const from = process.env.EMAIL_FROM_NAME
    ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM ?? "noreply@superbadmedia.com.au"}>`
    : (process.env.EMAIL_FROM ?? "noreply@superbadmedia.com.au");

  const { data, error } = await resend.emails.send({
    from,
    to: recipients,
    subject,
    html: body,
    replyTo: replyTo ?? process.env.EMAIL_FROM,
    tags,
  });

  if (error) {
    throw new Error(`[sendEmail] Resend error: ${error.message ?? JSON.stringify(error)}`);
  }

  // --- Log to external_call_log ---
  await db.insert(external_call_log).values({
    id: crypto.randomUUID(),
    job: `email:${classification}`,
    actor_type: "internal",
    units: JSON.stringify({ emails: recipients.length }),
    estimated_cost_aud: 0,
    created_at_ms: Date.now(),
  });

  return { sent: true, messageId: data?.id };
}
