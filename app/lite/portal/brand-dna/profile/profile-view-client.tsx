"use client";

/**
 * ProfileViewClient — permanent revisitable Brand DNA profile page.
 *
 * Shows the full profile (first impression, section insights, prose portrait),
 * the company blend (if multi-stakeholder), and a retake trigger.
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
                  paddingTop: 24,
                  borderTop: "1px solid rgba(253, 245, 230, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
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
                    fontFamily: "var(--font-body)",
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: "var(--neutral-400)",
                    margin: 0,
                  }}
                >
                  {insight}
                </p>
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
    </main>
  );
}
