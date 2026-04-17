"use client";

/**
 * QuestionCardClient — interactive card-per-question UI.
 *
 * One question per screen, four branded option cards. Selecting submits via
 * `submitAnswer`, the server redirects to the next question.
 *
 * Visual register matches `mockup-brand-dna.html` `.question-scene`:
 * Righteous eyebrow with hairline rule, DM Sans 38px question text in
 * brand-cream, optional italic hint, 2-column option grid (1-col on mobile),
 * brand-red selected state.
 *
 * Two BDA-2 defects fixed in this revision:
 *   1. Lime-yellow `--color-brand-primary` selected fallback removed —
 *      selected state is brand-red (mockup palette).
 *   2. Selection state was leaking between questions when the layout was
 *      preserved across a redirect (the same client component instance
 *      received a new `question` prop while keeping `selected` set). Fixed
 *      by resetting `selected`/`pending` on `question.id` change.
 *
 * Owners: BDA-2 (logic), BDA-POLISH-1 (visual port + leak fix).
 */

import * as React from "react";
import { motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";
import type { Question } from "@/lib/brand-dna/question-bank";
import { resolveQuestionText } from "@/lib/brand-dna/question-bank";

import { OptionCard } from "@/components/lite/brand-dna/option-card";

interface QuestionCardClientProps {
  question: Question;
  profileId: string;
  section: 1 | 2 | 3 | 4 | 5;
  questionIndex: number;
  totalInSection: number;
  sectionTitle: string;
  track: string | null;
  submitAction: (formData: FormData) => Promise<void>;
}

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

export function QuestionCardClient({
  question,
  profileId,
  section,
  questionIndex,
  totalInSection,
  sectionTitle,
  track,
  submitAction,
}: QuestionCardClientProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Defect-fix: when the page redirects to the next question, the layout is
  // preserved and this client component is reconciled with a new `question`
  // prop — `selected` would otherwise carry forward and pre-highlight an
  // option on the new question. Reset on every question id change.
  React.useEffect(() => {
    setSelected(null);
    setPending(false);
  }, [question.id]);

  async function handleSelect(optionKey: string) {
    if (pending) return;
    setSelected(optionKey);
    setPending(true);

    const option = question.options[optionKey as keyof typeof question.options];
    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("questionId", question.id);
    fd.set("section", String(section));
    fd.set("selectedOption", optionKey);
    fd.set("tagsAwarded", JSON.stringify(option.tags));

    await submitAction(fd);
    // redirect() runs server-side — unreachable on success.
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
        key={question.id}
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
          <span>
            {sectionTitle} · Q{questionIndex + 1} of {totalInSection}
          </span>
          <span
            aria-hidden="true"
            style={{ flex: 1, height: 1, background: "rgba(244, 160, 176, 0.2)" }}
          />
        </div>

        <h2
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
          {resolveQuestionText(question, (track === "business" ? "business" : "founder") as "founder" | "business")}
        </h2>

        <div
          className="bda-options-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {OPTION_KEYS.map((key) => {
            const option = question.options[key];
            return (
              <OptionCard
                key={`${question.id}-${key}`}
                letter={key.toUpperCase()}
                text={option.text}
                selected={selected === key}
                disabled={pending}
                onClick={() => void handleSelect(key)}
              />
            );
          })}
        </div>
      </motion.div>

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.bda-options-grid) {
            grid-template-columns: 1fr !important;
          }
          h2 {
            font-size: 28px !important;
          }
        }
      `}</style>
    </main>
  );
}
