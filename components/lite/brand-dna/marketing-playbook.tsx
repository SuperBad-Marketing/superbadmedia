"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type {
  MarketingPlaybook as MarketingPlaybookData,
  MarketingPlaybookSection,
} from "@/lib/brand-dna/generate-marketing-playbook";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SECTION_ICONS: Record<string, string> = {
  "Copywriting & Written Marketing": "01",
  "Video Content": "02",
  "Social Media Presence": "03",
  "Visual Identity & Photography": "04",
  "Advertising & Paid Media": "05",
};

function PlaybookSection({
  section,
  index,
}: {
  section: MarketingPlaybookSection;
  index: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduced = useReducedMotion();
  const isOdd = index % 2 === 1;

  return (
    <div
      ref={ref}
      style={{
        background: isOdd
          ? "var(--color-neutral-800, #252320)"
          : "var(--color-neutral-900, #1A1A18)",
        padding: "72px 24px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Section number */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...houseSpring, delay: 0 }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 64,
              lineHeight: 1,
              letterSpacing: "-3px",
              color: "var(--brand-pink)",
              opacity: 0.12,
              display: "block",
              marginBottom: -8,
            }}
          >
            {SECTION_ICONS[section.title] ?? String(index + 1).padStart(2, "0")}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...houseSpring, delay: 0.06 }}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(22px, 3.5vw, 30px)",
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            color: "var(--brand-cream)",
            margin: "0 0 20px",
          }}
        >
          {section.title}
        </motion.h3>

        {/* Overview */}
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...houseSpring, delay: 0.12 }}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(15px, 2vw, 17px)",
            lineHeight: 1.7,
            color: "var(--brand-cream)",
            opacity: 0.7,
            margin: "0 0 36px",
          }}
        >
          {section.overview}
        </motion.p>

        {/* Examples */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {section.examples.map((example, ei) => (
            <motion.div
              key={ei}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ ...houseSpring, delay: 0.2 + ei * 0.1 }}
              style={{
                borderLeft: "2px solid var(--brand-pink)",
                paddingLeft: 20,
                opacity: 0.85,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
                  margin: "0 0 8px",
                }}
              >
                {example.scenario}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: "var(--brand-cream)",
                  opacity: 0.6,
                  margin: 0,
                }}
              >
                {example.guidance}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MarketingPlaybookProps {
  playbook: MarketingPlaybookData;
}

export function MarketingPlaybook({ playbook }: MarketingPlaybookProps) {
  const labelRef = React.useRef<HTMLDivElement>(null);
  const labelInView = useInView(labelRef, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  return (
    <div>
      {/* Section header */}
      <div
        ref={labelRef}
        style={{
          background: "var(--color-neutral-900, #1A1A18)",
          padding: "80px 24px 0",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={labelInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ maxWidth: 640, margin: "0 auto" }}
        >
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(to right, transparent, rgba(253,245,230,0.08), transparent)",
              marginBottom: 48,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--brand-orange)",
              display: "block",
              marginBottom: 16,
            }}
          >
            Your marketing playbook
          </span>
          <p
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(16px, 2.2vw, 20px)",
              lineHeight: 1.7,
              color: "var(--brand-cream)",
              opacity: 0.6,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            How your DNA translates into the day-to-day. Five disciplines,
            tailored to what makes you different.
          </p>
        </motion.div>
      </div>

      {/* Discipline sections */}
      {playbook.sections.map((section, i) => (
        <PlaybookSection key={section.title} section={section} index={i} />
      ))}
    </div>
  );
}
