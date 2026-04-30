"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema/messages";
import { twilio_sms_log } from "@/lib/db/schema/twilio-sms-log";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { contacts } from "@/lib/db/schema/contacts";
import { getTwilioCredentials } from "@/lib/channels/sms/credentials";
import { TWILIO_API_BASE } from "@/lib/integrations/vendors/twilio";
import { logActivity } from "@/lib/activity-log";
import { toE164 } from "@/lib/crm/normalise";

const SendSmsReplySchema = z.object({
  threadId: z.string().min(1),
  contactId: z.string().nullable(),
  companyId: z.string().nullable(),
  toPhone: z.string().min(1),
  body: z.string().min(1).max(1600),
});

export type SendSmsReplyResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendSmsReply(
  input: z.infer<typeof SendSmsReplySchema>,
): Promise<SendSmsReplyResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const parsed = SendSmsReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const toPhone = toE164(parsed.data.toPhone);
  if (!toPhone) {
    return { ok: false, error: "Invalid phone number." };
  }

  const creds = await getTwilioCredentials();
  if (!creds) {
    return { ok: false, error: "Twilio not configured. Run the setup wizard and set TWILIO_PHONE_NUMBER." };
  }

  const { accountSid, authToken, fromNumber } = creds;

  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  const formData = new URLSearchParams();
  formData.append("To", toPhone);
  formData.append("From", fromNumber);
  formData.append("Body", parsed.data.body);

  const statusCallbackUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`
    : undefined;
  if (statusCallbackUrl) {
    formData.append("StatusCallback", statusCallbackUrl);
  }

  let twilioData: { sid: string; status: string };
  try {
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
      return { ok: false, error: `Twilio error ${response.status}: ${errorBody.slice(0, 200)}` };
    }
    twilioData = (await response.json()) as { sid: string; status: string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send SMS.",
    };
  }

  const nowMs = Date.now();
  const messageId = randomUUID();

  await db.insert(messages).values({
    id: messageId,
    thread_id: parsed.data.threadId,
    direction: "outbound",
    channel: "sms",
    from_address: fromNumber,
    to_addresses: JSON.stringify([toPhone]),
    body_text: parsed.data.body,
    sent_at_ms: nowMs,
    priority_class: "signal",
    import_source: "live",
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db
    .update(threads)
    .set({
      last_message_at_ms: nowMs,
      last_outbound_at_ms: nowMs,
      has_cached_draft: false,
      cached_draft_body: null,
      cached_draft_stale: false,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, parsed.data.threadId));

  await db.insert(twilio_sms_log).values({
    id: randomUUID(),
    direction: "outbound",
    twilio_message_sid: twilioData.sid,
    from_number: fromNumber,
    to_number: toPhone,
    body: parsed.data.body,
    status: twilioData.status as "queued" | "sent",
    created_at_ms: nowMs,
  });

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "sms:inbox_reply",
    actor_type: "internal",
    units: JSON.stringify({ sms: 1 }),
    estimated_cost_aud: 0.08,
    created_at_ms: nowMs,
  });

  await logActivity({
    companyId: parsed.data.companyId,
    contactId: parsed.data.contactId,
    kind: "sms_sent",
    body: `SMS reply sent: "${parsed.data.body.slice(0, 80)}${parsed.data.body.length > 80 ? "…" : ""}"`,
    meta: {
      thread_id: parsed.data.threadId,
      message_id: messageId,
      twilio_message_sid: twilioData.sid,
      to: toPhone,
    },
    createdBy: `user:${session.user.id}`,
  });

  revalidatePath("/lite/inbox");
  return { ok: true, messageId };
}

const NewSmsThreadSchema = z.object({
  contactId: z.string().min(1),
  companyId: z.string().nullable(),
  toPhone: z.string().min(1),
  contactName: z.string().min(1),
  body: z.string().min(1).max(1600),
});

export type NewSmsThreadResult =
  | { ok: true; threadId: string; messageId: string }
  | { ok: false; error: string };

export async function sendNewSms(
  input: z.infer<typeof NewSmsThreadSchema>,
): Promise<NewSmsThreadResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const parsed = NewSmsThreadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const toPhone = toE164(parsed.data.toPhone);
  if (!toPhone) {
    return { ok: false, error: "Invalid phone number." };
  }

  const creds = await getTwilioCredentials();
  if (!creds) {
    return { ok: false, error: "Twilio not configured. Run the setup wizard and set TWILIO_PHONE_NUMBER." };
  }

  const { accountSid, authToken, fromNumber } = creds;

  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  const formData = new URLSearchParams();
  formData.append("To", toPhone);
  formData.append("From", fromNumber);
  formData.append("Body", parsed.data.body);

  const statusCallbackUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`
    : undefined;
  if (statusCallbackUrl) {
    formData.append("StatusCallback", statusCallbackUrl);
  }

  let twilioData: { sid: string; status: string };
  try {
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
      return { ok: false, error: `Twilio error ${response.status}: ${errorBody.slice(0, 200)}` };
    }
    twilioData = (await response.json()) as { sid: string; status: string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send SMS.",
    };
  }

  const nowMs = Date.now();
  const threadId = randomUUID();
  const messageId = randomUUID();

  await db.insert(threads).values({
    id: threadId,
    contact_id: parsed.data.contactId,
    company_id: parsed.data.companyId,
    channel_of_origin: "sms",
    subject: `SMS — ${parsed.data.contactName}`,
    priority_class: "signal",
    last_message_at_ms: nowMs,
    last_outbound_at_ms: nowMs,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "outbound",
    channel: "sms",
    from_address: fromNumber,
    to_addresses: JSON.stringify([toPhone]),
    body_text: parsed.data.body,
    sent_at_ms: nowMs,
    priority_class: "signal",
    import_source: "live",
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db.insert(twilio_sms_log).values({
    id: randomUUID(),
    direction: "outbound",
    twilio_message_sid: twilioData.sid,
    from_number: fromNumber,
    to_number: toPhone,
    body: parsed.data.body,
    status: twilioData.status as "queued" | "sent",
    created_at_ms: nowMs,
  });

  await db.insert(external_call_log).values({
    id: randomUUID(),
    job: "sms:inbox_compose",
    actor_type: "internal",
    units: JSON.stringify({ sms: 1 }),
    estimated_cost_aud: 0.08,
    created_at_ms: nowMs,
  });

  await logActivity({
    companyId: parsed.data.companyId,
    contactId: parsed.data.contactId,
    kind: "sms_sent",
    body: `New SMS thread started: "${parsed.data.body.slice(0, 80)}${parsed.data.body.length > 80 ? "…" : ""}"`,
    meta: {
      thread_id: threadId,
      message_id: messageId,
      twilio_message_sid: twilioData.sid,
      to: toPhone,
    },
    createdBy: `user:${session.user.id}`,
  });

  revalidatePath("/lite/inbox");
  return { ok: true, threadId, messageId };
}
