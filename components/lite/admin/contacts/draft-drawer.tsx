"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import {
  generateDraftAction,
  regenerateDraftAction,
  reformatDraftAction,
  discardDraftAction,
  sendDraftAction,
} from "@/app/lite/admin/contacts/[id]/context-actions";

interface DraftDrawerProps {
  contactId: string;
  open: boolean;
  onClose: () => void;
  initialDraft: { content: string; channel: string; nudgeHistory: string[] } | null;
  preferredChannel: string;
}

type DrawerState = "idle" | "generating" | "nudging" | "reformatting" | "sending";

export function DraftDrawer({
  contactId,
  open,
  onClose,
  initialDraft,
  preferredChannel,
}: DraftDrawerProps) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = React.useState(initialDraft?.content ?? "");
  const [channel, setChannel] = React.useState(initialDraft?.channel ?? preferredChannel);
  const [nudgeHistory, setNudgeHistory] = React.useState<string[]>(initialDraft?.nudgeHistory ?? []);
  const [nudgeText, setNudgeText] = React.useState("");
  const [state, setState] = React.useState<DrawerState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft.content);
      setChannel(initialDraft.channel);
      setNudgeHistory(initialDraft.nudgeHistory);
    }
  }, [initialDraft]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleClose() {
    onClose();
  }

  async function handleGenerate() {
    setState("generating");
    setError(null);
    const result = await generateDraftAction(contactId);
    if (result.ok) {
      setDraft(result.content);
      setChannel(result.channel);
      setNudgeHistory(result.nudgeHistory);
    } else {
      setError(result.error);
    }
    setState("idle");
  }

  async function handleNudge() {
    if (!nudgeText.trim() || !draft) return;
    setState("nudging");
    setError(null);
    const result = await regenerateDraftAction(contactId, nudgeText.trim(), draft, nudgeHistory);
    if (result.ok) {
      setDraft(result.content);
      setChannel(result.channel);
      setNudgeHistory(result.nudgeHistory);
      setNudgeText("");
    } else {
      setError(result.error);
    }
    setState("idle");
  }

  async function handleChannelSwitch(targetChannel: string) {
    if (!draft || targetChannel === channel) return;
    setState("reformatting");
    setError(null);
    const result = await reformatDraftAction(contactId, draft, targetChannel);
    if (result.ok) {
      setDraft(result.content);
      setChannel(result.channel);
    } else {
      setError(result.error);
    }
    setState("idle");
  }

  async function handleSend() {
    if (!draft) return;
    setState("sending");
    setError(null);
    const result = await sendDraftAction(contactId, draft, channel);
    if (result.ok) {
      setDraft("");
      setChannel(preferredChannel);
      setNudgeHistory([]);
      onClose();
    } else {
      setError(result.error);
    }
    setState("idle");
  }

  async function handleDiscard() {
    setError(null);
    await discardDraftAction(contactId);
    setDraft("");
    setChannel(preferredChannel);
    setNudgeHistory([]);
    onClose();
  }

  const busy = state !== "idle";
  const isGenerating = state === "generating";
  const isNudging = state === "nudging";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0.01 } : { duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Draft drawer"
            initial={reduced ? { opacity: 0 } : { x: "100%", opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: "100%", opacity: 0 }}
            transition={
              reduced
                ? { duration: 0.01 }
                : { ...houseSpring, duration: 0.34 }
            }
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[color:rgba(253,245,230,0.05)] px-5 py-4">
              <h2
                className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
                style={{ letterSpacing: "1.8px" }}
              >
                Draft
              </h2>
              <div className="flex items-center gap-3">
                <ChannelSwitcher channel={channel} onSwitch={handleChannelSwitch} disabled={busy || !draft} />
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-6 w-6 items-center justify-center rounded text-[14px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                  aria-label="Close drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
              {!draft && !isGenerating && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                  <p className="font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-neutral-500)]">
                    no draft yet. hit generate.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={busy}
                    className="rounded-full bg-[color:var(--color-brand-pink)] px-5 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-charcoal)] transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    Generate draft
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                  <div className="relative h-12 w-12">
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: "rgba(244, 160, 176, 0.15)" }}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
                    drafting something thoughtful...
                  </p>
                </div>
              )}

              {draft && !isGenerating && (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={draft.slice(0, 50)}
                      initial={reduced ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduced ? {} : { opacity: 0 }}
                      transition={reduced ? { duration: 0.01 } : { duration: 0.24 }}
                    >
                      <textarea
                        ref={textAreaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        disabled={busy}
                        className={`w-full resize-none rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-0)] px-4 py-3 font-[family-name:var(--font-body)] text-[13px] leading-[1.7] text-[color:var(--color-brand-cream)] outline-none transition-all duration-300 focus:border-[color:var(--color-brand-pink)] disabled:opacity-60 ${
                          isNudging ? "animate-pulse" : ""
                        }`}
                        rows={Math.max(8, Math.ceil(draft.length / 60))}
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Nudge field */}
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nudgeText}
                        onChange={(e) => setNudgeText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleNudge(); }}
                        placeholder="nudge it — 'less formal', 'mention Thursday'"
                        disabled={busy}
                        className="flex-1 rounded border border-[color:var(--color-neutral-600)] bg-[color:var(--color-surface-0)] px-3 py-2 text-[12px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] outline-none focus:border-[color:var(--color-brand-pink)] disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={handleNudge}
                        disabled={busy || !nudgeText.trim()}
                        className="rounded bg-[color:var(--color-surface-3)] px-3 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)] transition-colors hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
                        style={{ letterSpacing: "1px" }}
                      >
                        Nudge
                      </button>
                    </div>
                    {nudgeHistory.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {nudgeHistory.map((n, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-[color:var(--color-surface-3)] px-2 py-[1px] text-[9px] text-[color:var(--color-neutral-500)]"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Generate new button */}
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={busy}
                    className="mt-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    Generate new draft
                  </button>
                </>
              )}

              {error && (
                <p className="mt-3 text-[12px] text-[color:var(--color-brand-red)]">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            {draft && !isGenerating && (
              <div className="flex items-center justify-between border-t border-[color:rgba(253,245,230,0.05)] px-5 py-4">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={busy}
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-red)] disabled:opacity-40"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={busy}
                  className="rounded-full bg-[color:var(--color-brand-pink)] px-6 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-charcoal)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ letterSpacing: "1.5px" }}
                >
                  {state === "sending" ? "Sending..." : "Send"}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ChannelSwitcher({
  channel,
  onSwitch,
  disabled,
}: {
  channel: string;
  onSwitch: (ch: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-[color:var(--color-surface-2)] p-[2px]">
      <ChannelButton
        label="Email"
        active={channel === "email"}
        onClick={() => onSwitch("email")}
        disabled={disabled || channel === "email"}
      />
      <ChannelButton
        label="SMS"
        active={channel === "sms"}
        onClick={() => onSwitch("sms")}
        disabled={disabled || channel === "sms"}
      />
    </div>
  );
}

function ChannelButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-2.5 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors duration-[180ms] disabled:cursor-default ${
        active
          ? "bg-[color:var(--color-surface-3)] text-[color:var(--color-brand-cream)]"
          : "text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
      }`}
      style={{ letterSpacing: "1.2px" }}
    >
      {label}
    </button>
  );
}
