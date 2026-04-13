"use client";

/**
 * AlignmentGateClient — interactive alignment gate UI.
 *
 * Renders three track-selection cards with houseSpring animations.
 * Submits via the submitAlignmentGate Server Action.
 *
 * Motion: cards use Framer Motion with houseSpring on hover and selection.
 * AnimatePresence handles the stagger entrance of the three options.
 *
 * Owner: BDA-2.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

const TRACKS = [
  {
    value: "founder",
    heading: "Completely.",
    description: "My business is a direct extension of who I am.",
    emoji: "◎",
  },
  {
    value: "founder_supplement",
    heading: "Somewhere in between.",
    description: "There's overlap, but they're not the same thing.",
    emoji: "◑",
  },
  {
    value: "business",
    heading: "Not really.",
    description: "It's more about the work and the clients.",
    emoji: "○",
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
    // redirect() is called inside the action — this line is unreachable on success
    setPending(false);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-6 py-16 gap-10">
      {/* Question */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        className="text-center max-w-prose"
      >
        <p
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--color-neutral-400, #9ca3af)" }}
        >
          Before we start
        </p>
        <h1
          className="text-2xl sm:text-3xl font-semibold leading-tight"
          style={{ color: "var(--color-neutral-50, #fafafa)" }}
        >
          Does your business represent your personality?
        </h1>
      </motion.div>

      {/* Track options */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        <AnimatePresence>
          {TRACKS.map((track, i) => {
            const isSelected = selected === track.value;
            const isOther = selected !== null && !isSelected;

            return (
              <motion.button
                key={track.value}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: isOther ? 0.4 : 1,
                  y: 0,
                  scale: isSelected ? 1.02 : 1,
                }}
                transition={{ ...houseSpring, delay: i * 0.06 }}
                whileHover={{ scale: pending ? 1 : 1.01 }}
                whileTap={{ scale: pending ? 1 : 0.99 }}
                onClick={() => void handleSelect(track.value)}
                disabled={pending}
                style={{
                  background: isSelected
                    ? "var(--color-brand-primary, #e8ff47)"
                    : "rgba(255,255,255,0.05)",
                  color: isSelected
                    ? "var(--color-neutral-950, #0a0a0a)"
                    : "var(--color-neutral-100, #f5f5f5)",
                  border: "1px solid",
                  borderColor: isSelected
                    ? "var(--color-brand-primary, #e8ff47)"
                    : "rgba(255,255,255,0.1)",
                  borderRadius: "var(--radius-card, 12px)",
                  padding: "1.25rem 1.5rem",
                  textAlign: "left",
                  cursor: pending ? "default" : "pointer",
                  width: "100%",
                }}
              >
                <span
                  className="block text-lg mb-1 font-medium"
                  style={{ opacity: 0.8 }}
                >
                  {track.emoji}
                </span>
                <span className="block font-semibold text-base leading-tight">
                  {track.heading}
                </span>
                <span
                  className="block text-sm mt-0.5"
                  style={{
                    color: isSelected
                      ? "var(--color-neutral-700, #404040)"
                      : "var(--color-neutral-400, #9ca3af)",
                  }}
                >
                  {track.description}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {errorParam && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm"
          style={{ color: "var(--color-semantic-error, #ef4444)" }}
        >
          Something went wrong. Please try again.
        </motion.p>
      )}
    </main>
  );
}
