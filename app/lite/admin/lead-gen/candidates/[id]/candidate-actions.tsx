"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  skipCandidateAction,
  unskipCandidateAction,
  updateCandidateTrackAction,
  deleteCandidateAction,
  rerunEnrichmentAction,
  promoteCandidateToDealAction,
} from "../../actions";

interface CandidateActionsProps {
  candidateId: string;
  isSkipped: boolean;
  skipReason: string | null;
  currentTrack: string;
  isPromoted: boolean;
}

export function CandidateActions({
  candidateId,
  isSkipped,
  skipReason,
  currentTrack,
  isPromoted,
}: CandidateActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);

  function handleSkip() {
    if (!showSkipInput) {
      setShowSkipInput(true);
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await skipCandidateAction(candidateId, reason || "Manual skip");
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleUnskip() {
    startTransition(async () => {
      setError(null);
      const res = await unskipCandidateAction(candidateId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleTrackChange(track: "saas" | "retainer") {
    startTransition(async () => {
      setError(null);
      const res = await updateCandidateTrackAction(candidateId, track);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handlePromote() {
    startTransition(async () => {
      setError(null);
      const res = await promoteCandidateToDealAction(candidateId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleRerunEnrichment() {
    startTransition(async () => {
      setError(null);
      setEnrichResult(null);
      const res = await rerunEnrichmentAction(candidateId);
      if (!res.ok) setError(res.error);
      else {
        setEnrichResult(`${res.signalsSucceeded}/${res.signalsAttempted} signals`);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await deleteCandidateAction(candidateId);
      if (!res.ok) setError(res.error);
      else router.push("/lite/admin/lead-gen/candidates");
    });
  }

  if (isPromoted) {
    return (
      <div className="space-y-3">
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ backgroundColor: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.15)" }}
        >
          <span
            className="inline-block rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.2px", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#86efac" }}
          >
            Promoted
          </span>
          <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
            This candidate has been promoted to a deal.
          </span>
        </div>
        <div
          className="rounded-xl px-4 py-3"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.12)" }}
        >
          <div className="flex items-center gap-2">
            {showDeleteConfirm && (
              <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                Are you sure?
              </span>
            )}
            <button
              disabled={pending}
              onClick={handleDelete}
              className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110 cursor-pointer"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: showDeleteConfirm ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.08)",
                color: "#fca5a5",
              }}
            >
              {pending ? "..." : showDeleteConfirm ? "Confirm Delete" : "Delete Candidate"}
            </button>
            {showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)] cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
          {error && (
            <div className="mt-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Promote to deal */}
        <button
          disabled={pending}
          onClick={handlePromote}
          className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110 cursor-pointer"
          style={{
            letterSpacing: "1.2px",
            backgroundColor: "rgba(34, 197, 94, 0.12)",
            color: "#86efac",
          }}
        >
          {pending ? "..." : "Promote to Deal"}
        </button>

        <div className="h-5 w-px" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }} />

        {/* Track switcher */}
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.2px" }}
          >
            Track
          </span>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(253, 245, 230, 0.06)" }}>
            <button
              disabled={pending || currentTrack === "saas"}
              onClick={() => handleTrackChange("saas")}
              className="px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: currentTrack === "saas" ? "rgba(168, 85, 247, 0.15)" : "transparent",
                color: currentTrack === "saas" ? "#c084fc" : "var(--color-neutral-500)",
              }}
            >
              SaaS
            </button>
            <button
              disabled={pending || currentTrack === "retainer"}
              onClick={() => handleTrackChange("retainer")}
              className="px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: currentTrack === "retainer" ? "rgba(59, 130, 246, 0.15)" : "transparent",
                color: currentTrack === "retainer" ? "#93c5fd" : "var(--color-neutral-500)",
              }}
            >
              Retainer
            </button>
          </div>
        </div>

        <div className="h-5 w-px" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }} />

        {/* Skip / Unskip */}
        {isSkipped ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{ letterSpacing: "1.2px", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5" }}
            >
              Skipped
            </span>
            {skipReason && (
              <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                {skipReason}
              </span>
            )}
            <button
              disabled={pending}
              onClick={handleUnskip}
              className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(253, 245, 230, 0.06)",
                color: "var(--color-brand-cream)",
              }}
            >
              {pending ? "..." : "Restore"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {showSkipInput && (
              <input
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] outline-none"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.04)",
                  border: "1px solid rgba(253, 245, 230, 0.08)",
                  width: "200px",
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSkip(); }}
              />
            )}
            <button
              disabled={pending}
              onClick={handleSkip}
              className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                color: "#fca5a5",
              }}
            >
              {pending ? "..." : "Skip"}
            </button>
            {showSkipInput && (
              <button
                onClick={() => { setShowSkipInput(false); setReason(""); }}
                className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        <div className="h-5 w-px" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }} />

        {/* Re-run enrichment */}
        <div className="flex items-center gap-2">
          <button
            disabled={pending}
            onClick={handleRerunEnrichment}
            className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110"
            style={{
              letterSpacing: "1.2px",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              color: "#93c5fd",
            }}
          >
            {pending ? "Enriching..." : "Re-run Enrichment"}
          </button>
          {enrichResult && (
            <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
              {enrichResult}
            </span>
          )}
        </div>

        <div className="h-5 w-px" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }} />

        {/* Delete */}
        <div className="flex items-center gap-2">
          {showDeleteConfirm && (
            <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
              Are you sure?
            </span>
          )}
          <button
            disabled={pending}
            onClick={handleDelete}
            className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:brightness-110"
            style={{
              letterSpacing: "1.2px",
              backgroundColor: showDeleteConfirm ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.08)",
              color: "#fca5a5",
            }}
          >
            {pending ? "..." : showDeleteConfirm ? "Confirm Delete" : "Delete"}
          </button>
          {showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
          {error}
        </div>
      )}
    </div>
  );
}
