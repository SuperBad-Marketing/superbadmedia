"use client";

/**
 * RevealClient — the cinematic Brand DNA reveal.
 *
 * Sequence (per `docs/specs/brand-dna-assessment.md` §10.5):
 *   1. `sound:brand_dna_reveal` fires on mount
 *   2. First impression fades in alone (stillness, ~1.2s)
 *   3. Beat — 2–3 seconds of held stillness
 *   4. Section-by-section build — each section label + insight + chunk of
 *      prose materialises with `houseSpring`
 *   5. Full prose portrait lands as the finale
 *   6. `markProfileComplete(profileId)` fires at the end
 *
 * Uses the Tier 2 `brand-dna-reveal` choreography for the first-impression
 * reveal; Tier 1 `houseSpring` drives the per-section stagger. Reduced
 * motion degrades to fades without breaking layout.
 *
 * Owner: BDA-3.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { SessionProvider, useSession } from "next-auth/react";

import { useSound } from "@/components/lite/sound-provider";
import { tier2 } from "@/lib/motion/choreographies";
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
  // SessionProvider is scoped here so `useSession().update()` can re-mint
  // Andy's JWT once `markProfileComplete` resolves. Narrowest possible
  // surface — only the reveal tree needs session-aware hooks. BDA-4.
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
  const choreography = tier2["brand-dna-reveal"];

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
        // Re-mint the JWT with brand_dna_complete=true so the gate clears
        // without a manual sign-out. BDA-4.
        await update();
      })();
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(fire);
    };
  }, [phase, alreadyComplete, profileId, update]);

  const paragraphs = splitPortraitParagraphs(prosePortrait);

  return (
    <div className="flex flex-col items-center gap-14 w-full max-w-2xl px-4 py-16">
      {/* First impression — always on screen; fades in on mount */}
      <motion.section
        variants={choreography.variants}
        initial="initial"
        animate="animate"
        transition={choreography.transition}
        className="text-center"
      >
        <p
          className="text-xs tracking-widest uppercase mb-6"
          style={{ color: "var(--color-neutral-500, #6b7280)" }}
        >
          Here you are
        </p>
        <p
          style={{
            color: "var(--color-neutral-50, #fafafa)",
            fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
            fontSize: "1.75rem",
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
          }}
        >
          {firstImpression}
        </p>
      </motion.section>

      {/* Section-by-section build — stagger starts during the "sections" phase */}
      {phase !== "impression" && sectionInsights.length > 0 && (
        <motion.section
          initial="initial"
          animate="animate"
          variants={choreography.container?.variants}
          transition={choreography.container?.transition}
          className="w-full flex flex-col gap-10"
          aria-label="Signal summary by section"
        >
          {sectionInsights.map((insightText, index) => {
            const sectionNumber = index + 1;
            const title = sectionTitles[index] ?? `Section ${sectionNumber}`;
            return (
              <motion.div
                key={sectionNumber}
                variants={{
                  initial: { opacity: 0, y: 12 },
                  animate: { opacity: 1, y: 0 },
                }}
                transition={houseSpring}
                className="flex flex-col gap-2"
              >
                <p
                  className="text-xs tracking-widest uppercase"
                  style={{ color: "var(--color-neutral-500, #6b7280)" }}
                >
                  Section {sectionNumber} · {title}
                </p>
                <p
                  style={{
                    color: "var(--color-neutral-100, #f5f5f5)",
                    fontSize: "1.0625rem",
                    lineHeight: 1.65,
                  }}
                >
                  {insightText}
                </p>
              </motion.div>
            );
          })}
        </motion.section>
      )}

      {/* Full prose portrait — fades in as the finale */}
      {phase === "portrait" && (
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...houseSpring, delay: 0.1 }}
          className="w-full flex flex-col gap-5"
          aria-label="Prose portrait"
        >
          <p
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--color-neutral-500, #6b7280)" }}
          >
            The portrait
          </p>
          {paragraphs.map((para, i) => (
            <p
              key={i}
              style={{
                color: "var(--color-neutral-100, #f5f5f5)",
                fontSize: "1.0625rem",
                lineHeight: 1.75,
              }}
            >
              {para}
            </p>
          ))}
        </motion.article>
      )}
    </div>
  );
}

function splitPortraitParagraphs(portrait: string): string[] {
  const trimmed = portrait.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
