"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { and, gte, lte } from "drizzle-orm";
import { getActiveGraphState, createGraphClient } from "@/lib/graph";
import { syncOutlookCalendar, createOutlookEvent } from "@/lib/graph/calendar-sync";
import { logActivity } from "@/lib/activity-log";

export async function getCalendarEvents(startMs: number, endMs: number) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return [];
  }

  return db
    .select()
    .from(calendar_bookings)
    .where(
      and(
        gte(calendar_bookings.start_at_ms, startMs),
        lte(calendar_bookings.start_at_ms, endMs),
      ),
    )
    .orderBy(calendar_bookings.start_at_ms);
}

export async function syncCalendarAction(): Promise<
  | { ok: true; synced: number; skipped: number }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "unauthorized" };
  }

  const state = await getActiveGraphState();
  if (!state) {
    return { ok: false, error: "No Microsoft connection found. Complete the Graph API setup wizard first." };
  }

  try {
    const client = await createGraphClient(state.integration_connection_id);
    const now = Date.now();
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
    const threeMonthsAhead = now + 90 * 24 * 60 * 60 * 1000;

    const result = await syncOutlookCalendar(client, threeMonthsAgo, threeMonthsAhead);
    revalidatePath("/lite/calendar");
    return { ok: true, synced: result.synced, skipped: result.skipped };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Calendar sync failed.",
    };
  }
}

const CreateEventSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  startMs: z.number().int().positive(),
  endMs: z.number().int().positive(),
  location: z.string().max(300).optional(),
  attendees: z.array(z.string().email()).optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export async function createEventAction(
  input: CreateEventInput,
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = CreateEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.endMs <= parsed.data.startMs) {
    return { ok: false, error: "End time must be after start time." };
  }

  const state = await getActiveGraphState();
  if (!state) {
    return { ok: false, error: "No Microsoft connection found." };
  }

  try {
    const client = await createGraphClient(state.integration_connection_id);
    const result = await createOutlookEvent(client, {
      subject: parsed.data.subject,
      startMs: parsed.data.startMs,
      endMs: parsed.data.endMs,
      location: parsed.data.location,
      attendees: parsed.data.attendees,
    });

    if (!result.ok) {
      return { ok: false, error: result.reason };
    }

    await logActivity({
      kind: "calendar_event_created",
      body: `Created calendar event: ${parsed.data.subject}`,
      meta: {
        event_id: result.eventId,
        start_ms: parsed.data.startMs,
        end_ms: parsed.data.endMs,
      },
    });

    revalidatePath("/lite/calendar");
    return { ok: true, eventId: result.eventId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create event.",
    };
  }
}
