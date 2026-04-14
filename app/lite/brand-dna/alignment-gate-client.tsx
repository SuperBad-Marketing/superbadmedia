"use client";

/**
 * AlignmentGateClient — interactive alignment gate UI.
 *
 * One question, three branded option cards (founder / founder_supplement /
 * business). Submits via `submitAlignmentGate`. Visual register matches
 * `mockup-brand-dna.html`'s question scene — Righteous eyebrow + hairline
 * rule, DM Sans 38px question text, brand option cards.
 *
 * Owners: BDA-2 (logic), BDA-POLISH-1 (visual port).
 */

import * as React from "react";
import { motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";

import { OptionCard } from "@/components/lite/brand-dna/option-card";

const TRACKS = [
  {
    value: "founder",
    letter: "A",
    text: "Completely. My business is a direct extension of who I am.",
  },
  {
    value: "founder_supplement",
    letter: "B",
    text: "Somewhere in between. There's overlap, but they're not the same thing.",
  },
  {
    value: "business",
    letter: "C",
    text: "Not really. It's more about the work and the clients.",
  },
] as const;

interface AlignmentGateClientProps {
  submitAction: (formData: FormData) => Promise<void>;
  errorParam?: string;
}

export function AlignmentGateClient({
  submitAction,
  errorParam,
}: AlignmentGateClientProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSelect(track: string) {
    if (pending) return;
    setSelected(track);
    setPending(true);

    const fd = new FormData();
    fd.set("track", track);
    await submitAction(fd);
    setPending(false);
  }

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, duration: 0.9 }}
        style={{
          maxWidth: 780,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span>Before we start</span>
          <span
            aria-hidden="true"
            style={{ flex: 1, height: 1, background: "rgba(244, 160, 176, 0.2)" }}
          />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 38,
            lineHeight: 1.25,
            color: "var(--brand-cream)",
            letterSpacing: "-0.8px",
            maxWidth: 680,
            margin: 0,
          }}
        >
          Does your business represent your personality?
        </h1>

        <p
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--neutral-500)",
            marginTop: -16,
          }}
        >
          pick the one closest. you can change your mind later.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
          className="bda-options-grid"
        >
          {TRACKS.map((t) => (
            <OptionCard
              key={t.value}
              letter={t.letter}
              text={t.text}
              selected={selected === t.value}
              disabled={pending}
              onClick={() => void handleSelect(t.value)}
            />
          ))}
        </div>

        {errorParam && (
          <p
            role="alert"
            style={{
              fontSize: 14,
              color: "var(--brand-pink)",
            }}
          >
            Something went wrong. Please try again.
          </p>
        )}
      </motion.div>

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.bda-options-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
