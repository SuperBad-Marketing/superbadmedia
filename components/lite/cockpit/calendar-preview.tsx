"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import type { CalendarBookingType } from "@/lib/db/schema/calendar";
import { formatTimestamp } from "@/lib/format-timestamp";

interface CalendarEvent {
  id: string;
  booking_type: CalendarBookingType;
  start_at_ms: number;
  end_at_ms: number;
  subject_ref_table: string;
  subject_ref_id: string;
  status: string;
  metadata_json: unknown;
  created_at_ms: number;
  updated_at_ms: number;
}

const TYPE_LABELS: Record<CalendarBookingType, string> = {
  intro_funnel_shoot: "Shoot",
  followup_conversation: "Meeting",
  marketing_site_booking: "Booking",
};

export function CalendarPreview({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <Link href="/lite/calendar" className="flex items-center gap-3 py-2 group">
        <Calendar
          className="h-4 w-4 transition-colors group-hover:text-[color:var(--color-neutral-200)]"
          style={{ color: "var(--color-neutral-400)" }}
        />
        <p
          className="text-[13px] font-[family-name:var(--font-serif)] italic transition-colors group-hover:text-[color:var(--color-neutral-300)]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Nothing on the calendar today. Unscheduled time is underrated.
        </p>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1">
      <Calendar
        className="h-4 w-4 flex-shrink-0"
        style={{ color: "var(--color-neutral-500)" }}
      />
      <div className="flex gap-3">
        {events.map((ev) => (
          <Link
            key={ev.id}
            href="/lite/calendar"
            className="flex items-center gap-2 flex-shrink-0 text-[13px] font-[family-name:var(--font-body)]"
            style={{ color: "var(--color-neutral-300)" }}
          >
            <span style={{ color: "var(--color-neutral-500)" }}>
              {formatTimestamp(ev.start_at_ms, "Australia/Melbourne", {
                format: "time",
              })}
            </span>
            <span>{TYPE_LABELS[ev.booking_type] ?? ev.booking_type}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
