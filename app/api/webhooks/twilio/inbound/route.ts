import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema/messages";
import { twilio_sms_log } from "@/lib/db/schema/twilio-sms-log";
import { contacts } from "@/lib/db/schema/contacts";
import { normalisePhone } from "@/lib/crm/normalise";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const from = formData.get("From") as string | null;
  const to = formData.get("To") as string | null;
  const body = formData.get("Body") as string | null;
  const messageSid = formData.get("MessageSid") as string | null;
  const numMedia = parseInt((formData.get("NumMedia") as string) ?? "0", 10);

  if (!from || !body || !messageSid) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response/>',
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  const existingLog = await db
    .select({ id: twilio_sms_log.id })
    .from(twilio_sms_log)
    .where(eq(twilio_sms_log.twilio_message_sid, messageSid))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existingLog) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response/>',
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  const phoneNorm = normalisePhone(from);
  let contactId: string | null = null;
  let companyId: string | null = null;
  let contactName: string | null = null;

  if (phoneNorm) {
    const contact = await db
      .select({
        id: contacts.id,
        company_id: contacts.company_id,
        name: contacts.name,
      })
      .from(contacts)
      .where(eq(contacts.phone_normalised, phoneNorm))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (contact) {
      contactId = contact.id;
      companyId = contact.company_id;
      contactName = contact.name;
    }
  }

  const nowMs = Date.now();

  let existingThread: { id: string } | null = null;
  if (contactId) {
    existingThread = await db
      .select({ id: threads.id })
      .from(threads)
      .where(
        and(
          eq(threads.contact_id, contactId),
          eq(threads.channel_of_origin, "sms"),
        ),
      )
      .orderBy(desc(threads.last_message_at_ms))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  const threadId = existingThread?.id ?? randomUUID();
  const messageId = randomUUID();

  if (!existingThread) {
    await db.insert(threads).values({
      id: threadId,
      contact_id: contactId,
      company_id: companyId,
      channel_of_origin: "sms",
      sending_address: to ?? null,
      subject: contactName ? `SMS — ${contactName}` : `SMS — ${from}`,
      priority_class: "signal",
      last_message_at_ms: nowMs,
      last_inbound_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    });
  } else {
    await db
      .update(threads)
      .set({
        last_message_at_ms: nowMs,
        last_inbound_at_ms: nowMs,
        cached_draft_stale: true,
        updated_at_ms: nowMs,
      })
      .where(eq(threads.id, threadId));
  }

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "inbound",
    channel: "sms",
    from_address: from,
    to_addresses: JSON.stringify(to ? [to] : []),
    body_text: body,
    received_at_ms: nowMs,
    priority_class: "signal",
    import_source: "live",
    has_attachments: numMedia > 0,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db.insert(twilio_sms_log).values({
    id: randomUUID(),
    direction: "inbound",
    twilio_message_sid: messageSid,
    from_number: from,
    to_number: to ?? "",
    body,
    status: "received",
    created_at_ms: nowMs,
  });

  await logActivity({
    companyId,
    contactId,
    kind: "sms_received",
    body: `Inbound SMS from ${contactName ?? from}: "${body.slice(0, 80)}${body.length > 80 ? "…" : ""}"`,
    meta: {
      thread_id: threadId,
      message_id: messageId,
      twilio_message_sid: messageSid,
      from,
    },
    createdBy: "system:twilio-webhook",
  });

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}
