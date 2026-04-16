"use server";

/**
 * Support@ ticket server actions (spec §4.3 — overlay controls +
 * calendar RSVP). Called from `ticket-overlay.tsx`,
 * `reply-composer.tsx` (Close-ticket), and `calendar-rsvp-buttons.tsx`.
 *
 *   - `setTicketTypeAction(input)`   → write `threads.ticket_type` +
 *     flip `ticket_type_assigned_by = 'andy'` (manual override).
 *     Re-enqueues the 7d-idle auto-resolve task to reset the clock.
 *   - `setTicketStatusAction(input)` → write `threads.ticket_status`;
 *     setting to `resolved` also stamps `ticket_resolved_at_ms`.
 *   - `closeTicketAction(input)`     → combined reply + set-Resolved for
 *     the composer's Close-ticket button. Sends via Graph, then flips
 *     status.
 *   - `respondToCalendarInviteAction(input)` → Graph RSVP wrapper.
 *     Resolves the graph message id from our message row, then calls
 *     `rsvpCalendarInvite` + logs `inbox_calendar_rsvp_sent`.
 *
 * Auth: admin role required (Andy-only, matches `compose/actions.ts`).
 * Kill switches: status/type writes are always allowed (they're local);
 * `closeTicket` + RSVP gate on `inbox_send_enabled` / `inbox_sync_enabled`.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  messages,
  threads,
  SUPPORT_TICKET_TYPES,
  TICKET_STATUSES,
  type SupportTicketType,
  type TicketStatus,
} from "@/lib/db/schema/messages";
import { createGraphClient, getActiveGraphState } from "@/lib/graph/client";
import { sendComposeMessage } from "@/lib/graph/compose-send";
import {
  rsvpCalendarInvite,
  type CalendarRsvpResponse,
} from "@/lib/graph/rsvp-calendar-invite";
import { scheduleTicketAutoResolveIdle } from "@/lib/graph/ticket-auto-resolve";
import { logActivity } from "@/lib/activity-log";

type ActorContext = { userId: string; actorTag: string };

async function requireAdminActor(): Promise<ActorContext | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return {
    userId: session.user.id,
    actorTag: `user:${session.user.id}`,
  };
}

// ── setTicketType ────────────────────────────────────────────────────

const SetTicketTypeInput = z.object({
  threadId: z.string().min(1),
  type: z.enum(SUPPORT_TICKET_TYPES),
});

export type SetTicketTypeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setTicketTypeAction(
  input: z.infer<typeof SetTicketTypeInput>,
): Promise<SetTicketTypeResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = SetTicketTypeInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await db
    .select({
      contact_id: threads.contact_id,
      company_id: threads.company_id,
      ticket_type: threads.ticket_type,
    })
    .from(threads)
    .where(eq(threads.id, parsed.data.threadId))
    .get();

  if (!existing) return { ok: false, error: "Thread not found." };
  const previous = existing.ticket_type;
  if (previous === parsed.data.type) return { ok: true };

  const nowMs = Date.now();
  await db
    .update(threads)
    .set({
      ticket_type: parsed.data.type,
      ticket_type_assigned_by: "andy",
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, parsed.data.threadId));

  await logActivity({
    companyId: existing.company_id,
    contactId: existing.contact_id,
    kind: "inbox_ticket_type_changed",
    body: `Ticket type changed to ${parsed.data.type} (was ${previous ?? "unset"}).`,
    meta: {
      thread_id: parsed.data.threadId,
      previous_type: previous,
      new_type: parsed.data.type,
      assigned_by: "andy",
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true };
}

// ── setTicketStatus ──────────────────────────────────────────────────

const SetTicketStatusInput = z.object({
  threadId: z.string().min(1),
  status: z.enum(TICKET_STATUSES),
});

export type SetTicketStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setTicketStatusAction(
  input: z.infer<typeof SetTicketStatusInput>,
): Promise<SetTicketStatusResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = SetTicketStatusInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await writeTicketStatus(
    parsed.data.threadId,
    parsed.data.status,
    actor.actorTag,
    "manual",
  );
  if (!result.ok) return result;
  revalidatePath("/lite/inbox");
  return { ok: true };
}

async function writeTicketStatus(
  threadId: string,
  status: TicketStatus,
  actorTag: string,
  trigger: "manual" | "post_send" | "close_ticket",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await db
    .select({
      contact_id: threads.contact_id,
      company_id: threads.company_id,
      ticket_status: threads.ticket_status,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  if (!existing) return { ok: false, error: "Thread not found." };
  const previous = existing.ticket_status;
  if (previous === status) return { ok: true };

  const nowMs = Date.now();
  await db
    .update(threads)
    .set({
      ticket_status: status,
      ticket_resolved_at_ms: status === "resolved" ? nowMs : null,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, threadId));

  await logActivity({
    companyId: existing.company_id,
    contactId: existing.contact_id,
    kind:
      status === "resolved"
        ? "inbox_ticket_resolved"
        : "inbox_ticket_status_changed",
    body:
      status === "resolved"
        ? `Ticket resolved (trigger: ${trigger}).`
        : `Ticket status → ${status} (was ${previous ?? "unset"}).`,
    meta: {
      thread_id: threadId,
      previous_status: previous,
      new_status: status,
      trigger,
    },
    createdBy: actorTag,
  });

  if (status !== "resolved") {
    try {
      await scheduleTicketAutoResolveIdle(threadId, nowMs);
    } catch (err) {
      console.error("[ticket-actions] reschedule auto-resolve failed:", err);
    }
  }
  return { ok: true };
}

// ── closeTicketAction ────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const CloseTicketAttachmentSchema = z.object({
  name: z.string().min(1).max(512),
  contentType: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES),
});

const CloseTicketInput = z.object({
  threadId: z.string().min(1),
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().nullable().optional(),
  bodyText: z.string().min(1),
  sendingAddress: z.string().min(1),
  composeDraftId: z.string().nullable().optional(),
  attachments: z.array(CloseTicketAttachmentSchema).max(10).optional(),
});

export type CloseTicketResult =
  | {
      ok: true;
      threadId: string;
      messageId: string;
      graphMessageId: string | null;
    }
  | { ok: false; error: string };

export async function closeTicketAction(
  input: z.infer<typeof CloseTicketInput>,
): Promise<CloseTicketResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = CloseTicketInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const state = await getActiveGraphState();
    if (!state) return { ok: false, error: "Graph mailbox not connected." };
    const client = await createGraphClient(state.integration_connection_id);
    const send = await sendComposeMessage(client, {
      threadId: parsed.data.threadId,
      contactId: parsed.data.contactId ?? null,
      companyId: parsed.data.companyId ?? null,
      sendingAddress: parsed.data.sendingAddress,
      to: parsed.data.to,
      cc: parsed.data.cc,
      bcc: parsed.data.bcc,
      subject: parsed.data.subject ?? null,
      bodyText: parsed.data.bodyText,
      createdBy: actor.actorTag,
      composeDraftId: parsed.data.composeDraftId ?? null,
      attachments: parsed.data.attachments,
    });
    if ((parsed.data.attachments?.length ?? 0) > 0) {
      await logActivity({
        companyId: parsed.data.companyId ?? null,
        contactId: parsed.data.contactId ?? null,
        kind: "inbox_attachment_uploaded",
        body: `${parsed.data.attachments!.length} attachment(s) sent with close-ticket reply.`,
        meta: {
          thread_id: send.threadId,
          message_id: send.messageId,
          attachment_count: parsed.data.attachments!.length,
        },
        createdBy: actor.actorTag,
      });
    }

    const statusResult = await writeTicketStatus(
      send.threadId,
      "resolved",
      actor.actorTag,
      "close_ticket",
    );
    if (!statusResult.ok) return statusResult;

    revalidatePath("/lite/inbox");
    return {
      ok: true,
      threadId: send.threadId,
      messageId: send.messageId,
      graphMessageId: send.graphMessageId,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Close failed.",
    };
  }
}

// ── respondToCalendarInviteAction ────────────────────────────────────

const RespondToCalendarInviteInput = z.object({
  graphMessageId: z.string().min(1),
  response: z.enum(["accept", "tentative", "decline"]),
});

export type RespondToCalendarInviteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function respondToCalendarInviteAction(
  input: z.infer<typeof RespondToCalendarInviteInput>,
): Promise<RespondToCalendarInviteResult> {
  const actor = await requireAdminActor();
  if (!actor) return { ok: false, error: "Not authorised." };

  const parsed = RespondToCalendarInviteInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const row = await db
    .select({
      id: messages.id,
      thread_id: messages.thread_id,
      graph_message_id: messages.graph_message_id,
    })
    .from(messages)
    .where(eq(messages.id, parsed.data.graphMessageId))
    .get();

  const graphId = row?.graph_message_id ?? parsed.data.graphMessageId;

  try {
    const state = await getActiveGraphState();
    if (!state) return { ok: false, error: "Graph mailbox not connected." };
    const client = await createGraphClient(state.integration_connection_id);
    await rsvpCalendarInvite(client, {
      graphMessageId: graphId,
      response: parsed.data.response as CalendarRsvpResponse,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "RSVP failed.",
    };
  }

  const threadRow = row?.thread_id
    ? await db
        .select({
          contact_id: threads.contact_id,
          company_id: threads.company_id,
        })
        .from(threads)
        .where(eq(threads.id, row.thread_id))
        .get()
    : null;

  await logActivity({
    companyId: threadRow?.company_id ?? null,
    contactId: threadRow?.contact_id ?? null,
    kind: "inbox_calendar_rsvp_sent",
    body: `Calendar RSVP sent: ${parsed.data.response}.`,
    meta: {
      thread_id: row?.thread_id ?? null,
      message_id: row?.id ?? null,
      graph_message_id: graphId,
      response: parsed.data.response,
    },
    createdBy: actor.actorTag,
  });

  revalidatePath("/lite/inbox");
  return { ok: true };
}
