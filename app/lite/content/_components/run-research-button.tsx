"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Check, X, SkipForward, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { runKeywordResearchAction } from "../actions";
import type { ResearchProgressEvent, ResearchStage } from "@/lib/content-engine/research-progress";

interface RunResearchButtonProps {
  companyId: string;
}

const STAGE_LABELS: Record<ResearchStage, string> = {
  started: "Starting research",
  fetching_serp: "Fetching search results",
  scoring: "Scoring rankability",
  generating_outline: "Generating outline",
  keyword_done: "Done",
  keyword_skipped: "Skipped",
  keyword_error: "Failed",
  complete: "Research complete",
};

interface KeywordStatus {
  keyword: string;
  stage: ResearchStage;
  detail: string | null;
  error: string | null;
}

export function RunResearchButton({ companyId }: RunResearchButtonProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ResearchProgressEvent | null>(null);
  const [keywords, setKeywords] = useState<KeywordStatus[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  function connectSSE() {
    cleanup();
    const es = new EventSource("/api/admin/content-research-progress");
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ResearchProgressEvent;
        if (event.companyId !== companyId) return;

        setProgress(event);

        if (event.keyword) {
          const kw = event.keyword;
          setKeywords((prev) => {
            const existing = prev.findIndex(
              (k) => k.keyword === kw,
            );
            const entry: KeywordStatus = {
              keyword: kw,
              stage: event.stage,
              detail: event.detail,
              error: event.error,
            };
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = entry;
              return next;
            }
            return [...prev, entry];
          });
        }

        if (event.stage === "complete") {
          setSummary(event.detail);
          cleanup();
        }
      } catch {
        // Malformed event — ignore.
      }
    };

    es.onerror = () => {
      cleanup();
    };
  }

  async function handleClick() {
    setRunning(true);
    setProgress(null);
    setKeywords([]);
    setSummary(null);

    connectSSE();

    const res = await runKeywordResearchAction(companyId);
    setRunning(false);

    if (!res.ok) {
      setSummary(res.error);
      cleanup();
    }
  }

  const isActive = running || (progress !== null && progress.stage !== "complete");
  const pct =
    progress && progress.totalKeywords > 0
      ? Math.round((progress.currentIndex / progress.totalKeywords) * 100)
      : 0;

  return (
    <div className="space-y-3">
      {/* Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isActive}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40 disabled:pointer-events-none"
        style={{
          letterSpacing: "1.5px",
          borderColor: "var(--color-neutral-600)",
          color: "var(--color-neutral-300)",
          background: "transparent",
        }}
      >
        <Search size={12} strokeWidth={1.5} aria-hidden />
        {isActive ? "Researching…" : "Run Research"}
      </button>

      {/* Progress panel */}
      <AnimatePresence>
        {(isActive || keywords.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl p-4"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid rgba(253, 245, 230, 0.06)",
            }}
          >
            {/* Progress bar */}
            {progress && progress.totalKeywords > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    {progress.stage === "complete"
                      ? "Complete"
                      : `${progress.currentIndex} / ${progress.totalKeywords}`}
                  </span>
                  <span
                    className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-500)]"
                    style={{ letterSpacing: "1px" }}
                  >
                    {pct}%
                  </span>
                </div>
                <div
                  className="h-1 overflow-hidden rounded-full"
                  style={{ background: "rgba(253, 245, 230, 0.06)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--color-brand-pink)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            )}

            {/* Current stage label */}
            {progress && progress.stage !== "complete" && (
              <div className="mb-3 flex items-center gap-2">
                <Loader2
                  size={12}
                  className="animate-spin text-[color:var(--color-brand-pink)]"
                />
                <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)]">
                  {STAGE_LABELS[progress.stage]}
                  {progress.keyword && (
                    <>
                      {" — "}
                      <span className="text-[color:var(--color-brand-cream)]">
                        {progress.keyword}
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Keyword list */}
            {keywords.length > 0 && (
              <div className="space-y-1">
                {keywords.map((kw) => (
                  <div
                    key={kw.keyword}
                    className="flex items-start gap-2 py-0.5"
                  >
                    <KeywordIcon stage={kw.stage} />
                    <div className="min-w-0 flex-1">
                      <span
                        className="font-[family-name:var(--font-body)] text-[12px]"
                        style={{
                          color:
                            kw.stage === "keyword_error"
                              ? "var(--color-brand-red)"
                              : kw.stage === "keyword_done"
                                ? "var(--color-neutral-300)"
                                : "var(--color-neutral-400)",
                        }}
                      >
                        {kw.keyword}
                      </span>
                      {kw.detail && (
                        <span className="ml-2 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                          {kw.detail}
                        </span>
                      )}
                      {kw.error && (
                        <p className="mt-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-red)]">
                          {kw.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {summary && progress?.stage === "complete" && (
              <div className="mt-3 border-t border-[rgba(253,245,230,0.06)] pt-3">
                <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                  {summary}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KeywordIcon({ stage }: { stage: ResearchStage }) {
  const size = 12;
  const base = "mt-0.5 shrink-0";

  switch (stage) {
    case "keyword_done":
      return (
        <Check
          size={size}
          className={`${base} text-[color:var(--color-success)]`}
        />
      );
    case "keyword_error":
      return (
        <X
          size={size}
          className={`${base} text-[color:var(--color-brand-red)]`}
        />
      );
    case "keyword_skipped":
      return (
        <SkipForward
          size={size}
          className={`${base} text-[color:var(--color-neutral-500)]`}
        />
      );
    default:
      return (
        <Loader2
          size={size}
          className={`${base} animate-spin text-[color:var(--color-brand-pink)]`}
        />
      );
  }
}
