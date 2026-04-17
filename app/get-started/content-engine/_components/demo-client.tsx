"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { runContentEngineDemo, type DemoResult } from "../actions";

const HOUSESPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

export function ContentEngineDemoClient() {
  const [vertical, setVertical] = useState("");
  const [locationLocked, setLocationLocked] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vertical.trim()) return;

    startTransition(async () => {
      const res = await runContentEngineDemo({ vertical: vertical.trim(), locationLocked });
      setResult(res);
    });
  }

  return (
    <div className="space-y-8">
      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="vertical"
            className="mb-1.5 block text-sm font-medium text-foreground/70"
          >
            What does your business do?
          </label>
          <input
            id="vertical"
            type="text"
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            placeholder="e.g. Landscape architecture, Coffee roasting, Family law"
            className="border-border bg-surface-1 w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-brand-pink"
            disabled={isPending}
            maxLength={100}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={locationLocked}
            onClick={() => setLocationLocked(!locationLocked)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              locationLocked ? "bg-brand-pink" : "bg-neutral-300"
            }`}
            disabled={isPending}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                locationLocked ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span className="text-sm text-foreground/70">
            Local audience only
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending || !vertical.trim()}
          className="bg-brand-pink hover:bg-brand-pink/90 w-full rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {isPending ? "Working on it..." : "Show me what this looks like"}
        </button>
      </form>

      {/* Loading state */}
      <AnimatePresence>
        {isPending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={HOUSESPRING}
            className="space-y-3 text-sm text-foreground/50"
          >
            <p>Researching keywords for your vertical...</p>
            <p>Scoring rankability...</p>
            <p>Drafting an outline...</p>
            <p>Writing an excerpt in our voice...</p>
            <div className="bg-surface-1 h-1 overflow-hidden rounded-full">
              <motion.div
                className="bg-brand-pink h-full rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "85%" }}
                transition={{ duration: 8, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && !isPending && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={HOUSESPRING}
          >
            {result.ok ? (
              <div className="space-y-6">
                {/* Keyword + score */}
                <div className="border-border rounded-xl border p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
                    Target keyword
                  </p>
                  <p className="mt-1 text-lg font-semibold">{result.keyword}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="bg-surface-1 h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-brand-pink h-full rounded-full transition-all"
                        style={{ width: `${result.rankabilityScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground/60">
                      {result.rankabilityScore}/100 rankability
                    </span>
                  </div>
                </div>

                {/* Outline */}
                <div className="border-border rounded-xl border p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
                    Post outline
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {result.outline.sections.map((section, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-0.5 text-xs text-foreground/30">
                          {i + 1}.
                        </span>
                        {section}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-foreground/40">
                    ~{result.outline.wordCount} words
                    {result.outline.snippetOpportunity &&
                      " · featured snippet opportunity"}
                  </p>
                </div>

                {/* Content gaps */}
                {result.gaps.length > 0 && (
                  <div className="border-border rounded-xl border p-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
                      What your competitors are missing
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {result.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-foreground/70">
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Excerpt */}
                <div className="border-border rounded-xl border p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
                    Here&apos;s how it would start
                  </p>
                  <div className="mt-3 text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
                    {result.excerpt}
                  </div>
                  <p className="mt-4 text-xs text-foreground/30 italic">
                    This is us talking about your area of expertise.
                    Imagine what could happen if our tool knew who you were.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-border rounded-xl border p-5">
                <p className="text-sm text-foreground/60">{result.error}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
