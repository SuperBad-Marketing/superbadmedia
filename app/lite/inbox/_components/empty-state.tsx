"use client";

import type { InboxView } from "../_queries/list-threads";

/**
 * Spec §4.6 — voice-treated empty surfaces. Copy per UI-8 brief §2:
 * focus is spec-verbatim; rest are authored for UI-8 and swappable.
 */
const COPY: Record<
  InboxView,
  { eyebrow: string; headline: string; sub: string }
> = {
  focus: {
    eyebrow: "Focus",
    headline: "Nothing waiting.",
    sub: "Go make something.",
  },
  all: {
    eyebrow: "All",
    headline: "Clean slate.",
    sub: "First time this ever happened.",
  },
  noise: {
    eyebrow: "Noise",
    headline: "Silence.",
    sub: "Suspiciously quiet.",
  },
  support: {
    eyebrow: "Support",
    headline: "No tickets.",
    sub: "Don't jinx it.",
  },
  drafts: {
    eyebrow: "Drafts",
    headline: "No half-finished sentences.",
    sub: "That's a first.",
  },
  sent: {
    eyebrow: "Sent",
    headline: "Nothing out the door.",
    sub: "Go write something.",
  },
  snoozed: {
    eyebrow: "Snoozed",
    headline: "Nothing on ice.",
    sub: "The future's wide open.",
  },
  trash: {
    eyebrow: "Trash",
    headline: "Empty bin.",
    sub: "Nothing to regret.",
  },
  spam: {
    eyebrow: "Spam",
    headline: "No junk.",
    sub: "The filter's earning its keep.",
  },
};

export function EmptyState({ view }: { view: InboxView }) {
  const copy = COPY[view];
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {copy.eyebrow}
      </span>
      <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
        {copy.headline}
      </h2>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
        {copy.sub}
      </em>
    </div>
  );
}
