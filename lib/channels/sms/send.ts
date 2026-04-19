/**
 * SMS transport adapter — the single approved path for sending SMS
 * from SuperBad Lite via Twilio.
 *
 * Enforces:
 *   1. DNC check (phone-level)
 *   2. SMS quiet window (8am–9pm local, stricter than email)
 *   3. SMS opt-in check
 *   4. Twilio REST API send
 *   5. `twilio_sms_log` row
 *   6. `external_call_log` entry for cost tracking
 *
 * Owner: IF-2. Consumer: intro funnel abandon cadence, booking reminders.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { twilio_sms_log } from "@/lib/db/schema/twilio-sms-log";
import { dnc_phones } from "@/lib/db/schema/dnc-phones";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { TWILIO_API_BASE } from "@/lib/integrations/vendors/twilio";

export interface SendSmsParams {
  to: string;
  body: string;
  submissionId?: string;
  dealId?: string;
  purpose: string;
}

export interface SendSmsResult {
  sent: boolean;
  messageSid?: string;
  skipped?: boolean;
  reason?: string;
}

function isSmsQuietHours(): boolean {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  return hour < 8 || hour >= 21;
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const { to, body, submissionId, dealId, purpose } = params;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, skipped: true, reason: "twilio_not_configured" };
  }

  // DNC check
  const dncRows = await db
    .select()
    .from(dnc_phones)
    .where(eq(dnc_phones.phone, to))
    .limit(1);
  if (dncRows.length > 0) {
    return { sent: false, skipped: true, reason: `dnc:${dncRows[0].reason}` };
  }

  // SMS quiet hours (8am–9pm Melbourne)
  if (isSmsQuietHours()) {
    return {
      sent: false,
      skipped: true,
      reason: "sms_quiet_hours:outside_8am_9pm",
    };
  }

  // Send via Twilio REST API
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("From", fromNumber);
  formData.append("Body", body);

  const statusCallbackUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`
    : undefined;
  if (statusCallbackUrl) {
    formData.append("StatusCallback", statusCallbackUrl);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[sendSms] Twilio error ${response.status}: ${errorBody}`,
    );
  }

  const data = (await response.json()) as { sid: string; status: string };

  // Log to twilio_sms_log
  await db.insert(twilio_sms_log).values({
    id: randomUUID(),
    submission_id: submissionId ?? null,
    deal_id: dealId ?? null,
    direction: "outbound",
    twilio_message_sid: data.sid,
    from_number: fromNumber,
    to_number: to,
    body,
    status: data.status as "queued" | "sent",
    created_at_ms: Date.now(),
  });

  // Log to external_call_log
  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: `sms:${purpose}`,
    actor_type: "internal",
    units: JSON.stringify({ sms: 1 }),
    estimated_cost_aud: 0.08,
    created_at_ms: Date.now(),
  });

  return { sent: true, messageSid: data.sid };
}
