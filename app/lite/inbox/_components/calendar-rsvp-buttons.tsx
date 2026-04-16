"use client";

import * as React from "react";
import { CalendarDays, Check, Clock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { respondToCalendarInviteAction } from "../ticket/actions";

/**
 * Accept / Tentative / Decline buttons for an inbound calendar invite
 * message (spec §4.3 — replaces UI-8's toast stub). Fires the Graph RSVP
 * via `respondToCalendarInviteAction` and logs `inbox_calendar_rsvp_sent`
 * with the choice.
 *
 * Voice toasts (spec §4.6):
 *  - accept  → "Accepted. Calendar pinged."
 *  - tentative → "Marked tentative."
 *  - decline → "Declined. They'll get the note."
 *
 * When `sendEnabled` is false (kill switch) the buttons stay visible but
 * disabled; tooltip explains why.
 */

export type CalendarRsvpChoice = "accept" | "tentative" | "decline";

type ToastState =
  | { kind: "idle" }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

const LABEL: Record<CalendarRsvpChoice, string> = {
  accept: "Accept",
  tentative: "Tentative",
  decline: "Decline",
};

const SUCCESS_COPY: Record<CalendarRsvpChoice, string> = {
  accept: "Accepted. Calendar pinged.",
  tentative: "Marked tentative.",
  decline: "Declined. They'll get the note.",
};

export function CalendarRsvpButtons({
  messageId,
  sendEnabled,
}: {
  messageId: string;
  sendEnabled: boolean;
}) {
  const [busy, setBusy] = React.useState<CalendarRsvpChoice | null>(null);
  const [done, setDone] = React.useState<CalendarRsvpChoice | null>(null);
  const [toast, setToast] = React.useState<ToastState>({ kind: "idle" });

  const onClick = React.useCallback(
    async (choice: CalendarRsvpChoice) => {
      if (busy || done) return;
      setBusy(choice);
      setToast({ kind: "idle" });
      try {
        await respondToCalendarInviteAction({
          graphMessageId: messageId,
          response: choice,
        });
        setDone(choice);
        setToast({ kind: "ok", text: SUCCESS_COPY[choice] });
      } catch (err) {
        console.error("[calendar-rsvp] failed:", err);
        setToast({
          kind: "error",
          text: "RSVP didn't go. Try again.",
        });
      } finally {
        setBusy(null);
      }
    },
    [busy, done, messageId],
  );

  return (
    <div className="flex items-center gap-1 rounded-sm bg-[color:var(--color-surface-2)] px-2 py-1">
      <CalendarDays
        size={12}
        strokeWidth={1.5}
        aria-hidden
        className="text-[color:var(--color-brand-pink)]"
      />
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-300)]"
      >
        Invite
      </span>
      {(["accept", "tentative", "decline"] as const).map((kind) => {
        const isDone = done === kind;
        const disabled = !sendEnabled || Boolean(done) || Boolean(busy);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onClick(kind)}
            disabled={disabled}
            title={
              !sendEnabled
                ? "RSVPs are paused — try again in a minute."
                : done
                  ? "Already responded."
                  : `RSVP ${LABEL[kind].toLowerCase()}`
            }
            className={cn(
              "flex items-center gap-1 rounded-sm px-1.5 py-0.5",
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
              "outline-none transition-colors",
              isDone
                ? "bg-[color:var(--color-surface-3)] text-[color:var(--color-accent-cta)]"
                : "text-[color:var(--color-neutral-300)] hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-neutral-100)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isDone ? (
              <Check size={10} strokeWidth={1.75} aria-hidden />
            ) : busy === kind ? (
              <Clock size={10} strokeWidth={1.75} aria-hidden />
            ) : kind === "decline" ? (
              <X size={10} strokeWidth={1.75} aria-hidden />
            ) : null}
            {busy === kind ? `${LABEL[kind]}…` : LABEL[kind]}
          </button>
        );
      })}
      {toast.kind !== "idle" && (
        <span
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "ml-1 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)]",
            toast.kind === "error"
              ? "text-[color:var(--color-brand-red)]"
              : "text-[color:var(--color-neutral-500)]",
          )}
        >
          {toast.text}
        </span>
      )}
    </div>
  );
}
