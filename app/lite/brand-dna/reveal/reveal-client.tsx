"use client";

/**
 * RevealClient — the cinematic Brand DNA reveal.
 *
 * Sequence:
 *   1. `sound:brand_dna_reveal` fires on mount
 *   2. Short headline + subline fade in
 *   3. Signal tag pills animate in
 *   4. Section insights build in alternating bands (headline + body + tags)
 *   5. Key insight takeaway cards
 *   6. Collapsible prose portrait
 *   7. `markProfileComplete(profileId)` fires
 *
 * Owners: BDA-3 (logic), BDA-POLISH-1 (visual port).
 */

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
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

// ── Scroll-triggered reveal wrapper ───────────────────────────────────

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Main reveal ───────────────────────────────────────────────────────

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
  const [portraitExpanded, setPortraitExpanded] = React.useState(false);

  React.useEffect(() => {
    play("brand_dna_reveal");
  }, [play]);

  React.useEffect(() => {
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
    }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(fire);
    };
  }, [alreadyComplete, profileId, externalMarkComplete, update]);

  const { headline, subline } = parseFirstImpression(firstImpression);
  const parsedInsights = sectionInsights.map(parseInsight);
  const { portrait: cleanPortrait, keyInsights } = parsePortraitAndInsights(prosePortrait);
  const paragraphs = splitPortraitParagraphs(cleanPortrait);
  const pullQuotes = keyInsights.length > 0 ? [] : extractPullQuotes(cleanPortrait);
  const previewParagraphs = paragraphs.slice(0, 2);
  const remainingParagraphs = paragraphs.slice(2);

  return (
    <div className="bda-reveal-root">
      {/* ═══ HERO: Headline + Subline ═══ */}
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "80px 24px 0",
        }}
      >
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
              fontSize: "clamp(48px, 8vw, 80px)",
              lineHeight: 0.95,
              color: "var(--brand-cream)",
              letterSpacing: "-1.5px",
              margin: 0,
            }}
          >
            {headline}
          </h1>
          {subline && (
            <p
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "clamp(17px, 2.2vw, 22px)",
                lineHeight: 1.6,
                color: "var(--brand-cream)",
                opacity: 0.7,
                maxWidth: 560,
                margin: 0,
              }}
            >
              {subline}
            </p>
          )}
        </motion.section>

        {/* Signal tag pills */}
        {signalTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.6 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 40,
              paddingBottom: 56,
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
                  delay: 1.6 + i * 0.08,
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
      </div>

      {/* ═══ SECTION INSIGHTS (alternating bands) ═══ */}
      {parsedInsights.length > 0 && (
        <div aria-label="Signal summary by section">
          {parsedInsights.map((insight, index) => {
            const sectionNumber = index + 1;
            const title = sectionTitles[index] ?? `Section ${sectionNumber}`;
            const isDark = index % 2 === 0;
            return (
              <div
                key={sectionNumber}
                style={{
                  background: isDark
                    ? "var(--color-neutral-900, #1A1A18)"
                    : "var(--color-neutral-800, #252320)",
                  padding: "64px 24px",
                }}
              >
                <Reveal delay={0.05}>
                  <div
                    style={{
                      maxWidth: 820,
                      margin: "0 auto",
                      display: "flex",
                      gap: 28,
                      alignItems: "flex-start",
                    }}
                    className="bda-insight-block"
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(48px, 6vw, 64px)",
                        lineHeight: 0.85,
                        color: "rgba(178, 40, 72, 0.12)",
                        flexShrink: 0,
                        userSelect: "none",
                        minWidth: "1.4ch",
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
                        gap: 12,
                        paddingLeft: 20,
                        borderLeft: "2px solid rgba(244, 160, 176, 0.15)",
                      }}
                    >
                      <h2
                        style={{
                          fontFamily: "var(--font-label)",
                          fontSize: 9,
                          letterSpacing: "2px",
                          color: "var(--brand-pink)",
                          textTransform: "uppercase",
                          margin: 0,
                        }}
                      >
                        {title}
                      </h2>
                      <h3
                        style={{
                          fontFamily: "var(--font-narrative)",
                          fontWeight: 600,
                          fontSize: "clamp(20px, 3vw, 26px)",
                          lineHeight: 1.3,
                          color: "var(--brand-cream)",
                          margin: 0,
                        }}
                      >
                        {insight.headline}
                      </h3>
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 15,
                          lineHeight: 1.7,
                          color: "var(--brand-cream)",
                          opacity: 0.7,
                          margin: 0,
                        }}
                      >
                        {insight.body}
                      </p>
                      {insight.tags.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          {insight.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontFamily: "var(--font-label)",
                                fontSize: 9,
                                letterSpacing: "1.5px",
                                textTransform: "uppercase",
                                color: "var(--brand-red)",
                                padding: "5px 12px",
                                border: "1px solid rgba(178, 40, 72, 0.25)",
                                borderRadius: 999,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ KEY TAKEAWAYS ═══ */}
      {keyInsights.length > 0 && (
        <div
          style={{
            background: "var(--color-neutral-900, #1A1A18)",
            padding: "80px 24px",
          }}
        >
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <Reveal>
              <div
                style={{
                  height: 1,
                  background:
                    "linear-gradient(to right, transparent, rgba(253,245,230,0.12), transparent)",
                  marginBottom: 48,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "3px",
                  color: "var(--brand-orange)",
                  textTransform: "uppercase",
                }}
              >
                The takeaways
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontSize: "clamp(24px, 3.5vw, 36px)",
                  fontWeight: 500,
                  color: "var(--brand-cream)",
                  margin: "16px 0 48px",
                  lineHeight: 1.3,
                }}
              >
                What your answers actually said.
              </h2>
            </Reveal>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {keyInsights.map((insight, idx) => (
                <Reveal key={idx} delay={0.1 + idx * 0.1}>
                  <div
                    style={{
                      padding: 32,
                      borderRadius: 16,
                      border: "1px solid rgba(253, 245, 230, 0.06)",
                      background:
                        idx % 2 === 0
                          ? "var(--color-neutral-800, #252320)"
                          : "var(--color-neutral-700, #332F2A)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-narrative)",
                        fontStyle: "italic",
                        fontSize: "clamp(22px, 3vw, 30px)",
                        lineHeight: 1.3,
                        color: "var(--brand-pink)",
                        marginBottom: 16,
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
                        marginBottom: 12,
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
                      }}
                    >
                      Strongest signals: {insight.evidence}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROSE PORTRAIT (collapsed by default) ═══ */}
      {paragraphs.length > 0 && (
        <div
          style={{
            background: "var(--color-neutral-800, #252320)",
            padding: "72px 24px",
          }}
        >
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <Reveal>
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "3px",
                  color: "var(--brand-pink)",
                  textTransform: "uppercase",
                }}
              >
                The portrait
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontSize: "clamp(22px, 3vw, 30px)",
                  fontWeight: 500,
                  color: "var(--brand-cream)",
                  margin: "14px 0 36px",
                  lineHeight: 1.35,
                }}
              >
                The full picture, in narrative form.
              </h2>
            </Reveal>

            <div style={{ maxWidth: 640 }}>
              {/* Preview: first 2 paragraphs */}
              {previewParagraphs.map((para, i) => (
                <Reveal key={i} delay={0.05 + i * 0.05}>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 17,
                      lineHeight: 1.8,
                      color: "var(--brand-cream)",
                      opacity: 0.8,
                      marginBottom: i < previewParagraphs.length - 1 ? 20 : 0,
                    }}
                  >
                    {i === 0 ? (
                      <>
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 48,
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
                      </>
                    ) : (
                      para
                    )}
                  </p>
                </Reveal>
              ))}

              {/* Fade + expand button if there's more */}
              {remainingParagraphs.length > 0 && !portraitExpanded && (
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      height: 48,
                      marginTop: -48,
                      background:
                        "linear-gradient(to bottom, transparent, var(--color-neutral-800, #252320))",
                      pointerEvents: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPortraitExpanded(true)}
                    style={{
                      display: "inline-block",
                      marginTop: 20,
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--brand-pink)",
                      background: "none",
                      border: "1px solid rgba(244, 160, 176, 0.2)",
                      padding: "10px 24px",
                      borderRadius: 999,
                      cursor: "pointer",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Read the full portrait
                  </button>
                </div>
              )}

              {/* Expanded content */}
              {portraitExpanded && remainingParagraphs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ marginTop: 20 }}
                >
                  {remainingParagraphs.map((para, i) => {
                    const pullQuote = pullQuotes.find(
                      (pq) => pq.afterParagraph === i + 2,
                    );
                    return (
                      <React.Fragment key={i + 2}>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 17,
                            lineHeight: 1.8,
                            color: "var(--brand-cream)",
                            opacity: 0.8,
                            marginBottom: 20,
                          }}
                        >
                          {para}
                        </p>
                        {pullQuote && (
                          <blockquote
                            style={{
                              fontFamily: "var(--font-narrative)",
                              fontStyle: "italic",
                              fontSize: "clamp(20px, 3vw, 28px)",
                              lineHeight: 1.3,
                              color: "var(--brand-pink)",
                              margin: "32px 0 36px 0",
                              padding: "0 0 0 24px",
                              borderLeft:
                                "3px solid rgba(178, 40, 72, 0.35)",
                            }}
                          >
                            {pullQuote.text}
                          </blockquote>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setPortraitExpanded(false)}
                    style={{
                      display: "inline-block",
                      marginTop: 12,
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--brand-pink)",
                      background: "none",
                      border: "1px solid rgba(244, 160, 176, 0.2)",
                      padding: "10px 24px",
                      borderRadius: 999,
                      cursor: "pointer",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Collapse portrait
                  </button>
                </motion.div>
              )}
            </div>

            <p
              style={{
                marginTop: 40,
                textAlign: "center",
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--brand-pink)",
                opacity: 0.6,
                lineHeight: 1.7,
              }}
            >
              written for you, by SuperBad, on {formatToday()}.
              <br />
              we&apos;ll check in on this in a year. sooner if something
              meaningful shifts.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .bda-insight-block {
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Parsers (backward-compatible with old cached formats) ─────────────

interface ParsedInsight {
  headline: string;
  body: string;
  tags: string[];
}

function parseInsight(raw: string): ParsedInsight {
  const headlineMatch = raw.match(/^HEADLINE:\s*(.+?)(?:\n|$)/m);
  const bodyMatch = raw.match(/^BODY:\s*([\s\S]+?)(?=\nTAGS:|$)/m);
  const tagsMatch = raw.match(/^TAGS:\s*(.+?)$/m);

  if (headlineMatch?.[1]) {
    return {
      headline: headlineMatch[1].trim(),
      body: bodyMatch?.[1]?.trim() ?? "",
      tags: tagsMatch?.[1]
        ? tagsMatch[1]
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [],
    };
  }

  const sentences = raw.match(/[^.!?]+[.!?]+/g) ?? [raw];
  return {
    headline: (sentences[0] ?? raw).trim(),
    body: sentences.slice(1).join(" ").trim(),
    tags: [],
  };
}

function parseFirstImpression(raw: string): {
  headline: string;
  subline: string | null;
} {
  const headlineMatch = raw.match(/^HEADLINE:\s*(.+?)(?:\n|$)/m);
  const sublineMatch = raw.match(/^SUBLINE:\s*(.+?)$/m);

  if (headlineMatch?.[1]) {
    return {
      headline: headlineMatch[1].trim(),
      subline: sublineMatch?.[1]?.trim() ?? null,
    };
  }

  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { headline: "", subline: null };

  const sentenceMatch = trimmed.match(/^([\s\S]+?[.?!])(\s+([\s\S]+))?$/);
  if (sentenceMatch) {
    const first = sentenceMatch[1].trim();
    const rest = sentenceMatch[3]?.trim() ?? null;
    if (first.length <= 60) {
      return { headline: first, subline: rest };
    }
    const splitMatch = first.match(/^(.+?)[,](\s+)(.+[.?!])$/);
    if (splitMatch) {
      return {
        headline: splitMatch[1].trim() + ",",
        subline: splitMatch[3].trim() + (rest ? " " + rest : ""),
      };
    }
  }
  return { headline: trimmed, subline: null };
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

  portraitText = portraitText.replace(portraitMarker, "").trim();

  const keyInsights: KeyInsight[] = [];
  const insightBlocks = insightsBlock
    .split("---")
    .filter((b) => b.trim().length > 0);

  for (const block of insightBlocks) {
    const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?:\n|$)/);
    const followMatch = block.match(
      /FOLLOW_THROUGH:\s*([\s\S]+?)(?=EVIDENCE:|$)/,
    );
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

  const candidates: Array<{
    text: string;
    paraIndex: number;
    score: number;
  }> = [];

  paragraphs.forEach((para, paraIndex) => {
    if (paraIndex === 0) return;
    const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [];
    for (const raw of sentences) {
      const s = raw.trim();
      if (s.length >= 25 && s.length <= 90) {
        const score = 100 - s.length;
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
