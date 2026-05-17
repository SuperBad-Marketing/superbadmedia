"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { useSound } from "@/components/lite/sound-provider";
import {
  SignalScores,
  type SignalScoreEntry,
} from "@/components/lite/brand-dna/signal-scores";
import { houseSpring } from "@/lib/design-tokens";
import type {
  BrandDnaRevealV2,
  PracticalMove,
} from "@/lib/brand-dna/reveal-v2";

export const BRAND_DNA_REVEAL_V2_SECTION_ORDER = [
  "Context line",
  "First thing I’d say",
  "What this says about the brand",
  "Where this helps",
  "Where it might be biting you",
  "How customers may be reading it",
  "The receipt",
  "What I’d fix first",
  "Best next move",
] as const;

interface BrandDnaRevealV2ClientProps {
  profileId: string;
  reveal: BrandDnaRevealV2;
  signalScoresIntro: string;
  signalScores: SignalScoreEntry[];
  signalScoresLongTail: string;
  sectionInsights: string[];
  sectionTitles: string[];
  alreadyComplete: boolean;
  markComplete?: (profileId: string) => Promise<void>;
}

const SECTION_BG_DARK = "var(--color-neutral-900, #1A1A18)";
const SECTION_BG_LIGHT = "var(--color-neutral-800, #252320)";
const CREAM = "var(--brand-cream)";
const MUTED = "var(--neutral-400, rgba(253,245,230,0.54))";

