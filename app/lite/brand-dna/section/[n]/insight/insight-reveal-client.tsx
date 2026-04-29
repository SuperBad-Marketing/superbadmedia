"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { houseSpring } from "@/lib/design-tokens";
import { OverallProgressBarStatic } from "@/components/lite/brand-dna/overall-progress-bar";

interface InsightRevealClientProps {
  insight: string;
  attribution?: string;
  nextHref?: string;
  nextLabel?: string;
  section?: 1 | 2 | 3 | 4 | 5;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function parseInsight(raw: string): {
  headline: string;
  body: string;
  tags: string[];
} {
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

export function InsightRevealClient({ insight, attribution, nextHref, nextLabel, section }: InsightRevealClientProps) {
  const { headline, body, tags } = parseInsight(insight);

  return (
    <>
    {section && <OverallProgressBarStatic section={section} />}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      style={{
        maxWidth: 620,
        width: "100%",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...houseSpring, delay: 0.2 }}
        style={{
          width: 40,
          height: 1,
          background: "var(--brand-red)",
          marginBottom: 40,
          transformOrigin: "center",
        }}
      />

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
        className="bda-insight-opener"
        style={{
          fontFamily: "var(--font-narrative)",
          fontStyle: "italic",
          fontSize: "clamp(22px, 3.5vw, 30px)",
          lineHeight: 1.45,
          color: "var(--brand-cream)",
          letterSpacing: "-0.2px",
          margin: "0 0 24px 0",
          maxWidth: 540,
        }}
      >
        {headline}
      </motion.p>

      {body && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
          className="bda-insight-body"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(15px, 2vw, 17px)",
            lineHeight: 1.7,
            color: "var(--brand-cream)",
            opacity: 0.65,
            margin: "0 0 32px 0",
            maxWidth: 500,
          }}
        >
          {body}
        </motion.p>
      )}

      {tags.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: body ? 0 : 32,
          }}
        >
          {tags.map((tag) => (
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
        </motion.div>
      )}

      {attribution && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8, ease: EASE }}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 9,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
            opacity: 0.6,
            margin: 0,
            marginTop: 32,
          }}
        >
          {attribution}
        </motion.p>
      )}

      {nextHref && nextLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5, ease: EASE }}
          style={{ marginTop: 40 }}
        >
          <Link href={nextHref} style={continuePillStyle}>
            {nextLabel}
          </Link>
        </motion.div>
      )}
    </motion.div>
    </>
  );
}

const continuePillStyle: React.CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: 11,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--brand-cream)",
  padding: "16px 36px",
  background: "rgba(253, 245, 230, 0.04)",
  border: "1px solid rgba(253, 245, 230, 0.15)",
  borderRadius: 999,
  textDecoration: "none",
  display: "inline-block",
  backdropFilter: "blur(8px)",
  boxShadow: "inset 0 1px 0 rgba(253, 245, 230, 0.06)",
  transition:
    "background 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1)",
};
