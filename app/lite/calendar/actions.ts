"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { and, gte, lte } from "drizzle-orm";
import { getActiveGraphState, createGraphClient } from "@/lib/graph";
import { syncOutlookCalendar } from "@/lib/graph/calendar-sync";

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
