"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Save, Send, Sparkles, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";
import {
  sendCompose,
  saveComposeDraft,
  discardComposeDraft,
  pollCachedDraft,
  regenerateCachedDraft,
} from "@/app/lite/inbox/compose/actions";
import { LowConfidenceFlags } from "./low-confidence-flags";
import { RefineSidecar } from "./refine-sidecar";

export const POLL_STALE_MS = 30_000;

export type ReplyComposerProps = {
  threadId: string;
  contactId: string | null;
  companyId: string | null;
  toAddresses: string[];
  sendingAddress: string;
  subject: string | null;
  cachedDraftBody: string | null;
  cachedDraftStale: boolean;
  lowConfidenceFlags: DraftReplyLowConfidenceFlag[];
  sendEnabled: boolean;
  llmEnabled: boolean;
};

type ToastState =
  | { kind: "idle" }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

export function ReplyComposer(props: ReplyComposerProps) {
  const [body, setBody] = React.useState<string>(props.cachedDraftBody ?? "");
  const [flags, setFlags] = React.useState<DraftReplyLowConfidenceFlag[]>(
    props.lowConfidenceFlags,
  );
  const [dirty, setDirty] = React.useState(false);
  const [stale, setStale] = React.useState(props.cachedDraftStale);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sidecarOpen, setSidecarOpen] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>({ kind: "idle" });
  const [draftId, setDraftId] = React.useState<string | null>(null);

  const initialBodyRef = React.useRef(props.cachedDraftBody ?? "");
  const dirtyRef = React.useRef(false);
  const bodyRef = React.useRef(props.cachedDraftBody ?? "");
  const [regenBusy, setRegenBusy] = React.useState(false);

  // Mirror state into refs so the polling tick can read current values
  // without re-subscribing the interval on every keystroke.
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  React.useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  // Rehydrate **only when the thread swaps** — never on cachedDraft* prop
  // flips. Spec §16 #60 + brief §12.8: Andy's in-progress edits must not
  // be clobbered by a server-driven re-render. Polling below handles
  // post-dirty → post-clean re-hydration explicitly.
  React.useEffect(() => {
    initialBodyRef.current = props.cachedDraftBody ?? "";
    bodyRef.current = props.cachedDraftBody ?? "";
    setBody(props.cachedDraftBody ?? "");
    setFlags(props.lowConfidenceFlags);
    setStale(props.cachedDraftStale);
    setDirty(false);
    setSidecarOpen(false);
    setDraftId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.threadId]);

  // 30s poll for stale-flag + body updates. Non-clobbering: if Andy has
  // edited, we update the stale flag but leave his body alone. Once he
  // discards or sends (dirty → false) the next tick will rehydrate.
  React.useEffect(() => {
    const id = setInterval(async () => {
      const result = await pollCachedDraft(props.threadId);
      if (!result.ok) return;
      setStale(result.stale);
      if (!dirtyRef.current && result.body !== null && result.body !== bodyRef.current) {
        initialBodyRef.current = result.body;
        bodyRef.current = result.body;
        setBody(result.body);
        setFlags(result.flags);
      }
    }, POLL_STALE_MS);
    return () => clearInterval(id);
  }, [props.threadId]);

  const sendDisabled = !props.sendEnabled || sending || body.trim().length === 0;
  const llmDisabled = !props.llmEnabled;

  async function handleSend() {
    setSending(true);
    setToast({ kind: "idle" });
    try {
      const result = await sendCompose({
        threadId: props.threadId,
        contactId: props.contactId,
        companyId: props.companyId,
        to: props.toAddresses,
        subject: props.subject,
        bodyText: body,
        sendingAddress: props.sendingAddress,
        composeDraftId: draftId ?? null,
      });
      if (result.ok) {
        setToast({ kind: "ok", text: "Sent." });
        setBody("");
        setFlags([]);
        setDirty(false);
        setDraftId(null);
      } else {
        setToast({ kind: "error", text: result.error });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setToast({ kind: "idle" });
    try {
      const result = await saveComposeDraft({
        id: draftId,
        threadId: props.threadId,
        contactId: props.contactId,
        companyId: props.companyId,
        sendingAddress: props.sendingAddress,
        to: props.toAddresses,
        subject: props.subject,
        bodyText: body,
      });
      if (result.ok) {
        setDraftId(result.id);
        setToast({ kind: "ok", text: "Draft saved." });
      } else {
        setToast({ kind: "error", text: result.error });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    if (draftId) {
      await discardComposeDraft(draftId);
      setDraftId(null);
    }
    setBody("");
    setFlags([]);
    setDirty(false);
    setToast({ kind: "ok", text: "Discarded." });
  }

  async function handleRegenerate() {
    if (regenBusy) return;
    setRegenBusy(true);
    setToast({ kind: "idle" });
    try {
      const result = await regenerateCachedDraft(props.threadId);
      if (result.ok) {
        setStale(false);
        setToast({
          kind: "ok",
          text: "Fresh draft on the way — it'll land shortly.",
        });
      } else {
        setToast({ kind: "error", text: result.error });
      }
    } finally {
      setRegenBusy(false);
    }
  }

  function handleAcceptRefined(
    newBody: string,
    newFlags: DraftReplyLowConfidenceFlag[],
  ) {
    setBody(newBody);
    setFlags(newFlags);
    setDirty(true);
  }

  return (
    <section
      aria-label="Reply composer"
      className="flex flex-col gap-2 border-t border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] p-4"
    >
      <AnimatePresence>
        {stale && (
          <motion.div
            key="stale-banner"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              "flex items-center gap-2 rounded-sm border border-[color:var(--color-brand-pink)]/40 bg-[color:var(--color-brand-pink)]/10 px-3 py-1.5",
            )}
            role="status"
          >
            <AlertTriangle
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className="text-[color:var(--color-brand-pink)]"
            />
            <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]">
              New message arrived — regenerate draft?
            </span>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenBusy || !props.llmEnabled}
              title={
                !props.llmEnabled
                  ? "Regenerate's paused — LLM calls off."
                  : undefined
              }
              className={cn(
                "ml-auto flex items-center gap-1 rounded-sm px-2 py-0.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-accent-cta)] hover:bg-[color:var(--color-surface-2)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <RefreshCw size={10} strokeWidth={1.75} aria-hidden />
              {regenBusy ? "Queuing…" : "Regenerate"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {flags.length > 0 && !dirty && (
        <div className="rounded-sm border border-[color:var(--color-brand-pink)]/30 bg-[color:var(--color-surface-2)]/40 px-3 py-2">
          <p
            className="mb-1 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-brand-pink)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Check before sending
          </p>
          <LowConfidenceFlags body={body} flags={flags} />
        </div>
      )}

      <textarea
        aria-label="Reply body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setDirty(true);
        }}
        rows={6}
        className={cn(
          "min-h-[8rem] resize-y rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]",
          "outline-none focus-visible:border-[color:var(--color-accent-cta)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]/30",
        )}
        placeholder="Your reply…"
      />

      {toast.kind !== "idle" && (
        <p
          role="status"
          className={cn(
            "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
            toast.kind === "error"
              ? "text-[color:var(--color-brand-red)]"
              : "text-[color:var(--color-neutral-300)]",
          )}
        >
          {toast.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSidecarOpen(true)}
          disabled={llmDisabled || body.trim().length === 0}
          title={
            llmDisabled
              ? "Refine's paused — LLM calls off."
              : body.trim().length === 0
                ? "Write something first."
                : "Refine this draft"
          }
          className={cn(
            "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5",
            "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]",
            "outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Sparkles size={12} strokeWidth={1.75} aria-hidden />
          Refine
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={sending || body.trim().length === 0}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1.5",
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]",
              "outline-none transition-colors hover:text-[color:var(--color-neutral-100)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Trash2 size={12} strokeWidth={1.75} aria-hidden />
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || body.trim().length === 0}
            className={cn(
              "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5",
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]",
              "outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Save size={12} strokeWidth={1.75} aria-hidden />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDisabled}
            title={
              !props.sendEnabled
                ? "Sending's paused — try again in a minute."
                : body.trim().length === 0
                  ? "Write something first."
                  : "Send reply"
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
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {sidecarOpen && (
          <RefineSidecar
            priorDraft={body}
            contactId={props.contactId}
            threadId={props.threadId}
            sendingAddress={props.sendingAddress}
            llmEnabled={props.llmEnabled}
            onClose={() => setSidecarOpen(false)}
            onAccept={(newBody, newFlags) => {
              handleAcceptRefined(newBody, newFlags);
              setSidecarOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
