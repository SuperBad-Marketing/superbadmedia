/**
 * Graph API calendar-invite RSVP — accept / tentative / decline a meeting
 * invite that arrived as an inbound message.
 *
 * Spec §4.3 acceptance criteria: "Accept / Tentative / Decline buttons
 * fire the RSVP and log `inbox_calendar_rsvp_sent`."
 *
 * Graph exposes three distinct action endpoints on the message rather
 * than a single `respond` endpoint:
 *  - POST /me/messages/{id}/accept
 *  - POST /me/messages/{id}/tentativelyAccept
 *  - POST /me/messages/{id}/decline
 *
 * Each accepts `{ comment?: string, sendResponse: boolean }` — we default
 * to `sendResponse = true` (organiser gets a calendar ping) and no
 * comment (matches the mouse-first UI; no comment field in buttons).
 *
 * Gated by `inbox_sync_enabled` — no RSVP goes out when the kill switch
 * is off; the caller surfaces a toast in that case.
 */
import type { GraphClient } from "./client";
import { killSwitches } from "@/lib/kill-switches";

export type CalendarRsvpResponse = "accept" | "tentative" | "decline";

export interface RsvpCalendarInviteInput {
  graphMessageId: string;
  mailboxUser?: string;
  response: CalendarRsvpResponse;
  sendResponse?: boolean;
  comment?: string;
}

const RSVP_ACTION_PATH: Record<CalendarRsvpResponse, string> = {
  accept: "accept",
  tentative: "tentativelyAccept",
  decline: "decline",
};

export async function rsvpCalendarInvite(
  client: GraphClient,
  input: RsvpCalendarInviteInput,
): Promise<void> {
  if (!killSwitches.inbox_sync_enabled) {
    throw new Error(
      "Graph API calls are disabled (inbox_sync_enabled = false)",
    );
  }

  const action = RSVP_ACTION_PATH[input.response];
  const path = input.mailboxUser
    ? `/users/${input.mailboxUser}/messages/${input.graphMessageId}/${action}`
    : `/me/messages/${input.graphMessageId}/${action}`;

  const body = JSON.stringify({
    sendResponse: input.sendResponse ?? true,
    comment: input.comment ?? "",
  });

  const res = await client.fetch(path, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Graph calendar RSVP failed (${input.response}): ${res.status} ${text.slice(0, 300)}`,
    );
  }
}
