"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Paperclip, Send, Sparkles, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  draftComposeIntent,
  saveComposeDraft,
  sendCompose,
  discardComposeDraft,
} from "@/app/lite/inbox/compose/actions";
import { searchContacts } from "../_queries/search-contacts";
import {
  AttachmentUpload,
  type AttachmentUploadFile,
} from "./attachment-upload";
import { encodeAttachmentsForUpload } from "./attachment-encode";
import { ContactPicker, type ContactSuggestion } from "./contact-picker";
import { RefineSidecar } from "./refine-sidecar";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";

export const COMPOSE_MODAL_MAX_WIDTH_PX = 720;

type Recipient = {
  contactId: string | null;
  companyId: string | null;
  email: string;
  name: string | null;
};

async function runSearch(q: string): Promise<ContactSuggestion[]> {
  const rows = await searchContacts(q);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    companyName: r.companyName,
  }));
}

export type ComposeModalVariant = "modal" | "fullscreen";

export function ComposeModal({
  open,
  onClose,
  sendEnabled,
  llmEnabled,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  sendEnabled: boolean;
  llmEnabled: boolean;
  variant?: ComposeModalVariant;
}) {
  const [recipient, setRecipient] = React.useState<Recipient | null>(null);
  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [sendingAddress] = React.useState("andy@");
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"idle" | "draft" | "send" | "save">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [sidecarOpen, setSidecarOpen] = React.useState(false);
  const [intent, setIntent] = React.useState("");
  const [intentVisible, setIntentVisible] = React.useState(false);
  const [attachments, setAttachments] = React.useState<AttachmentUploadFile[]>([]);
  const [attachOpen, setAttachOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  function resetAll() {
    setRecipient(null);
    setShowCcBcc(false);
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setDraftId(null);
    setError(null);
    setIntent("");
    setIntentVisible(false);
    setAttachments([]);
    setAttachOpen(false);
  }

  async function handleDraftIntent() {
    if (!intent.trim() || !recipient) {
      setError("Pick a recipient and a one-line intent first.");
      return;
    }
    setBusy("draft");
    setError(null);
    try {
      const result = await draftComposeIntent({
        intent,
        contactId: recipient.contactId,
        threadId: null,
        sendingAddress,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.draft.outcome === "generated") {
        setBody(result.draft.draft_body);
        setIntentVisible(false);
      } else if (result.draft.outcome === "skipped_kill_switch") {
        setError("Draft-for-me paused — LLM calls off.");
      } else {
        setError("Couldn't draft this time. Write it yourself and I'll refine.");
      }
    } finally {
      setBusy("idle");
    }
  }

  async function handleSend() {
    if (!recipient) {
      setError("Pick a recipient first.");
      return;
    }
    setBusy("send");
    setError(null);
    try {
      const encoded =
        attachments.length > 0
          ? await encodeAttachmentsForUpload(attachments)
          : undefined;
      const result = await sendCompose({
        threadId: null,
        contactId: recipient.contactId,
        companyId: recipient.companyId,
        to: [recipient.email],
        cc: cc.split(/[,;\s]+/).filter(Boolean),
        bcc: bcc.split(/[,;\s]+/).filter(Boolean),
        subject: subject.trim() || null,
        bodyText: body,
        sendingAddress,
        composeDraftId: draftId ?? null,
        attachments: encoded,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetAll();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That file didn't want to go. Try again or drop a different one.",
      );
    } finally {
      setBusy("idle");
    }
  }

  async function handleSave() {
    if (!recipient) {
      setError("Pick a recipient first.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const result = await saveComposeDraft({
        id: draftId,
        threadId: null,
        contactId: recipient.contactId,
        companyId: recipient.companyId,
        sendingAddress,
        to: [recipient.email],
        cc: cc.split(/[,;\s]+/).filter(Boolean),
        bcc: bcc.split(/[,;\s]+/).filter(Boolean),
        subject: subject.trim() || null,
        bodyText: body,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraftId(result.id);
    } finally {
      setBusy("idle");
    }
  }

  async function handleDiscard() {
    if (draftId) await discardComposeDraft(draftId);
    resetAll();
    onClose();
  }

  function handleAcceptRefined(
    newBody: string,
    _flags: DraftReplyLowConfidenceFlag[],
  ) {
    setBody(newBody);
  }

  const isFullscreen = variant === "fullscreen";

  return (
    <AnimatePresence>
      {open && (
        <>
          {!isFullscreen && (
            <motion.div
              key="compose-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/50"
              onClick={onClose}
            />
          )}
          <motion.div
            key="compose-modal"
            role="dialog"
            aria-label="Compose new message"
            initial={
              isFullscreen
                ? { opacity: 0, y: "100%" }
                : { opacity: 0, y: 12, scale: 0.98 }
            }
            animate={
              isFullscreen
                ? { opacity: 1, y: 0 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isFullscreen
                ? { opacity: 0, y: "100%" }
                : { opacity: 0, y: 8, scale: 0.98 }
            }
            className={cn(
              isFullscreen
                ? "fixed inset-0 z-40 flex flex-col bg-[color:var(--color-surface-1)]"
                : cn(
                    "fixed left-1/2 top-1/2 z-40 flex w-[min(92vw,45rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
                    "max-h-[85vh] overflow-hidden rounded-md border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] shadow-2xl",
                  ),
            )}
            style={
              isFullscreen
                ? undefined
                : { maxWidth: `${COMPOSE_MODAL_MAX_WIDTH_PX}px` }
            }
          >
            <header className="flex items-center justify-between border-b border-[color:var(--color-neutral-700)] px-5 py-4">
              <div className="flex flex-col">
                <span
                  className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "2px" }}
                >
                  Compose
                </span>
                <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
                  New message
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close compose"
                className="rounded-sm p-2 text-[color:var(--color-neutral-300)] outline-none hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-3">
                <div>
                  {recipient ? (
                    <div className="flex items-center justify-between rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
                          {recipient.name ?? recipient.email}
                        </span>
                        <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
                          {recipient.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecipient(null)}
                        className="rounded-sm px-2 py-1 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-100)]"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <ContactPicker
                      search={runSearch}
                      onPick={({ contactId, email, name }) => {
                        setRecipient({
                          contactId,
                          companyId: null,
                          email,
                          name,
                        });
                      }}
                    />
                  )}
                </div>

                {!showCcBcc && (
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(true)}
                    className="self-start font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-100)]"
                  >
                    + Cc / Bcc
                  </button>
                )}
                {showCcBcc && (
                  <div className="flex flex-col gap-2">
                    <input
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="Cc (comma-separated)"
                      className="rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none focus-visible:border-[color:var(--color-accent-cta)]"
                    />
                    <input
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="Bcc (comma-separated)"
                      className="rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none focus-visible:border-[color:var(--color-accent-cta)]"
                    />
                  </div>
                )}

                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (optional — I'll pick one at send time)"
                  className="rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none focus-visible:border-[color:var(--color-accent-cta)]"
                />

                {intentVisible && (
                  <div className="flex items-center gap-2">
                    <input
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      placeholder="One-line intent — what are you trying to say?"
                      className="flex-1 rounded-sm border border-[color:var(--color-accent-cta)]/40 bg-[color:var(--color-background)] px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none focus-visible:border-[color:var(--color-accent-cta)]"
                    />
                    <button
                      type="button"
                      onClick={handleDraftIntent}
                      disabled={!llmEnabled || busy !== "idle" || !intent.trim()}
                      className="flex items-center gap-1.5 rounded-sm bg-[color:var(--color-accent-cta)] px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={12} strokeWidth={1.75} aria-hidden />
                      {busy === "draft" ? "Drafting…" : "Draft"}
                    </button>
                  </div>
                )}

                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  placeholder="Write…"
                  className="min-h-[14rem] resize-y rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-background)] px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none focus-visible:border-[color:var(--color-accent-cta)]"
                />

                {(attachOpen || attachments.length > 0) && (
                  <AttachmentUpload
                    files={attachments}
                    onChange={setAttachments}
                    onError={(text) => setError(text)}
                    disabled={busy !== "idle"}
                  />
                )}

                {error && (
                  <p
                    role="alert"
                    className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-brand-pink)]"
                  >
                    {error}
                  </p>
                )}
              </div>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-[color:var(--color-neutral-700)] px-5 py-3">
              <button
                type="button"
                onClick={() => setIntentVisible((v) => !v)}
                disabled={!llmEnabled}
                title={!llmEnabled ? "Draft-for-me paused — LLM calls off." : undefined}
                className="flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={12} strokeWidth={1.75} aria-hidden />
                Draft this for me
              </button>
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                title={
                  attachments.length > 0
                    ? `${attachments.length} attached — click to manage`
                    : "Drop files into the reply"
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
                  attachments.length > 0
                    ? "text-[color:var(--color-accent-cta)]"
                    : "text-[color:var(--color-neutral-300)] hover:text-[color:var(--color-neutral-100)]",
                )}
              >
                <Paperclip size={12} strokeWidth={1.75} aria-hidden />
                {attachments.length > 0 ? `Attach · ${attachments.length}` : "Attach"}
              </button>
              <button
                type="button"
                disabled
                title="Sending new invites from Lite — coming later."
                className="flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)] opacity-50"
              >
                <CalendarDays size={12} strokeWidth={1.75} aria-hidden />
                Invite
              </button>
              <button
                type="button"
                onClick={() => setSidecarOpen(true)}
                disabled={!llmEnabled || body.trim().length === 0}
                className="flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={12} strokeWidth={1.75} aria-hidden />
                Refine
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-100)]"
                >
                  <Trash2 size={12} strokeWidth={1.75} aria-hidden />
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy !== "idle" || body.trim().length === 0}
                  className="flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save to drafts"}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!sendEnabled || busy !== "idle" || body.trim().length === 0 || !recipient}
                  title={
                    !sendEnabled
                      ? "Sending's paused — try again in a minute."
                      : undefined
                  }
                  className="flex items-center gap-1.5 rounded-sm bg-[color:var(--color-accent-cta)] px-4 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)] outline-none transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={12} strokeWidth={1.75} aria-hidden />
                  {busy === "send" ? "Sending…" : "Send"}
                </button>
              </div>
            </footer>

            <AnimatePresence>
              {sidecarOpen && (
                <RefineSidecar
                  priorDraft={body}
                  contactId={recipient?.contactId ?? null}
                  threadId={null}
                  sendingAddress={sendingAddress}
                  llmEnabled={llmEnabled}
                  onClose={() => setSidecarOpen(false)}
                  onAccept={(newBody, flags) => {
                    handleAcceptRefined(newBody, flags);
                    setSidecarOpen(false);
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
