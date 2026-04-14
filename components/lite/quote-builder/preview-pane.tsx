"use client";

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
 * Static preview pane — QB-2a ships a read-only approximation of the client
 * quote page. Motion, scroll-snap, debounce and full brand typography land
 * in QB-2b.
 */
export function PreviewPane(props: {
  content: QuoteContent;
  totals: QuoteTotals;
  structure: QuoteStructure;
  quoteNumber: string;
  companyName: string;
  device: "desktop" | "mobile";
}) {
  const { content, totals } = props;
  return (
    <div
      className={cn(
        "mx-auto overflow-hidden rounded-lg border border-border bg-[#faf6ef] text-neutral-900 shadow-sm",
        props.device === "mobile" ? "max-w-[380px]" : "max-w-full",
      )}
    >
      <div className="border-b border-neutral-200 px-6 py-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          SuperBad · {props.quoteNumber}
        </div>
        <div className="mt-1 font-serif text-lg italic">
          For {props.companyName}
        </div>
      </div>

      <PreviewSection index={1} title="What you told us">
        <p className="whitespace-pre-wrap text-sm">
          {content.sections.whatYouToldUs.prose || (
            <span className="italic text-neutral-400">
              Your context will land here.
            </span>
          )}
        </p>
      </PreviewSection>

      <PreviewSection index={2} title="What we'll do">
        {content.sections.whatWellDo.line_items.length === 0 ? (
          <p className="italic text-neutral-400">
            No scope yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {content.sections.whatWellDo.line_items.map((l) => (
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
        {content.sections.whatWellDo.prose && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">
            {content.sections.whatWellDo.prose}
          </p>
        )}
      </PreviewSection>

      <PreviewSection index={3} title="Price">
        <dl className="space-y-1 text-sm">
          {totals.retainer_monthly_cents_inc_gst != null && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">Retainer / month</dt>
              <dd className="font-medium">
                {formatMoney(totals.retainer_monthly_cents_inc_gst)}
              </dd>
            </div>
          )}
          {totals.one_off_cents_inc_gst != null && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">One-off total</dt>
              <dd className="font-medium">
                {formatMoney(totals.one_off_cents_inc_gst)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-300 pt-1">
            <dt className="font-semibold">First invoice (inc GST)</dt>
            <dd className="font-semibold">
              {formatMoney(totals.total_cents_inc_gst)}
            </dd>
          </div>
        </dl>
      </PreviewSection>

      <PreviewSection index={4} title="Terms">
        <p className="text-sm text-neutral-700">
          Standard terms apply. Cancel any time from your account —
          honour-based commitment.
        </p>
        {content.sections.terms.overrides_prose && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-500">
            {content.sections.terms.overrides_prose}
          </p>
        )}
      </PreviewSection>

      <PreviewSection index={5} title="Accept">
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
      </PreviewSection>
    </div>
  );
}

function PreviewSection(props: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-neutral-200 px-6 py-5 last:border-b-0">
      <div className="mb-2 flex items-baseline gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        <span>§{props.index}</span>
        <span>{props.title}</span>
      </div>
      {props.children}
    </section>
  );
}
