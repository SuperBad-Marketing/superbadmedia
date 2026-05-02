"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { Pencil, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QueueDraft } from "@/lib/lead-gen/queries";
import {
  approveDraftAction,
  rejectDraftAction,
  updateDraftAction,
  sendNowAction,
} from "../actions";
import { NudgeSidecar } from "./nudge-sidecar";

interface QueueListProps {
  drafts: QueueDraft[];
  llmEnabled: boolean;
}

type TrackFilter = "all" | "saas" | "retainer";

export function QueueList({ drafts, llmEnabled }: QueueListProps) {
  const [filter, setFilter] = useState<TrackFilter>("all");
  const [nudgeDraftId, setNudgeDraftId] = useState<string | null>(null);

  const filtered =
    filter === "all"
      ? drafts
      : drafts.filter((d) => d.candidate?.qualified_track === filter);

  const nudgeDraft = nudgeDraftId
    ? drafts.find((d) => d.id === nudgeDraftId)
    : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(["all", "retainer", "saas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              letterSpacing: "1.5px",
              color:
                filter === f
                  ? "var(--color-brand-cream)"
                  : "var(--color-neutral-500)",
              background:
                filter === f
                  ? "rgba(178, 40, 72, 0.16)"
                  : "transparent",
              border:
                filter === f
                  ? "1px solid rgba(178, 40, 72, 0.35)"
                  : "1px solid rgba(253, 245, 230, 0.05)",
            }}
          >
            {f === "all" ? "All" : f === "saas" ? "SaaS" : "Retainer"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {filtered.length === 0 ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={houseSpring}
          className="rounded-[12px] px-8 py-10 text-center"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <p
            className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            Queue&apos;s clear.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
            nothing waiting on you.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((draft) => (
              <motion.div
                key={draft.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={houseSpring}
                layout
              >
                <QueueRow
                  draft={draft}
                  onNudge={() => setNudgeDraftId(draft.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {nudgeDraft && (
          <NudgeSidecar
            key={nudgeDraft.id}
            draftId={nudgeDraft.id}
            initialBody={nudgeDraft.body_markdown}
            llmEnabled={llmEnabled}
            onClose={() => setNudgeDraftId(null)}
            onApplied={() => setNudgeDraftId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QueueRow({
  draft,
  onNudge,
}: {
  draft: QueueDraft;
  onNudge: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [editBody, setEditBody] = useState(draft.body_markdown);
  const [editError, setEditError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const candidate = draft.candidate;
  const companyName = candidate?.company_name ?? "Unknown";
  const track = candidate?.qualified_track ?? "saas";
  const score =
    track === "retainer"
      ? candidate?.retainer_score
      : candidate?.saas_score;
  const touchLabel =
    draft.touch_kind === "first_touch"
      ? "first touch"
      : draft.touch_kind === "follow_up"
        ? `follow-up #${draft.touch_index}`
        : "stale nudge";

  const bodyPreview = draft.body_markdown.slice(0, 120);
  const isAutoQueued = draft.status === "approved_queued";
  const isDriftFlagged = draft.drift_check_flagged;
  const isInferred = candidate?.email_confidence === "inferred";
  const isBelowFloor = candidate?.below_floor_after_rescore;

  function handleApprove() {
    startTransition(async () => {
      await approveDraftAction(draft.id);
    });
  }

  function handleSendNow() {
    setSendError(null);
    startTransition(async () => {
      const result = await sendNowAction(draft.id);
      if (!result.ok) {
        setSendError(result.error);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectDraftAction(draft.id);
    });
  }

  function handleSaveEdit() {
    startTransition(async () => {
      setEditError(null);
      const result = await updateDraftAction(draft.id, editSubject, editBody);
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleCancelEdit() {
    setEditSubject(draft.subject);
    setEditBody(draft.body_markdown);
    setEditError(null);
    setEditing(false);
  }

  return (
    <div
      className={`rounded-[12px] p-5 transition-[opacity,transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)] ${
        isPending ? "opacity-50 pointer-events-none" : ""
      }`}
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid transparent",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{companyName}</span>
            <Badge variant="outline" className="text-xs">
              {track === "retainer" ? "Retainer" : "SaaS"}
            </Badge>
            {score != null && (
              <span className="text-xs text-muted-foreground">
                score {score}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{touchLabel}</span>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Subject
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Body
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-foreground"
                />
              </div>
              {editError && (
                <p className="text-xs text-red-500">{editError}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isPending}
                >
                  Save edits
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium mb-0.5">
                Subject: {draft.subject}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                &ldquo;{bodyPreview}&hellip;&rdquo;
              </p>
            </>
          )}

          <div className="mt-2 flex items-center gap-2">
            {isAutoQueued && (
              <Badge
                variant="outline"
                className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20"
              >
                auto-send queued
              </Badge>
            )}
            {isDriftFlagged && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20"
              >
                voice drift flagged
              </Badge>
            )}
            {isInferred && (
              <span className="text-xs text-muted-foreground">
                email: inferred
              </span>
            )}
            {isBelowFloor && (
              <Badge
                variant="outline"
                className="text-xs bg-red-500/10 text-red-500 border-red-500/20"
              >
                below floor after rescore
              </Badge>
            )}
          </div>
          {sendError && (
            <p className="mt-1 text-xs text-red-400">{sendError}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {draft.status === "pending_approval" && !editing && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={isPending}
                title="Edit draft"
              >
                <Pencil size={14} strokeWidth={1.75} className="mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onNudge}
                disabled={isPending}
                title="Nudge — LLM rewrite with your instructions"
              >
                <Sparkles size={14} strokeWidth={1.75} className="mr-1" />
                Nudge
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Approve &amp; Send
              </Button>
            </>
          )}
          {isAutoQueued && (
            <Button
              size="sm"
              onClick={handleSendNow}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Send Now
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={isPending}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
