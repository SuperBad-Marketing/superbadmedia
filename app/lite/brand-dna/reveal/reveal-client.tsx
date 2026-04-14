"use client";

/**
 * RevealClient — the cinematic Brand DNA reveal (mockup scene-3 register).
 *
 * Sequence (per `docs/specs/brand-dna-assessment.md` §10.5):
 *   1. `sound:brand_dna_reveal` fires on mount
 *   2. First impression headline + opener fade in (Black Han Sans + Playfair italic accent)
 *   3. Beat — held stillness (~3s)
 *   4. Section-by-section build — Righteous label + brand-pink heading + DM Sans body
 *   5. Full prose portrait lands as the finale
 *   6. `markProfileComplete(profileId)` fires at the end
 *
 * Visual register matches `mockup-brand-dna.html` `.reveal-scene` — Black Han
 * Sans display headline with Playfair italic accent fragment, brand-cream
 * body, Righteous section labels, brand-pink rule between sections, italic
 * brand-pink signature footer.
 *
 * Owners: BDA-3 (logic), BDA-POLISH-1 (visual port).
 */

import * as React from "react";
import { motion } from "framer-motion";
import { SessionProvider, useSession } from "next-auth/react";

import { useSound } from "@/components/lite/sound-provider";
import { houseSpring } from "@/lib/design-tokens";

import { markProfileComplete } from "../actions";

interface RevealClientProps {
  profileId: string;
  firstImpression: string;
  prosePortrait: string;
  sectionInsights: string[];
  sectionTitles: string[];
  alreadyComplete: boolean;
}

export function RevealClient(props: RevealClientProps) {
  return (
    <SessionProvider>
      <RevealInner {...props} />
    </SessionProvider>
  );
}

function RevealInner({
  profileId,
  firstImpression,
  prosePortrait,
  sectionInsights,
  sectionTitles,
  alreadyComplete,
}: RevealClientProps) {
  const { play } = useSound();
  const { update } = useSession();

  const [phase, setPhase] = React.useState<"impression" | "sections" | "portrait">(
    "impression",
  );

  React.useEffect(() => {
    play("brand_dna_reveal");
  }, [play]);

  React.useEffect(() => {
    const toSections = window.setTimeout(() => setPhase("sections"), 4200);
    const toPortrait = window.setTimeout(
      () => setPhase("portrait"),
      4200 + sectionInsights.length * 1400 + 1200,
    );
    return () => {
      window.clearTimeout(toSections);
      window.clearTimeout(toPortrait);
    };
  }, [sectionInsights.length]);

  React.useEffect(() => {
    if (phase !== "portrait") return;
    if (alreadyComplete) return;
    let cancelled = false;
    const fire = window.setTimeout(() => {
      void (async () => {
        await markProfileComplete(profileId);
        if (cancelled) return;
        await update();
      })();
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(fire);
    };
  }, [phase, alreadyComplete, profileId, update]);

  const { headline, headlineAccent } = splitImpressionHeadline(firstImpression);
  const paragraphs = splitPortraitParagraphs(prosePortrait);

  return (
    <main
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "40px 24px 120px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: 780,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        {/* Open: label + Black Han Sans headline + opening paragraph */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...houseSpring, duration: 1.4 }}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          <span
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "3px",
              color: "var(--brand-orange)",
              textTransform: "uppercase",
            }}
          >
            Your brand DNA
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(56px, 9vw, 88px)",
              lineHeight: 0.95,
              color: "var(--brand-cream)",
              letterSpacing: "-1.5px",
              margin: 0,
            }}
          >
            {headline}
            {headlineAccent && (
              <>
                {" "}
                <em
                  style={{
                    fontFamily: "var(--font-narrative)",
                    fontStyle: "italic",
                    color: "var(--brand-pink)",
                    fontWeight: 500,
                  }}
                >
                  {headlineAccent}
                </em>
              </>
            )}
          </h1>
        </motion.section>

        {/* Section-by-section build */}
        {phase !== "impression" && sectionInsights.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 56 }}
            aria-label="Signal summary by section"
          >
            {sectionInsights.map((insightText, index) => {
              const sectionNumber = index + 1;
              const title = sectionTitles[index] ?? `Section ${sectionNumber}`;
              return (
                <motion.section
                  key={sectionNumber}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...houseSpring, duration: 1.2, delay: index * 0.2 }}
                  style={{
                    paddingTop: 32,
                    borderTop: "1px solid rgba(253, 245, 230, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 11,
                      letterSpacing: "2px",
                      color: "var(--brand-pink)",
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    Section {sectionNumber} · {title}
                  </h2>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 17,
                      lineHeight: 1.7,
                      color: "var(--neutral-300)",
                      margin: 0,
                    }}
                  >
                    {insightText}
                  </p>
                </motion.section>
              );
            })}
          </div>
        )}

        {/* Full prose portrait */}
        {phase === "portrait" && (
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...houseSpring, duration: 1.4, delay: 0.1 }}
            style={{
              paddingTop: 32,
              borderTop: "1px solid rgba(253, 245, 230, 0.1)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            aria-label="Prose portrait"
          >
            <h2
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: "2px",
                color: "var(--brand-pink)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              The portrait
            </h2>
            {paragraphs.map((para, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 17,
                  lineHeight: 1.7,
                  color: "var(--neutral-300)",
                  margin: 0,
                }}
              >
                {para}
              </p>
            ))}

            <p
              style={{
                marginTop: 48,
                paddingTop: 32,
                textAlign: "center",
                borderTop: "1px solid rgba(253, 245, 230, 0.08)",
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: 15,
                color: "var(--brand-pink)",
                opacity: 0.8,
                lineHeight: 1.7,
              }}
            >
              written for you, by SuperBad, on {formatToday()}.
              <br />
              we&apos;ll check in on this in a year. sooner if something meaningful shifts.
            </p>
          </motion.article>
        )}
      </div>
    </main>
  );
}

function splitImpressionHeadline(text: string): {
  headline: string;
  headlineAccent: string | null;
} {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { headline: "", headlineAccent: null };

  // Take the first sentence as the headline. If it splits cleanly on a comma
  // or em-dash, the remainder becomes the italic Playfair accent (per mockup).
  const sentenceMatch = trimmed.match(/^([\s\S]+?[.?!])(\s+([\s\S]+))?$/);
  const head = sentenceMatch ? sentenceMatch[1].trim() : trimmed;

  const splitMatch = head.match(/^(.+?)[,—](\s+)(.+[.?!])$/);
  if (splitMatch) {
    return { headline: splitMatch[1].trim() + ",", headlineAccent: splitMatch[3].trim() };
  }
  return { headline: head, headlineAccent: null };
}

function splitPortraitParagraphs(portrait: string): string[] {
  const trimmed = portrait.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
