"use client";

/**
 * QuestionCardClient — interactive card-per-question UI.
 *
 * One question per screen with four option cards. Selecting an option
 * immediately submits via the submitAnswer Server Action.
 *
 * Motion: cards stagger in on load (houseSpring). Selected card scales up;
 * non-selected cards fade. Progress bar slides in.
 *
 * Owner: BDA-2.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { Question } from "@/lib/brand-dna/question-bank";

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
  submitAction,
}: QuestionCardClientProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const progressPct = Math.round((questionIndex / totalInSection) * 100);

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
    // redirect() is called server-side — unreachable on success
    setPending(false);
  }

  return (
    <main className="flex flex-col min-h-dvh">
      {/* Section header + progress */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        className="px-6 pt-8 pb-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--color-neutral-500, #6b7280)" }}
          >
            Section {section} — {sectionTitle}
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--color-neutral-500, #6b7280)" }}
          >
            {questionIndex + 1} / {totalInSection}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-0.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={houseSpring}
            style={{ background: "var(--color-brand-primary, #e8ff47)" }}
          />
        </div>
      </motion.header>

      {/* Question + options */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 gap-8 max-w-xl mx-auto w-full">
        <motion.h2
          key={question.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
          className="text-xl sm:text-2xl font-semibold text-center leading-snug"
          style={{ color: "var(--color-neutral-50, #fafafa)" }}
        >
          {question.text}
        </motion.h2>

        <div className="flex flex-col gap-3 w-full">
          <AnimatePresence>
            {OPTION_KEYS.map((key, i) => {
              const option =
                question.options[key as keyof typeof question.options];
              const isSelected = selected === key;
              const isOther = selected !== null && !isSelected;

              return (
                <motion.button
                  key={`${question.id}-${key}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{
                    opacity: isOther ? 0.35 : 1,
                    x: 0,
                    scale: isSelected ? 1.015 : 1,
                  }}
                  transition={{ ...houseSpring, delay: i * 0.05 }}
                  whileHover={{ scale: pending ? 1 : 1.008 }}
                  whileTap={{ scale: pending ? 1 : 0.995 }}
                  onClick={() => void handleSelect(key)}
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
                    padding: "1rem 1.25rem",
                    textAlign: "left",
                    cursor: pending ? "default" : "pointer",
                    width: "100%",
                    fontSize: "0.9375rem",
                    lineHeight: 1.4,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span
                    className="text-xs mr-2 font-mono"
                    style={{ opacity: 0.5 }}
                  >
                    {key.toUpperCase()}
                  </span>
                  {option.text}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
