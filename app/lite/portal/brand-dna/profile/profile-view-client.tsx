"use client";

/**
 * ProfileViewClient — permanent revisitable Brand DNA profile page.
 *
 * Shows the full profile (first impression, signal tags, section insights,
 * prose portrait with pull quotes + drop cap), the company blend (if
 * multi-stakeholder), and a retake trigger.
 *
 * Owner: BDA-5.
 */

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

import { houseSpring } from "@/lib/design-tokens";

interface ProfileViewClientProps {
  displayName: string;
  firstImpression: string;
  prosePortrait: string;
  sectionInsights: string[];
  sectionTitles: string[];
  signalTags: string[];
  version: number;
  needsRegeneration: boolean;
  blendPortrait: string | null;
  blendDivergences: Array<{
    domain: string;
    tag: string;
    description: string;
  }>;
}

export function ProfileViewClient({
  displayName,
  firstImpression,
  prosePortrait,
  sectionInsights,
  sectionTitles,
  signalTags,
  version,
  needsRegeneration,
  blendPortrait,
  blendDivergences,
}: ProfileViewClientProps) {
  const paragraphs = prosePortrait
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const pullQuotes = extractPullQuotes(prosePortrait);

  return (
    <main
      className="bda-profile-main"
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
        className="bda-profile-inner"
        style={{
          maxWidth: 780,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...houseSpring, duration: 1.0 }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
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
            {displayName}&apos;s Brand DNA
            {version > 1 && ` · v${version}`}
          </span>

          {needsRegeneration && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(194, 59, 34, 0.15)",
                border: "1px solid rgba(194, 59, 34, 0.3)",
                fontSize: 14,
                color: "var(--brand-cream)",
              }}
            >
              Your business shape has changed since this was generated. A retake
              is recommended.
            </div>
          )}

          <h1
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: 28,
              lineHeight: 1.35,
              color: "var(--brand-cream)",
              letterSpacing: "-0.3px",
              margin: 0,
            }}
          >
            &ldquo;{firstImpression}&rdquo;
          </h1>
        </motion.section>

        {/* Signal tag pills */}
        {signalTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
            aria-label="Signal tags"
          >
            {signalTags.map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  ...houseSpring,
                  delay: 0.2 + i * 0.06,
                }}
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
                  padding: "7px 14px",
                  border: "1px solid rgba(244, 160, 176, 0.2)",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* Section insights */}
        {sectionInsights.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 40 }}
          >
            {sectionInsights.map((insight, index) => (
              <motion.section
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...houseSpring,
                  duration: 0.8,
                  delay: 0.1 + index * 0.1,
                }}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(40px, 5vw, 56px)",
                    lineHeight: 0.85,
                    color: "rgba(178, 40, 72, 0.12)",
                    flexShrink: 0,
                    userSelect: "none",
                    minWidth: "1.2ch",
                    textAlign: "right",
                  }}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    paddingLeft: 16,
                    borderLeft: "2px solid rgba(244, 160, 176, 0.15)",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "2px",
                      color: "var(--brand-pink)",
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    {sectionTitles[index] ?? `Section ${index + 1}`}
                  </h2>
                  <p
                    style={{
                      fontFamily: "var(--font-narrative)",
                      fontStyle: "italic",
                      fontSize: "clamp(15px, 1.8vw, 18px)",
                      lineHeight: 1.7,
                      color: "var(--neutral-300)",
                      margin: 0,
                    }}
                  >
                    {insight}
                  </p>
                </div>
              </motion.section>
            ))}
          </div>
        )}

        {/* Prose portrait */}
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...houseSpring, duration: 1.0, delay: 0.3 }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {/* Animated divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{
              height: 1,
              background: "linear-gradient(to right, transparent, rgba(253, 245, 230, 0.12), transparent)",
              marginBottom: 28,
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
              margin: "0 0 20px 0",
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
                      fontSize: 17,
                      lineHeight: 1.7,
                      color: "var(--neutral-300)",
                      margin: "0 0 18px 0",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 48,
                        lineHeight: 0.85,
                        float: "left",
                        color: "var(--brand-pink)",
                        marginRight: 8,
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
                      fontSize: 17,
                      lineHeight: 1.7,
                      color: "var(--neutral-300)",
                      margin: "0 0 18px 0",
                    }}
                  >
                    {para}
                  </p>
                )}
                {pullQuote && (
                  <blockquote
                    style={{
                      fontFamily: "var(--font-narrative)",
                      fontStyle: "italic",
                      fontSize: "clamp(20px, 3vw, 28px)",
                      lineHeight: 1.35,
                      color: "var(--brand-pink)",
                      margin: "28px 0 32px 0",
                      padding: "0 0 0 20px",
                      borderLeft: "3px solid rgba(178, 40, 72, 0.3)",
                    }}
                  >
                    {pullQuote.text}
                  </blockquote>
                )}
              </React.Fragment>
            );
          })}
        </motion.article>

        {/* Company blend */}
        {blendPortrait && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...houseSpring, duration: 1.0, delay: 0.5 }}
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
                color: "var(--brand-orange)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              The company blend
            </h2>
            {blendPortrait
              .trim()
              .split(/\n{2,}/)
              .map((para, i) => (
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
                  {para.trim()}
                </p>
              ))}

            {blendDivergences.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: "2px",
                    color: "var(--brand-pink)",
                    textTransform: "uppercase",
                    margin: "0 0 12px 0",
                  }}
                >
                  Where you diverge
                </h3>
                {blendDivergences.map((d, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "var(--neutral-400)",
                      margin: "0 0 8px 0",
                      paddingLeft: 12,
                      borderLeft: "2px solid rgba(244, 160, 176, 0.2)",
                    }}
                  >
                    {d.description}
                  </p>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* Retake trigger */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{
            paddingTop: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Link
            href="/lite/portal/brand-dna/retake"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              background: "transparent",
              border: "1px solid rgba(253, 245, 230, 0.12)",
              borderRadius: 999,
              padding: "12px 28px",
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Retake assessment
          </Link>
          <p
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--neutral-600)",
              textAlign: "center",
            }}
          >
            Full retake from scratch. Your current profile stays archived.
          </p>
        </motion.div>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          .bda-profile-main {
            padding: 24px 20px 60px !important;
          }
          :global(.bda-profile-inner) {
            gap: 36px !important;
          }
          :global(.bda-profile-inner p) {
            font-size: 15px !important;
          }
        }
      `}</style>
    </main>
  );
}

function extractPullQuotes(
  portrait: string,
): Array<{ text: string; afterParagraph: number }> {
  const paragraphs = portrait
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
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
