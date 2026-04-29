"use client";

/**
 * RevealClient — the cinematic Brand DNA reveal (mockup scene-3 register).
 *
 * Sequence (per `docs/specs/brand-dna-assessment.md` §10.5):
 *   1. `sound:brand_dna_reveal` fires on mount
 *   2. First impression headline + opener fade in (Black Han Sans + Playfair italic accent)
 *   3. Beat — held stillness (~3s)
 *   4. Signal tag pills animate in
 *   5. Section-by-section build — accent-bordered cards
 *   6. Full prose portrait with pull quotes + drop cap
 *   7. `markProfileComplete(profileId)` fires at the end
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
  signalTags: string[];
  alreadyComplete: boolean;
  markComplete?: (profileId: string) => Promise<void>;
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
  signalTags,
  alreadyComplete,
  markComplete: externalMarkComplete,
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
        if (externalMarkComplete) {
          await externalMarkComplete(profileId);
        } else {
          await markProfileComplete(profileId);
          if (!cancelled) await update();
        }
      })();
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(fire);
    };
  }, [phase, alreadyComplete, profileId, externalMarkComplete, update]);

  const { headline, headlineAccent } = splitImpressionHeadline(firstImpression);
  const { portrait: cleanPortrait, keyInsights } = parsePortraitAndInsights(prosePortrait);
  const paragraphs = splitPortraitParagraphs(cleanPortrait);
  const pullQuotes = keyInsights.length > 0 ? [] : extractPullQuotes(cleanPortrait);

  return (
    <main
      className="bda-reveal-main"
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
        className="bda-reveal-inner"
        style={{
          maxWidth: 780,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        {/* Open: label + Black Han Sans headline */}
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

        {/* Signal tag pills */}
        {phase !== "impression" && signalTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
            aria-label="Your signal tags"
          >
            {signalTags.map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  ...houseSpring,
                  delay: i * 0.08,
                }}
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 11,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
                  padding: "8px 16px",
                  border: "1px solid rgba(244, 160, 176, 0.25)",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* Section-by-section build */}
        {phase !== "impression" && sectionInsights.length > 0 && (
          <div
            className="bda-reveal-sections"
            style={{ display: "flex", flexDirection: "column", gap: 48 }}
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
                    display: "flex",
                    gap: 24,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(48px, 6vw, 72px)",
                      lineHeight: 0.85,
                      color: "rgba(178, 40, 72, 0.15)",
                      flexShrink: 0,
                      userSelect: "none",
                      minWidth: "1.2ch",
                      textAlign: "right",
                    }}
                    aria-hidden
                  >
                    {sectionNumber}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      paddingLeft: 20,
                      borderLeft: "2px solid rgba(244, 160, 176, 0.2)",
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
                      {title}
                    </h2>
                    <p
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontStyle: "italic",
                        fontSize: "clamp(17px, 2vw, 20px)",
                        lineHeight: 1.7,
                        color: "var(--brand-cream)",
                        opacity: 0.85,
                        margin: 0,
                      }}
                    >
                      {insightText}
                    </p>
                  </div>
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
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
            aria-label="Prose portrait"
          >
            {/* Animated divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: 1,
                background: "linear-gradient(to right, transparent, rgba(253, 245, 230, 0.15), transparent)",
                marginBottom: 32,
                transformOrigin: "center",
              }}
            />

            <h2
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: "2px",
                color: "var(--brand-pink)",
                textTransform: "uppercase",
                margin: "0 0 24px 0",
              }}
            >
              The portrait
            </h2>

            {paragraphs.map((para, i) => {
              const pullQuote = pullQuotes.find((pq) => pq.afterParagraph === i);
              const isFirst = i === 0;
              return (
                <React.Fragment key={i}>
                  {isFirst ? (
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 19,
                        lineHeight: 1.75,
                        color: "var(--brand-cream)",
                        opacity: 0.85,
                        margin: "0 0 20px 0",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 56,
                          lineHeight: 0.85,
                          float: "left",
                          color: "var(--brand-pink)",
                          marginRight: 10,
                          marginTop: 4,
                        }}
                      >
                        {para.charAt(0)}
                      </span>
                      {para.slice(1)}
                    </p>
                  ) : (
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 19,
                        lineHeight: 1.75,
                        color: "var(--brand-cream)",
                        opacity: 0.85,
                        margin: "0 0 20px 0",
                      }}
                    >
                      {para}
                    </p>
                  )}
                  {pullQuote && (
                    <motion.blockquote
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...houseSpring, duration: 1.0, delay: 0.3 }}
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontStyle: "italic",
                        fontSize: "clamp(24px, 3.5vw, 36px)",
                        lineHeight: 1.3,
                        color: "var(--brand-pink)",
                        margin: "36px 0 40px 0",
                        padding: "0 0 0 24px",
                        borderLeft: "3px solid rgba(178, 40, 72, 0.35)",
                      }}
                    >
                      {pullQuote.text}
                    </motion.blockquote>
                  )}
                </React.Fragment>
              );
            })}

            {keyInsights.length > 0 && (
              <div
                style={{
                  marginTop: 56,
                  paddingTop: 40,
                  borderTop: "1px solid rgba(253, 245, 230, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 40,
                }}
              >
                {keyInsights.map((insight, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...houseSpring, delay: 0.2 + idx * 0.15 }}
                    style={{
                      padding: "0 0 0 20px",
                      borderLeft: "3px solid rgba(178, 40, 72, 0.4)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontStyle: "italic",
                        fontSize: "clamp(20px, 3vw, 28px)",
                        lineHeight: 1.3,
                        color: "var(--brand-pink)",
                        margin: "0 0 12px 0",
                      }}
                    >
                      {insight.headline}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 16,
                        lineHeight: 1.7,
                        color: "var(--brand-cream)",
                        opacity: 0.8,
                        margin: "0 0 10px 0",
                      }}
                    >
                      {insight.followThrough}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontStyle: "italic",
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--brand-cream)",
                        opacity: 0.4,
                        margin: 0,
                      }}
                    >
                      {insight.evidence}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}

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

      <style jsx>{`
        @media (max-width: 640px) {
          .bda-reveal-main {
            padding: 24px 20px 60px !important;
          }
          :global(.bda-reveal-inner) {
            gap: 36px !important;
          }
          :global(.bda-reveal-sections) {
            gap: 28px !important;
          }
          :global(.bda-reveal-inner p) {
            font-size: 16px !important;
          }
        }
      `}</style>
    </main>
  );
}

function splitImpressionHeadline(text: string): {
  headline: string;
  headlineAccent: string | null;
} {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { headline: "", headlineAccent: null };

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

interface KeyInsight {
  headline: string;
  followThrough: string;
  evidence: string;
}

function parsePortraitAndInsights(raw: string): {
  portrait: string;
  keyInsights: KeyInsight[];
} {
  const insightsMarker = "[KEY_INSIGHTS]";
  const portraitMarker = "[PORTRAIT]";

  let portraitText = raw;
  let insightsBlock = "";

  if (raw.includes(insightsMarker)) {
    const parts = raw.split(insightsMarker);
    portraitText = parts[0];
    insightsBlock = parts[1] ?? "";
  }

  portraitText = portraitText
    .replace(portraitMarker, "")
    .trim();

  const keyInsights: KeyInsight[] = [];
  const insightBlocks = insightsBlock.split("---").filter((b) => b.trim().length > 0);

  for (const block of insightBlocks) {
    const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?:\n|$)/);
    const followMatch = block.match(/FOLLOW_THROUGH:\s*([\s\S]+?)(?=EVIDENCE:|$)/);
    const evidenceMatch = block.match(/EVIDENCE:\s*([\s\S]+?)$/);

    if (headlineMatch?.[1]) {
      keyInsights.push({
        headline: headlineMatch[1].trim(),
        followThrough: followMatch?.[1]?.trim() ?? "",
        evidence: evidenceMatch?.[1]?.trim() ?? "",
      });
    }
  }

  return { portrait: portraitText, keyInsights: keyInsights.slice(0, 3) };
}

function extractPullQuotes(
  portrait: string,
): Array<{ text: string; afterParagraph: number }> {
  const paragraphs = splitPortraitParagraphs(portrait);
  if (paragraphs.length < 3) return [];

  const candidates: Array<{ text: string; paraIndex: number; score: number }> = [];

  paragraphs.forEach((para, paraIndex) => {
    if (paraIndex === 0) return;
    const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [];
    for (const raw of sentences) {
      const s = raw.trim();
      if (s.length >= 25 && s.length <= 90) {
        const score = 100 - s.length + (s.includes("—") ? 10 : 0);
        candidates.push({ text: s, paraIndex, score });
      }
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const picked: Array<{ text: string; afterParagraph: number }> = [];
  const usedParas = new Set<number>();

  for (const c of candidates) {
    if (picked.length >= 2) break;
    if (usedParas.has(c.paraIndex) || usedParas.has(c.paraIndex - 1)) continue;
    picked.push({ text: c.text, afterParagraph: c.paraIndex });
    usedParas.add(c.paraIndex);
  }

  picked.sort((a, b) => a.afterParagraph - b.afterParagraph);
  return picked;
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
