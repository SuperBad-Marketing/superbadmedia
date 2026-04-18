"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QueueDraft } from "@/lib/lead-gen/queries";
import { approveDraftAction, rejectDraftAction } from "../actions";

interface QueueListProps {
  drafts: QueueDraft[];
}

type TrackFilter = "all" | "saas" | "retainer";

export function QueueList({ drafts }: QueueListProps) {
  const [filter, setFilter] = useState<TrackFilter>("all");

  const filtered =
    filter === "all"
      ? drafts
      : drafts.filter((d) => d.candidate?.qualified_track === filter);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(["all", "retainer", "saas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-full border border-foreground bg-foreground/10 px-3 py-1 text-xs font-medium"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {f === "all" ? "All" : f === "saas" ? "SaaS" : "Retainer"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No drafts waiting for approval.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => (
            <QueueRow key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueRow({ draft }: { draft: QueueDraft }) {
  const [isPending, startTransition] = useTransition();
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

  function handleReject() {
    startTransition(async () => {
      await rejectDraftAction(draft.id);
    });
  }

  return (
    <div
      className={`rounded-lg border border-border bg-background p-4 transition-opacity ${
        isPending ? "opacity-50 pointer-events-none" : ""
      }`}
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

          <p className="text-sm font-medium mb-0.5">
            Subject: {draft.subject}
          </p>

          <p className="text-sm text-muted-foreground line-clamp-2">
            &ldquo;{bodyPreview}&hellip;&rdquo;
          </p>

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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {draft.status === "pending_approval" && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Approve &amp; Send
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
