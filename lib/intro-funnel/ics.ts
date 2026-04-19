/**
 * RFC 5545 .ics calendar invite generator for trial shoot bookings.
 * Owner: IF-2.
 */

interface IcsParams {
  uid: string;
  summary: string;
  description: string;
  location: string;
  startMs: number;
  endMs: number;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}

function toIcsDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcs(params: IcsParams): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SuperBad Marketing//Lite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTART:${toIcsDate(params.startMs)}`,
    `DTEND:${toIcsDate(params.endMs)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
    `LOCATION:${escapeIcsText(params.location)}`,
    `ORGANIZER;CN=${escapeIcsText(params.organizerName)}:mailto:${params.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsText(params.attendeeName)};RSVP=TRUE:mailto:${params.attendeeEmail}`,
    `DTSTAMP:${toIcsDate(Date.now())}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