export function BrandDnaRevealV2Client({
  profileId,
  reveal,
  signalScoresIntro,
  signalScores,
  signalScoresLongTail,
  sectionInsights,
  sectionTitles,
  alreadyComplete,
  markComplete,
}: BrandDnaRevealV2ClientProps) {
  const { play } = useSound();

  React.useEffect(() => {
    play("brand_dna_reveal");
  }, [play]);

  React.useEffect(() => {
    if (alreadyComplete || !markComplete) return;
    const timer = window.setTimeout(() => {
      void markComplete(profileId);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [alreadyComplete, markComplete, profileId]);

  const customerRows = [
    ["What they notice", reveal.brandTranslation.customerRead.whatTheyNotice],
    ["What they feel", reveal.brandTranslation.customerRead.whatTheyFeel],
    [
      "Where they hesitate",
      reveal.brandTranslation.customerRead.whereTheyHesitate,
    ],
    [
      "What needs to become obvious",
      reveal.brandTranslation.customerRead.whatNeedsToBecomeObvious,
    ],
  ] as const;

  const practicalMoves: Array<[string, PracticalMove]> = [
    ["Message", reveal.practicalMoves.message],
    ["Content", reveal.practicalMoves.content],
    ["Proof", reveal.practicalMoves.proof],
    ["Offer", reveal.practicalMoves.offer],
    ["Visual feel", reveal.practicalMoves.visualFeel],
  ];

  const recommendedTrial = reveal.pathway.recommended === "trial_shoot";
  const primaryHeading = recommendedTrial
    ? "Start with a Trial Shoot"
    : "Start with the Workshop";
  const secondaryHeading = recommendedTrial
    ? "Workshop is the other path"
    : "Trial Shoot is the other path";

  return (
    <main className="bda-reveal-v2-root" style={{ background: SECTION_BG_DARK }}>
      <section style={{ padding: "72px 24px 56px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <RevealIn>
            <p
              aria-label="Context line"
              style={{
                margin: "0 0 28px",
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: "1.4px",
                color: MUTED,
              }}
            >
              {reveal.meta.confidenceLine}
            </p>
            <SectionLabel>First thing I’d say</SectionLabel>
            <h1
              style={{
                margin: "18px 0 28px",
                maxWidth: 760,
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.9rem, 7vw, 5.75rem)",
                lineHeight: 0.95,
                letterSpacing: 0,
                color: CREAM,
              }}
            >
              {reveal.friendRead.openingLine}
            </h1>
            <div
              style={{
                display: "grid",
                gap: 16,
                maxWidth: 720,
                fontFamily: "var(--font-body)",
                fontSize: "clamp(1rem, 2vw, 1.1rem)",
                lineHeight: 1.72,
                color: "rgba(253,245,230,0.78)",
              }}
            >
              <p style={{ margin: 0 }}>{reveal.friendRead.recognition}</p>
              <p style={{ margin: 0 }}>{reveal.friendRead.gentleSting}</p>
              <p style={{ margin: 0 }}>{reveal.friendRead.practicalBridge}</p>
            </div>
          </RevealIn>
        </div>
      </section>

      <TextBand title="What this says about the brand" background={SECTION_BG_LIGHT}>
        {reveal.brandTranslation.plainRead}
      </TextBand>

      <TextBand title="Where this helps" background={SECTION_BG_DARK}>
        {reveal.brandTranslation.whereItHelps}
      </TextBand>

      <TextBand title="Where it might be biting you" background={SECTION_BG_LIGHT}>
        {reveal.brandTranslation.whereItBites}
      </TextBand>

      <section style={{ background: SECTION_BG_DARK, padding: "64px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <RevealIn>
            <SectionHeading>How customers may be reading it</SectionHeading>
            <div className="bda-v2-customer-grid">
              {customerRows.map(([label, value]) => (
                <div className="bda-v2-row" key={label}>
                  <h3>{label}</h3>
                  <p>{value}</p>
                </div>
              ))}
            </div>
          </RevealIn>
        </div>
      </section>

      <section style={{ background: SECTION_BG_LIGHT, padding: "64px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <RevealIn>
            <SectionHeading>The receipt</SectionHeading>
            <ul className="bda-v2-receipt-list">
              {reveal.receipt.signalSummaries.map((summary) => (
                <li key={summary}>{summary}</li>
              ))}
            </ul>
            <div className="bda-v2-receipt-copy">
              <p>{reveal.receipt.strongestTension}</p>
              <p>{reveal.receipt.quietOrMissingSignal}</p>
              {reveal.receipt.realityCheck && (
                <p>{reveal.receipt.realityCheck}</p>
              )}
            </div>
          </RevealIn>
        </div>
      </section>

      <section style={{ background: SECTION_BG_DARK, padding: "72px 24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <RevealIn>
            <SectionHeading>What I’d fix first</SectionHeading>
            <div className="bda-v2-move-grid">
              {practicalMoves.map(([label, move]) => (
                <PracticalMoveCard key={label} label={label} move={move} />
              ))}
            </div>
          </RevealIn>
        </div>
      </section>

      <section style={{ background: SECTION_BG_LIGHT, padding: "72px 24px 88px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <RevealIn>
            <SectionHeading>Best next move</SectionHeading>
            <div className="bda-v2-pathway-grid">
              <PathwayCard
                heading={primaryHeading}
                body={reveal.pathway.whyThisFirst}
                label={reveal.pathway.primaryCtaLabel}
                href={reveal.pathway.primaryCtaHref}
                primary
              />
              <PathwayCard
                heading={secondaryHeading}
                body={reveal.pathway.whyNotTheOtherFirst}
                label={reveal.pathway.secondaryCtaLabel}
                href={reveal.pathway.secondaryCtaHref}
              />
            </div>
          </RevealIn>
        </div>
      </section>

      {(signalScores.length > 0 || sectionInsights.length > 0) && (
        <section style={{ background: SECTION_BG_DARK, padding: "0 24px 72px" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <RevealIn delay={0.1}>
              <details className="bda-v2-details">
                <summary>Why we’re saying this</summary>
                {signalScores.length > 0 && (
                  <div className="bda-v2-signal-wrap">
                    <SignalScores
                      intro={signalScoresIntro}
                      scores={signalScores}
                      longTailSummary={signalScoresLongTail}
                    />
                  </div>
                )}
                {sectionInsights.length > 0 && (
                  <div className="bda-v2-section-insights">
                    {sectionInsights.map((insight, index) => (
                      <div key={`${index}-${insight}`}>
                        <h3>{sectionTitles[index] ?? `Section ${index + 1}`}</h3>
                        <p>{insight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </RevealIn>
          </div>
        </section>
      )}

      <style>{`
        .bda-v2-customer-grid,
        .bda-v2-pathway-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .bda-v2-row,
        .bda-v2-move-card,
        .bda-v2-pathway-card {
          border: 1px solid rgba(253, 245, 230, 0.08);
          background: rgba(253, 245, 230, 0.035);
          border-radius: 8px;
        }

        .bda-v2-row {
          padding: 20px;
        }

        .bda-v2-row h3,
        .bda-v2-section-insights h3,
        .bda-v2-field-label {
          margin: 0 0 8px;
          font-family: var(--font-label);
          font-size: 10px;
          letter-spacing: 1.7px;
          text-transform: uppercase;
          color: var(--brand-orange);
        }

        .bda-v2-row p,
        .bda-v2-receipt-copy p,
        .bda-v2-section-insights p,
        .bda-v2-pathway-card p {
          margin: 0;
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.68;
          color: rgba(253, 245, 230, 0.75);
        }

        .bda-v2-receipt-list {
          display: grid;
          gap: 10px;
          margin: 0 0 28px;
          padding: 0;
          list-style: none;
        }

        .bda-v2-receipt-list li {
          padding: 14px 16px;
          border-left: 2px solid var(--brand-red);
          background: rgba(253, 245, 230, 0.035);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.6;
          color: rgba(253, 245, 230, 0.78);
        }

        .bda-v2-receipt-copy {
          display: grid;
          gap: 14px;
          max-width: 720px;
        }

        .bda-v2-details {
          margin-top: 36px;
          border-top: 1px solid rgba(253, 245, 230, 0.08);
          padding-top: 18px;
        }

        .bda-v2-details summary {
          cursor: pointer;
          font-family: var(--font-label);
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--brand-pink);
        }

        .bda-v2-signal-wrap {
          margin-top: 20px;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(253, 245, 230, 0.06);
        }

        .bda-v2-signal-wrap > div {
          padding: 44px 20px !important;
          background: transparent !important;
        }

        .bda-v2-section-insights {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .bda-v2-section-insights > div {
          padding: 16px;
          border: 1px solid rgba(253, 245, 230, 0.06);
          border-radius: 8px;
        }

        .bda-v2-move-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .bda-v2-move-card {
          display: flex;
          min-height: 100%;
          flex-direction: column;
          gap: 16px;
          padding: 18px;
        }

        .bda-v2-move-card h3 {
          margin: 0;
          font-family: var(--font-narrative);
          font-size: 20px;
          line-height: 1.22;
          color: var(--brand-cream);
        }

        .bda-v2-move-card p {
          margin: 0;
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.6;
          color: rgba(253, 245, 230, 0.72);
        }

        .bda-v2-mini-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: auto;
        }

        .bda-v2-mini-meta span {
          display: block;
          padding: 8px 10px;
          border-radius: 6px;
          background: rgba(253, 245, 230, 0.05);
          font-family: var(--font-label);
          font-size: 10px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(253, 245, 230, 0.7);
        }

        .bda-v2-pathway-card {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 26px;
        }

        .bda-v2-pathway-card.primary {
          border-color: rgba(178, 40, 72, 0.45);
          background: rgba(178, 40, 72, 0.12);
        }

        .bda-v2-pathway-card h3 {
          margin: 0;
          font-family: var(--font-narrative);
          font-size: clamp(1.45rem, 3vw, 2.1rem);
          line-height: 1.16;
          color: var(--brand-cream);
        }

        .bda-v2-cta {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 12px 18px;
          border-radius: 8px;
          border: 1px solid rgba(253, 245, 230, 0.18);
          color: var(--brand-cream);
          font-family: var(--font-label);
          font-size: 11px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          text-decoration: none;
        }

        .bda-v2-pathway-card.primary .bda-v2-cta {
          background: var(--brand-red);
          border-color: var(--brand-red);
        }

        @media (max-width: 1040px) {
          .bda-v2-move-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .bda-v2-customer-grid,
          .bda-v2-pathway-grid,
          .bda-v2-move-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function RevealIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...houseSpring, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontFamily: "var(--font-label)",
        fontSize: 10,
        letterSpacing: "2.4px",
        textTransform: "uppercase",
        color: "var(--brand-orange)",
      }}
    >
      {children}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 28px",
        fontFamily: "var(--font-narrative)",
        fontSize: "clamp(1.7rem, 4vw, 2.65rem)",
        fontWeight: 500,
        lineHeight: 1.15,
        color: CREAM,
      }}
    >
      {children}
    </h2>
  );
}

function TextBand({
  title,
  background,
  children,
}: {
  title: string;
  background: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ background, padding: "58px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <RevealIn>
          <SectionHeading>{title}</SectionHeading>
          <p
            style={{
              maxWidth: 720,
              margin: 0,
              fontFamily: "var(--font-body)",
              fontSize: "clamp(1rem, 2vw, 1.1rem)",
              lineHeight: 1.75,
              color: "rgba(253,245,230,0.77)",
            }}
          >
            {children}
          </p>
        </RevealIn>
      </div>
    </section>
  );
}

function PracticalMoveCard({
  label,
  move,
}: {
  label: string;
  move: PracticalMove;
}) {
  return (
    <article className="bda-v2-move-card">
      <SectionLabel>{label}</SectionLabel>
      <h3>{move.title}</h3>
      <Field label="Change">{move.whatToChange}</Field>
      <Field label="Why">{move.whyItMatters}</Field>
      <Field label="Example">{move.example}</Field>
      <div className="bda-v2-mini-meta">
        <span>Effort: {move.effort}</span>
        <span>Impact: {move.impact}</span>
      </div>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="bda-v2-field-label">{label}</div>
      <p>{children}</p>
    </div>
  );
}

function PathwayCard({
  heading,
  body,
  label,
  href,
  primary = false,
}: {
  heading: string;
  body: string;
  label: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <article className={`bda-v2-pathway-card${primary ? " primary" : ""}`}>
      <h3>{heading}</h3>
      <p>{body}</p>
      <a className="bda-v2-cta" href={href}>
        {label}
      </a>
    </article>
  );
}
