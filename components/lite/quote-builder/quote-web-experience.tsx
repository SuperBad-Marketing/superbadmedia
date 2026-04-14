"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";
import type { QuoteContent } from "@/lib/quote-builder/content-shape";
import type { QuoteStatus } from "@/lib/db/schema/quotes";
import {
  QuoteAcceptBlock,
  type AcceptPhase,
} from "./quote-accept-block";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type QuoteWebExperienceProps = {
  token: string;
  status: QuoteStatus;
  quoteNumber: string;
  companyName: string;
  primaryContactFirstName: string | null;
  content: QuoteContent;
  termLengthMonths: number | null;
  retainerMonthlyCents: number | null;
  oneOffCents: number | null;
  totalCents: number;
  expiresAtMs: number | null;
  /** Billing mode of the company — determines Stripe vs manual accept flow. */
  paymentMode?: "stripe" | "manual";
  /**
   * `live` is the real client-facing surface (default).
   * `modal-preview` renders a non-interactive snapshot for the Send modal:
   * stacked sections, no scroll-snap, Accept disabled, no view tracking.
   */
  mode?: "live" | "modal-preview";
};

const SECTION_LABELS = [
  "What you told us",
  "What we'll do",
  "Price",
  "Terms",
  "Accept",
] as const;

export function QuoteWebExperience(props: QuoteWebExperienceProps) {
  const mode = props.mode ?? "live";
  const isPreview = mode === "modal-preview";
  const paymentMode = props.paymentMode ?? "stripe";
  const [activeSection, setActiveSection] = React.useState(1);
  const [acceptPhase, setAcceptPhase] = React.useState<AcceptPhase>(
    props.status === "accepted" ? "confirmed" : "idle",
  );
  const sectionRefs = React.useRef<(HTMLElement | null)[]>([]);
  const reduced = useReducedMotion();
  const dimBackdrop = acceptPhase === "payment" || acceptPhase === "confirming";

  // Stepper observer — skip in preview mode (no scroll-snap to track).
  React.useEffect(() => {
    if (isPreview) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.sectionIndex ?? 1,
            );
            setActiveSection(idx);
          }
        }
      },
      { threshold: 0.5 },
    );
    for (const el of sectionRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [isPreview]);

  function jumpTo(index: number) {
    const el = sectionRefs.current[index - 1];
    if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <div
      className="quote-surface min-h-screen w-full"
      style={{
        backgroundColor: "var(--brand-cream)",
        color: "var(--brand-charcoal)",
        fontFamily: "var(--font-body)",
      }}
      data-mode={mode}
    >
      {/* Sticky stepper — hidden in preview */}
      {!isPreview && (
        <Stepper
          active={activeSection}
          onJump={jumpTo}
          locked={acceptPhase !== "idle" && acceptPhase !== "confirmed"}
        />
      )}

      <div
        className={
          isPreview
            ? "mx-auto max-w-3xl"
            : "mx-auto max-w-3xl snap-y snap-proximity overflow-y-auto"
        }
        style={isPreview ? undefined : { height: "100vh", scrollSnapType: "y proximity" }}
        data-accept-phase={acceptPhase}
      >
        {/* Hero */}
        <header
          className={
            (isPreview ? "px-6 py-8" : "snap-start px-6 pt-16 pb-8 md:pt-24")
          }
        >
          <div
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: "color-mix(in srgb, var(--brand-charcoal) 55%, transparent)" }}
          >
            SuperBad · {props.quoteNumber}
          </div>
          <h1
            className="mt-3 text-4xl leading-[1.05] md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
            data-bhs-location="quote_page_hero"
          >
            For {props.companyName}
          </h1>
          <p
            className="mt-3 text-lg italic"
            style={{
              fontFamily: "var(--font-narrative)",
              color: "color-mix(in srgb, var(--brand-charcoal) 70%, transparent)",
            }}
          >
            {props.primaryContactFirstName
              ? `${props.primaryContactFirstName}, what we'd do, and what it costs.`
              : "What we'd do, and what it costs."}
          </p>
        </header>

        <Section
          index={1}
          title={SECTION_LABELS[0]}
          isPreview={isPreview}
          isDimmed={dimBackdrop}
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
        >
          {props.content.sections.whatYouToldUs.prose ? (
            <p className="whitespace-pre-wrap text-lg leading-relaxed">
              {props.content.sections.whatYouToldUs.prose}
            </p>
          ) : (
            <p
              className="text-lg italic"
              style={{ color: "color-mix(in srgb, var(--brand-charcoal) 50%, transparent)" }}
            >
              We'll fill this in once we've talked.
            </p>
          )}
        </Section>

        <Section
          index={2}
          title={SECTION_LABELS[1]}
          isPreview={isPreview}
          isDimmed={dimBackdrop}
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
        >
          {props.content.sections.whatWellDo.line_items.length === 0 ? (
            <p
              className="italic"
              style={{ color: "color-mix(in srgb, var(--brand-charcoal) 50%, transparent)" }}
            >
              Scope still being shaped.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--brand-charcoal) 12%, transparent)" }}>
              {props.content.sections.whatWellDo.line_items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-4 py-3">
                  <div>
                    <div className="text-base font-medium">{item.snapshot.name}</div>
                    <div
                      className="text-xs uppercase tracking-wider"
                      style={{ color: "color-mix(in srgb, var(--brand-charcoal) 55%, transparent)" }}
                    >
                      {item.qty} {item.snapshot.unit}
                      {item.kind === "retainer" ? " / month" : ""}
                    </div>
                  </div>
                  <div className="font-mono text-sm">
                    {formatMoney(item.qty * item.unit_price_cents_inc_gst)}
                    {item.kind === "retainer" ? " / mo" : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {props.content.sections.whatWellDo.prose && (
            <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">
              {props.content.sections.whatWellDo.prose}
            </p>
          )}
        </Section>

        <Section
          index={3}
          title={SECTION_LABELS[2]}
          isPreview={isPreview}
          isDimmed={dimBackdrop}
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
        >
          <dl className="space-y-3 text-base">
            {props.retainerMonthlyCents != null && (
              <div className="flex items-baseline justify-between">
                <dt style={{ color: "color-mix(in srgb, var(--brand-charcoal) 65%, transparent)" }}>
                  Retainer / month
                </dt>
                <dd className="font-medium">{formatMoney(props.retainerMonthlyCents)}</dd>
              </div>
            )}
            {props.oneOffCents != null && (
              <div className="flex items-baseline justify-between">
                <dt style={{ color: "color-mix(in srgb, var(--brand-charcoal) 65%, transparent)" }}>
                  One-off
                </dt>
                <dd className="font-medium">{formatMoney(props.oneOffCents)}</dd>
              </div>
            )}
            <div
              className="flex items-baseline justify-between border-t pt-3"
              style={{ borderColor: "color-mix(in srgb, var(--brand-charcoal) 18%, transparent)" }}
            >
              <dt className="text-lg font-semibold">First invoice (inc GST)</dt>
              <dd
                className="text-2xl font-semibold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {formatMoney(props.totalCents)}
              </dd>
            </div>
          </dl>
          {props.termLengthMonths && (
            <p
              className="mt-4 text-sm italic"
              style={{ fontFamily: "var(--font-narrative)" }}
            >
              {props.termLengthMonths}-month retainer — cancel any time from your
              account, honour-based commitment.
            </p>
          )}
        </Section>

        <Section
          index={4}
          title={SECTION_LABELS[3]}
          isPreview={isPreview}
          isDimmed={dimBackdrop}
          ref={(el) => {
            sectionRefs.current[3] = el;
          }}
        >
          <p className="text-base leading-relaxed">
            Standard SuperBad terms apply. Plain English, fair both ways, no
            tricks.
          </p>
          {props.content.sections.terms.overrides_prose && (
            <p
              className="mt-3 whitespace-pre-wrap text-sm"
              style={{ color: "color-mix(in srgb, var(--brand-charcoal) 70%, transparent)" }}
            >
              {props.content.sections.terms.overrides_prose}
            </p>
          )}
          <p className="mt-4 text-sm">
            <a
              href="/lite/legal/terms-of-service"
              className="underline underline-offset-4"
              style={{ color: "var(--brand-red)" }}
            >
              Read the full terms →
            </a>
          </p>
        </Section>

        <Section
          index={5}
          title={SECTION_LABELS[4]}
          isPreview={isPreview}
          isDimmed={false}
          ref={(el) => {
            sectionRefs.current[4] = el;
          }}
        >
          {isPreview ? (
            <PreviewAcceptPlaceholder />
          ) : (
            <QuoteAcceptBlock
              token={props.token}
              paymentMode={paymentMode}
              quoteNumber={props.quoteNumber}
              disabled={props.status === "accepted"}
              alreadyAccepted={props.status === "accepted"}
              onPhaseChange={setAcceptPhase}
            />
          )}
        </Section>

        {!isPreview && (
          <footer
            className="snap-start px-6 py-12 text-center text-xs"
            style={{ color: "color-mix(in srgb, var(--brand-charcoal) 50%, transparent)" }}
          >
            <p>
              <a
                href={`/lite/quotes/${props.token}/pdf`}
                className="underline underline-offset-4"
              >
                Download as PDF
              </a>
            </p>
            <p className="mt-3 italic" style={{ fontFamily: "var(--font-narrative)" }}>
              SuperBad Marketing · Melbourne
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}

function PreviewAcceptPlaceholder() {
  return (
    <div className="space-y-6 opacity-80">
      <label className="flex items-start gap-3 text-base">
        <input
          type="checkbox"
          disabled
          className="mt-1 h-5 w-5 accent-[var(--brand-red)]"
        />
        <span>
          I agree to the terms of service and privacy policy.
        </span>
      </label>
      <button
        type="button"
        disabled
        className="rounded-md px-6 py-3 text-base font-medium text-white"
        style={{
          backgroundColor: "var(--brand-red)",
          opacity: 0.45,
          cursor: "not-allowed",
        }}
      >
        Accept
      </button>
    </div>
  );
}

const Section = React.forwardRef<
  HTMLElement,
  {
    index: number;
    title: string;
    isPreview: boolean;
    isDimmed?: boolean;
    children: React.ReactNode;
  }
>(function Section({ index, title, isPreview, isDimmed, children }, ref) {
  return (
    <section
      ref={ref}
      data-section-index={index}
      className={
        (isPreview
          ? "border-t px-6 py-10"
          : "snap-start px-6 py-16 md:py-20") +
        " transition-all duration-300"
      }
      style={{
        borderColor: "color-mix(in srgb, var(--brand-charcoal) 10%, transparent)",
        ...(isPreview ? {} : { minHeight: "100dvh" }),
        ...(isDimmed ? { opacity: 0.15, filter: "blur(2px)" } : {}),
      }}
    >
      <div
        className="mb-6 flex items-baseline gap-3 text-[10px] uppercase tracking-[0.24em]"
        style={{ color: "color-mix(in srgb, var(--brand-charcoal) 50%, transparent)" }}
      >
        <span>§{index}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
});

function Stepper(props: { active: number; onJump: (i: number) => void; locked?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <nav
      aria-label="Quote sections"
      className="fixed right-6 top-1/2 z-10 hidden -translate-y-1/2 md:block"
      style={props.locked ? { pointerEvents: "none", opacity: 0.3 } : undefined}
    >
      <ol className="flex flex-col gap-3">
        {SECTION_LABELS.map((label, i) => {
          const idx = i + 1;
          const isActive = props.active === idx;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => props.onJump(idx)}
                disabled={props.locked}
                className="group flex items-center gap-3"
                aria-current={isActive ? "step" : undefined}
                aria-label={`Jump to section ${idx}: ${label}`}
              >
                <span
                  className="text-[10px] uppercase tracking-wider opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--brand-charcoal)" }}
                >
                  {label}
                </span>
                <motion.span
                  layout={!reduced}
                  transition={reduced ? { duration: 0.02 } : houseSpring}
                  className="block rounded-full"
                  style={{
                    width: isActive ? 24 : 8,
                    height: 8,
                    backgroundColor: isActive
                      ? "var(--brand-red)"
                      : "color-mix(in srgb, var(--brand-charcoal) 25%, transparent)",
                  }}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

