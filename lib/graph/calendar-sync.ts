import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { killSwitches } from "@/lib/kill-switches";
import type { GraphClient } from "./client";

interface GraphCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  isCancelled: boolean;
  organizer?: { emailAddress?: { address?: string; name?: string } };
  location?: { displayName?: string };
  webLink?: string;
}

interface GraphCalendarResponse {
  value: GraphCalendarEvent[];
  "@odata.nextLink"?: string;
}

export async function syncOutlookCalendar(
  client: GraphClient,
  rangeStartMs: number,
  rangeEndMs: number,
): Promise<{ synced: number; skipped: number }> {
  if (!killSwitches.inbox_sync_enabled) {
    return { synced: 0, skipped: 0 };
  }

  const start = new Date(rangeStartMs).toISOString();
  const end = new Date(rangeEndMs).toISOString();

  const url = `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$select=id,subject,start,end,isAllDay,isCancelled,organizer,location,webLink&$top=100&$orderby=start/dateTime`;

  let synced = 0;
  let skipped = 0;
  let nextUrl: string | null = url;

  while (nextUrl) {
    const data: GraphCalendarResponse = await client.fetchJson<GraphCalendarResponse>(nextUrl);

    for (const event of data.value) {
      if (event.isCancelled) {
        skipped++;
        continue;
      }

      const startMs = new Date(event.start.dateTime + "Z").getTime();
      const endMs = new Date(event.end.dateTime + "Z").getTime();

      const existing = await db
        .select({ id: calendar_bookings.id })
        .from(calendar_bookings)
        .where(eq(calendar_bookings.id, `outlook_${event.id}`))
        .limit(1);

      const now = Date.now();
      const values = {
        id: `outlook_${event.id}`,
        booking_type: "followup_conversation" as const,
        start_at_ms: startMs,
        end_at_ms: endMs,
        subject_ref_table: "outlook_calendar",
        subject_ref_id: event.id,
        status: "active" as const,
        metadata_json: {
          subject: event.subject,
          location: event.location?.displayName ?? null,
          organizer: event.organizer?.emailAddress?.name ?? null,
          outlook_link: event.webLink ?? null,
          is_all_day: event.isAllDay,
          source: "outlook_sync",
        },
        created_at_ms: now,
        updated_at_ms: now,
      };

      if (existing.length > 0) {
        await db
          .update(calendar_bookings)
          .set({
            start_at_ms: startMs,
            end_at_ms: endMs,
            status: "active",
            metadata_json: values.metadata_json,
            updated_at_ms: now,
          })
          .where(eq(calendar_bookings.id, `outlook_${event.id}`));
      } else {
        await db.insert(calendar_bookings).values(values);
      }
      synced++;
    }

    nextUrl = data["@odata.nextLink"] ?? null;
  }

  return { synced, skipped };
}

export async function createOutlookEvent(
  client: GraphClient,
  event: {
    subject: string;
    startMs: number;
    endMs: number;
    location?: string;
    body?: string;
    attendees?: string[];
    timezone?: string;
  },
): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
  const tz = event.timezone ?? "Australia/Melbourne";

  const body = {
    subject: event.subject,
    start: {
      dateTime: new Date(event.startMs).toISOString().replace("Z", ""),
      timeZone: tz,
    },
    end: {
      dateTime: new Date(event.endMs).toISOString().replace("Z", ""),
      timeZone: tz,
    },
    ...(event.location && {
      location: { displayName: event.location },
    }),
    ...(event.body && {
      body: { contentType: "text", content: event.body },
    }),
    ...(event.attendees?.length && {
      attendees: event.attendees.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      })),
    }),
  };

  try {
    const result = await client.fetchJson<{ id: string }>("/me/events", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const now = Date.now();
    await db.insert(calendar_bookings).values({
      id: `outlook_${result.id}`,
      booking_type: "followup_conversation",
      start_at_ms: event.startMs,
      end_at_ms: event.endMs,
      subject_ref_table: "outlook_calendar",
      subject_ref_id: result.id,
      status: "active",
      metadata_json: {
        subject: event.subject,
        location: event.location ?? null,
        source: "lite_created",
      },
      created_at_ms: now,
      updated_at_ms: now,
    });

    return { ok: true, eventId: result.id };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Failed to create Outlook event",
    };
  }
}
