"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SparklesIcon, ArrowRightIcon, RefreshCwIcon } from "lucide-react";
import {
  getDiscoverySuggestionsAction,
  type DiscoverySuggestion,
} from "../actions";

export function DiscoverySuggestions() {
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const res = await getDiscoverySuggestionsAction();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSuggestions(res.suggestions);
    setHasLoaded(true);
  }

  if (!hasLoaded) {
    return (
      <div
        className="mx-4 mt-6 rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-[color:var(--color-brand-pink)]" />
              <span
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Today&apos;s picks
              </span>
            </div>
            <p className="mt-2 max-w-md font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
              AI-suggested business types to search — split by retainer vs SaaS
              fit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="shrink-0 rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-all"
            style={{
              backgroundColor: "var(--color-brand-pink)",
              color: "var(--color-neutral-900)",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Thinking…" : "Show picks"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-6 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-[color:var(--color-brand-pink)]" />
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Today&apos;s picks
          </span>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCwIcon className="h-3 w-3" />
          {loading ? "Thinking…" : "Refresh"}
        </button>
      </div>

      {suggestions?.map((s, i) => (
        <SuggestionCard key={`${s.category}-${i}`} suggestion={s} />
      ))}
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: DiscoverySuggestion }) {
  const trackColor =
    suggestion.track === "retainer"
      ? "var(--color-brand-pink)"
      : "var(--color-brand-cream)";

  return (
    <div
      className="group rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-4 transition-colors hover:border-[color:var(--color-neutral-600)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{ letterSpacing: "1.5px", color: trackColor }}
            >
              {suggestion.track}
            </span>
            <span className="text-[color:var(--color-neutral-600)]">·</span>
            <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
              {suggestion.category}
            </span>
          </div>
          <p className="mt-1.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-400)]">
            {suggestion.rationale}
          </p>
        </div>
        <a
          href={`/lite/admin/lead-gen/settings?prefill_category=${encodeURIComponent(suggestion.category)}&prefill_brief=${encodeURIComponent(suggestion.standingBrief)}&prefill_track=${suggestion.track}`}
          className="shrink-0 rounded-lg p-2 text-[color:var(--color-neutral-500)] transition-colors group-hover:text-[color:var(--color-brand-pink)]"
          title="Use this suggestion"
        >
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
