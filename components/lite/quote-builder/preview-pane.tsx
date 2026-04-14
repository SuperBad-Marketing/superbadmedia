"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type {
  QuoteContent,
  QuoteStructure,
  QuoteTotals,
} from "@/lib/quote-builder/content-shape";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Simple stable JSON hash (djb2-style, no crypto dep) — used to key
 * `AnimatePresence` so only the dirty preview block crossfades.
 * Collision risk for 100+ char strings is irrelevant here — if it
 * collides we miss one crossfade, nothing semantic.
 */
function blockHash(value: unknown): string {
  const s = JSON.stringify(value) ?? "";
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

const PREVIEW_DEBOUNCE_MS = 300;
const CROSSFADE_DURATION_S = 0.22;
const DEVICE_ANIM_DURATION_S = 0.38;

type PreviewDevice = "desktop" | "mobile";

type PreviewProps = {
  content: QuoteContent;
  totals: QuoteTotals;
  structure: QuoteStructure;
  quoteNumber: string;
  companyName: string;
  device: PreviewDevice;
};

/**
 * Debounced mirror of the live editor content. Re-renders on any content
 * mutation after a 300ms settle — matches spec §4.1 motion block.
 */
function useDebouncedPreview(content: QuoteContent): QuoteContent {
  const [settled, setSettled] = React.useState(content);
  React.useEffect(() => {
    const t = setTimeout(() => setSettled(content), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [content]);
  return settled;
}

export function PreviewPane(props: PreviewProps) {
  const debouncedContent = useDebouncedPreview(props.content);
  // Totals/structure derived from live props would fight the debounce —
  // recompute them off the settled copy so every preview block lands at
  // the same instant.
  const { retainerMonthly, oneOff, total } = React.useMemo(() => {
    let retainer = 0;
    let off = 0;
    let hasR = false;
    let hasO = false;
    for (const item of debouncedContent.sections.whatWellDo.line_items) {
      const line = item.qty * item.unit_price_cents_inc_gst;
      if (item.kind === "retainer") {
        retainer += line;
        hasR = true;
      } else {
        off += line;
        hasO = true;
      }
    }
    return {
      retainerMonthly: hasR ? retainer : null,
      oneOff: hasO ? off : null,
      total: retainer + off,
    };
  }, [debouncedContent]);

  const reduced = useReducedMotion();
  const deviceTransition = reduced
    ? { duration: 0.02 }
    : { ...HOUSE_SPRING, duration: DEVICE_ANIM_DURATION_S };

  return (
    <motion.div
      layout
      transition={deviceTransition}
      animate={{ maxWidth: props.device === "mobile" ? 380 : 720 }}
      className={cn(
        "mx-auto overflow-hidden rounded-lg border border-border bg-[#faf6ef] text-neutral-900 shadow-sm",
      )}
      style={{ maxWidth: props.device === "mobile" ? 380 : 720 }}
      data-testid="quote-preview-pane"
      data-device={props.device}
    >
      <div className="border-b border-neutral-200 px-6 py-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          SuperBad · {props.quoteNumber}
        </div>
        <div className="mt-1 font-serif text-lg italic">
          For {props.companyName}
        </div>
      </div>

      <PreviewBlock index={1} title="What you told us" signal={debouncedContent.sections.whatYouToldUs} reduced={!!reduced}>
        <p className="whitespace-pre-wrap text-sm">
          {debouncedContent.sections.whatYouToldUs.prose || (
            <span className="italic text-neutral-400">
              Your context will land here.
            </span>
          )}
        </p>
      </PreviewBlock>

      <PreviewBlock index={2} title="What we'll do" signal={debouncedContent.sections.whatWellDo} reduced={!!reduced}>
        {debouncedContent.sections.whatWellDo.line_items.length === 0 ? (
          <p className="italic text-neutral-400">No scope yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {debouncedContent.sections.whatWellDo.line_items.map((l) => (
              <li
                key={l.id}
                className="flex items-baseline justify-between gap-3"
              >
                <span>
                  <span className="font-medium">
                    {l.snapshot.name || <em>unnamed</em>}
                  </span>{" "}
                  <span className="text-xs text-neutral-500">
                    · {l.qty} {l.snapshot.unit}
                    {l.kind === "retainer" ? " / mo" : ""}
                  </span>
                </span>
                <span className="font-mono text-xs">
                  {formatMoney(l.qty * l.unit_price_cents_inc_gst)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {debouncedContent.sections.whatWellDo.prose && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">
            {debouncedContent.sections.whatWellDo.prose}
          </p>
        )}
      </PreviewBlock>

      <PreviewBlock index={3} title="Price" signal={{ retainerMonthly, oneOff, total }} reduced={!!reduced}>
        <dl className="space-y-1 text-sm">
          {retainerMonthly != null && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">Retainer / month</dt>
              <dd className="font-medium">{formatMoney(retainerMonthly)}</dd>
            </div>
          )}
          {oneOff != null && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">One-off total</dt>
              <dd className="font-medium">{formatMoney(oneOff)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-300 pt-1">
            <dt className="font-semibold">First invoice (inc GST)</dt>
            <dd className="font-semibold">{formatMoney(total)}</dd>
          </div>
        </dl>
      </PreviewBlock>

      <PreviewBlock index={4} title="Terms" signal={debouncedContent.sections.terms} reduced={!!reduced}>
        <p className="text-sm text-neutral-700">
          Standard terms apply. Cancel any time from your account — honour-based commitment.
        </p>
        {debouncedContent.sections.terms.overrides_prose && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-500">
            {debouncedContent.sections.terms.overrides_prose}
          </p>
        )}
      </PreviewBlock>

      <PreviewBlock index={5} title="Accept" signal="static" reduced={!!reduced}>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <input type="checkbox" disabled className="h-4 w-4" />
          <span>I agree to the terms</span>
        </div>
        <button
          type="button"
          disabled
          className="mt-3 cursor-not-allowed rounded-md bg-[#c1202d] px-4 py-2 text-sm font-medium text-white opacity-60"
        >
          Accept
        </button>
      </PreviewBlock>
    </motion.div>
  );
}

/**
 * Per-block crossfade wrapper. Only the block whose `signal` hash changed
 * re-keys; the rest are untouched per spec §4.1 ("dirty block detected by
 * section key, others untouched").
 */
function PreviewBlock(props: {
  index: number;
  title: string;
  signal: unknown;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const key = blockHash(props.signal);
  const transition = props.reduced
    ? { duration: 0.02, ease: "linear" as const }
    : { duration: CROSSFADE_DURATION_S, ease: "easeOut" as const };
  return (
    <section className="border-b border-neutral-200 px-6 py-5 last:border-b-0">
      <div className="mb-2 flex items-baseline gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        <span>§{props.index}</span>
        <span>{props.title}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          {props.children}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
