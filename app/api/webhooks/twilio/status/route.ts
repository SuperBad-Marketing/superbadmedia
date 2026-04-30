import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { twilio_sms_log, type SmsStatus } from "@/lib/db/schema/twilio-sms-log";

const VALID_STATUSES = new Set<SmsStatus>([
  "queued", "sent", "delivered", "failed", "undelivered", "received",
]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const messageSid = formData.get("MessageSid") as string | null;
  const messageStatus = formData.get("MessageStatus") as string | null;

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ ok: true });
  }

  if (!VALID_STATUSES.has(messageStatus as SmsStatus)) {
    return NextResponse.json({ ok: true });
  }

  await db
    .update(twilio_sms_log)
    .set({ status: messageStatus as SmsStatus })
    .where(eq(twilio_sms_log.twilio_message_sid, messageSid));

  return NextResponse.json({ ok: true });
}
