/**
 * POST /api/lite/eggs/milestone-action
 *
 * Handles Andy's response to a milestone spotter notification:
 * - dismiss: logs outcome, hides card
 * - send_email: sends the draft (or edited) email, logs outcome
 * - send_sms: sends the draft (or edited) SMS, logs outcome
 *
 * Auth: admin only.
 * Owner: SD-9. Spec: docs/specs/surprise-and-delight.md §2 milestone spotter.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { contacts } from "@/lib/db/schema/contacts";
import { sendEmail } from "@/lib/channels/email/send";
import { sendSms } from "@/lib/channels/sms/send";
import { logActivity } from "@/lib/activity-log";

type MilestoneAction = "dismiss" | "send_email" | "send_sms";

interface MilestoneActionBody {
  fireId: string;
  action: MilestoneAction;
  contactId?: string;
  editedMessage?: string;
  subject?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as MilestoneActionBody;
  const { fireId, action, contactId, editedMessage, subject } = body;

  if (!fireId || !action) {
    return NextResponse.json({ error: "Missing fireId or action" }, { status: 400 });
  }

  const [fireRow] = await db
    .select({ id: hidden_egg_fires.id, trigger_evidence: hidden_egg_fires.trigger_evidence })
    .from(hidden_egg_fires)
    .where(
      and(
        eq(hidden_egg_fires.id, fireId),
        eq(hidden_egg_fires.egg_id, "milestone_spotter"),
      ),
    )
    .limit(1);

  if (!fireRow) {
    return NextResponse.json({ error: "Fire record not found" }, { status: 404 });
  }

  if (action === "dismiss") {
    await db
      .update(hidden_egg_fires)
      .set({ outcome: "dismissed" })
      .where(eq(hidden_egg_fires.id, fireId));

    await logActivity({
      kind: "hidden_egg_dismissed",
      body: "Milestone spotter notification dismissed",
      meta: { egg_id: "milestone_spotter", fire_id: fireId },
    });

    return NextResponse.json({ ok: true, action: "dismissed" });
  }

  if (action === "send_email" && contactId) {
    const [contact] = await db
      .select({ email: contacts.email, name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    if (!contact?.email) {
      return NextResponse.json({ error: "Contact has no email" }, { status: 400 });
    }

    const messageBody = editedMessage ?? "";
    const emailSubject = subject ?? "Thinking of you";

    const result = await sendEmail({
      to: contact.email,
      subject: emailSubject,
      body: messageBody,
      classification: "milestone_outreach",
      purpose: "milestone_spotter_outreach",
      tags: [{ name: "source", value: "milestone_spotter" }],
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: "Email not sent", reason: result.reason },
        { status: 422 },
      );
    }

    await db
      .update(hidden_egg_fires)
      .set({ outcome: "sent" })
      .where(eq(hidden_egg_fires.id, fireId));

    await logActivity({
      kind: "hidden_egg_acted",
      body: `Milestone email sent to ${contact.name ?? contact.email}`,
      contactId,
      meta: {
        egg_id: "milestone_spotter",
        fire_id: fireId,
        channel: "email",
        message_id: result.messageId,
      },
    });

    return NextResponse.json({ ok: true, action: "sent", channel: "email" });
  }

  if (action === "send_sms" && contactId) {
    const [contact] = await db
      .select({ phone: contacts.phone, name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    if (!contact?.phone) {
      return NextResponse.json({ error: "Contact has no phone number" }, { status: 400 });
    }

    const smsBody = editedMessage ?? "";

    const result = await sendSms({
      to: contact.phone,
      body: smsBody,
      purpose: "milestone_spotter_outreach",
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: "SMS not sent", reason: result.reason },
        { status: 422 },
      );
    }

    await db
      .update(hidden_egg_fires)
      .set({ outcome: "sent" })
      .where(eq(hidden_egg_fires.id, fireId));

    await logActivity({
      kind: "hidden_egg_acted",
      body: `Milestone SMS sent to ${contact.name ?? contact.phone}`,
      contactId: contactId,
      meta: {
        egg_id: "milestone_spotter",
        fire_id: fireId,
        channel: "sms",
        message_sid: result.messageSid,
      },
    });

    return NextResponse.json({ ok: true, action: "sent", channel: "sms" });
  }

  return NextResponse.json({ error: "Invalid action or missing contactId" }, { status: 400 });
}
