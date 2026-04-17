"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  prepareSendQuoteAction,
  sendQuoteAction,
  type PrepareSendQuoteResult,
} from "@/app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions";
import {
  QuoteWebExperience,
  type QuoteWebExperienceProps,
} from "./quote-web-experience";

type Drift = Extract<PrepareSendQuoteResult, { ok: true }>["value"]["drift"];

/** Props the editor passes to render the §4.3 page in the modal's left column. */
export type SendModalPreview = Omit<QuoteWebExperienceProps, "mode" | "token">;

interface SendQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  quoteId: string;
  /** Snapshot of what the client will see — rendered in left column. */
  preview: SendModalPreview;
  /** Called after a successful send so the editor can navigate / refresh. */
  onSent?: () => void;
}

const SUBJECT_MAX = 60;

/**
 * Send modal — composes the email via Claude, lets Andy review/edit, then
 * fires `sendQuoteAction`. Drift indicator surfaces the brand-voice
 * grade. `quote_send` is transactional so quiet-window status is implicit
 * ("sends now"); kept simple per `feedback_primary_action_focus`.
 */
export function SendQuoteModal(props: SendQuoteModalProps) {
  const { open, onOpenChange, dealId, quoteId, preview, onSent } = props;
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<{
    subject: string;
    bodyParagraphs: string[];
    recipientEmail: string;
    recipientName: string;
    drift: Drift;
    fallbackUsed: boolean;
    quoteUrl: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setDraft(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    prepareSendQuoteAction({ quote_id: quoteId })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setDraft({
          subject: res.value.subject,
          bodyParagraphs: res.value.bodyParagraphs,
          recipientEmail: res.value.recipientEmail,
          recipientName: res.value.recipientName,
          drift: res.value.drift,
          fallbackUsed: res.value.fallbackUsed,
          quoteUrl: res.value.quoteUrl,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, quoteId]);

  async function onSend() {
    if (!draft) return;
    if (!draft.recipientEmail) {
      setError("Primary contact has no email — fix on the deal first.");
      return;
    }
    setSending(true);
    setError(null);
    const res = await sendQuoteAction({
      deal_id: dealId,
      quote_id: quoteId,
      to: draft.recipientEmail,
      subject: draft.subject,
      bodyParagraphs: draft.bodyParagraphs,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Quote sent.");
    onOpenChange(false);
    onSent?.();
  }

  const driftBadge = (() => {
    if (!draft) return null;
    const pass = draft.drift.pass;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
          pass
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        )}
        title={draft.drift.notes}
      >
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            pass ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        {pass ? "On voice" : "Drift detected"} · {(draft.drift.score * 100).toFixed(0)}%
      </span>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Send quote</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <aside
            className="hidden max-h-[60vh] overflow-y-auto rounded-md border border-border lg:block"
            aria-label="Preview of what the client will see"
          >
            <QuoteWebExperience
              mode="modal-preview"
              token=""
              {...preview}
            />
          </aside>

          <div>

        {loading && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Drafting…
          </div>
        )}

        {!loading && error && !draft && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && draft && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  To
                </div>
                <div>
                  {draft.recipientName}
                  {draft.recipientEmail && (
                    <span className="text-muted-foreground"> · {draft.recipientEmail}</span>
                  )}
                </div>
              </div>
              {driftBadge}
            </div>

            {draft.fallbackUsed && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                LLM kill switch is off — using the deterministic fallback draft.
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Subject
              </label>
              <Input
                value={draft.subject}
                maxLength={SUBJECT_MAX + 20}
                onChange={(e) =>
                  setDraft({ ...draft, subject: e.target.value })
                }
              />
              <div
                className={cn(
                  "text-right text-xs",
                  draft.subject.length > SUBJECT_MAX
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              >
                {draft.subject.length} / {SUBJECT_MAX}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Body
              </label>
              {draft.bodyParagraphs.map((p, i) => (
                <Textarea
                  key={i}
                  value={p}
                  onChange={(e) => {
                    const next = [...draft.bodyParagraphs];
                    next[i] = e.target.value;
                    setDraft({ ...draft, bodyParagraphs: next });
                  }}
                  className="min-h-[60px]"
                />
              ))}
              <div className="text-xs text-muted-foreground">
                Sign-off &quot;Andy&quot; + a &quot;Read your quote →&quot; button are appended automatically.
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={!draft || sending || loading}
            className="bg-[#c1202d] text-white hover:bg-[#a81a25]"
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
