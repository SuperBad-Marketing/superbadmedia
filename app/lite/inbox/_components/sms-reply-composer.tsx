"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { sendSmsReply } from "@/app/lite/inbox/sms/actions";

const SMS_SEGMENT_LENGTH = 160;

type ToastState =
  | { kind: "idle" }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

export type SmsReplyComposerProps = {
  threadId: string;
  contactId: string | null;
  companyId: string | null;
  toPhone: string;
  sendEnabled: boolean;
};

export function SmsReplyComposer(props: SmsReplyComposerProps) {
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>({ kind: "idle" });

  React.useEffect(() => {
    setBody("");
    setToast({ kind: "idle" });
  }, [props.threadId]);

  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(charCount / SMS_SEGMENT_LENGTH));
  const sendDisabled = !props.sendEnabled || sending || body.trim().length === 0;

  async function handleSend() {
    setSending(true);
    setToast({ kind: "idle" });
    try {
      const result = await sendSmsReply({
        threadId: props.threadId,
        contactId: props.contactId,
        companyId: props.companyId,
        toPhone: props.toPhone,
        body: body.trim(),
      });
      if (result.ok) {
        setToast({ kind: "ok", text: "Sent." });
        setBody("");
      } else {
        setToast({ kind: "error", text: result.error });
      }
    } catch (err) {
      setToast({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to send.",
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !sendDisabled) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section
      aria-label="SMS reply"
      className="flex flex-col gap-2 border-t border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] p-4"
    >
      <div className="flex items-center gap-2">
        <Phone
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className="text-[color:var(--color-neutral-500)]"
        />
        <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]">
          SMS to {props.toPhone}
        </span>
      </div>

      <textarea
        aria-label="SMS body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className={cn(
          "min-h-[5rem] resize-y rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]",
          "outline-none focus-visible:border-[color:var(--color-accent-cta)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]/30",
        )}
        placeholder="Your reply…"
      />

      <AnimatePresence>
        {toast.kind !== "idle" && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
              toast.kind === "error"
                ? "text-[color:var(--color-brand-red)]"
                : "text-[color:var(--color-neutral-300)]",
            )}
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)]",
            charCount > SMS_SEGMENT_LENGTH
              ? "text-[color:var(--color-brand-pink)]"
              : "text-[color:var(--color-neutral-500)]",
          )}
        >
          {charCount > 0 && (
            <>
              {charCount} char{charCount !== 1 ? "s" : ""}
              {segments > 1 && ` · ${segments} segments`}
            </>
          )}
        </span>

        <button
          type="button"
          onClick={handleSend}
          disabled={sendDisabled}
          title={
            !props.sendEnabled
              ? "Sending's paused, try again in a minute."
              : body.trim().length === 0
                ? "Write something first."
                : "Send SMS"
          }
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-4 py-1.5",
            "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
            "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
            "outline-none transition-[filter] hover:brightness-110",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Send size={12} strokeWidth={1.75} aria-hidden />
          {sending ? "Sending…" : "Send SMS"}
        </button>
      </div>
    </section>
  );
}
