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
import { getVisualPreview } from "@/components/lite/brand-dna/question-visuals";
import { OverallProgressBar } from "@/components/lite/brand-dna/overall-progress-bar";
import { getNudge } from "@/lib/brand-dna/encouragement-nudges";

const SECTION_OFFSETS = [0, 19, 43, 63, 82, 102];

const SECTION_START_HUE: Record<number, string> = {
  1: "178, 40, 72",
  2: "192, 50, 72",
  3: "210, 70, 68",
  4: "230, 90, 76",
  5: "244, 160, 176",
};
const SECTION_END_HUE: Record<number, string> = {
  1: "192, 50, 72",
  2: "210, 70, 68",
  3: "230, 90, 76",
  4: "244, 160, 176",
  5: "253, 245, 230",
};

interface QuestionCardClientProps {
  question: Question;
  profileId: string;
  section: 1 | 2 | 3 | 4 | 5;
  questionIndex: number;
  totalInSection: number;
  sectionTitle: string;
  track: string | null;
  submitAction: (formData: FormData) => Promise<void>;
  goBackAction?: (formData: FormData) => Promise<void>;
  restartAction?: (formData: FormData) => Promise<void>;
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
  goBackAction,
  restartAction,
}: QuestionCardClientProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [confirmRestart, setConfirmRestart] = React.useState(false);
  const canGoBack = goBackAction && (questionIndex > 0 || section > 1);
  const nudge = getNudge(section, questionIndex);

  // Defect-fix: when the page redirects to the next question, the layout is
  // preserved and this client component is reconciled with a new `question`
  // prop — `selected` would otherwise carry forward and pre-highlight an
  // option on the new question. Reset on every question id change.
  React.useEffect(() => {
    setSelected(null);
    setPending(false);
    setConfirmRestart(false);
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

  async function handleGoBack() {
    if (pending || !goBackAction) return;
    setPending(true);

    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("section", String(section));
    fd.set("questionIndex", String(questionIndex));

    await goBackAction(fd);
    setPending(false);
  }

  async function handleRestart() {
    if (pending || !restartAction) return;
    setPending(true);

    const fd = new FormData();
    fd.set("profileId", profileId);

    await restartAction(fd);
    setPending(false);
  }

  return (
    <>
    <OverallProgressBar
      section={section}
      questionIndex={questionIndex}
      totalInSection={totalInSection}
    />
    <main
      className="bda-question-main"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 4vw, 40px)",
      }}
    >
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, duration: 0.9 }}
        className="bda-question-inner"
        style={{
          maxWidth: 780,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              {sectionTitle} · Q{SECTION_OFFSETS[section - 1] + questionIndex + 1} of {SECTION_OFFSETS[5]}
            </span>
            <span
              aria-hidden="true"
              style={{ flex: 1, height: 1, background: "rgba(244, 160, 176, 0.2)" }}
            />
          </div>

          {/* Section progress bar */}
          <div
            aria-hidden
            style={{
              width: "min(120px, 30vw)",
              height: 3,
              borderRadius: 3,
              background: "rgba(253, 245, 230, 0.06)",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={false}
              animate={{ scaleX: totalInSection > 0 ? questionIndex / totalInSection : 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                height: "100%",
                borderRadius: 3,
                transformOrigin: "left",
                background: `linear-gradient(90deg, rgb(${SECTION_START_HUE[section] ?? "178, 40, 72"}), rgb(${SECTION_END_HUE[section] ?? "244, 160, 176"}))`,
              }}
            />
          </div>

          {nudge && (
            <motion.p
              key={`nudge-${question.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: "clamp(12px, 2vw, 13px)",
                lineHeight: 1.5,
                color: "var(--brand-pink)",
                margin: 0,
              }}
            >
              {nudge}
            </motion.p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "clamp(24px, 5vw, 38px)",
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
            aria-hidden="true"
            style={{
              width: 48,
              height: 2,
              borderRadius: 2,
              background: "linear-gradient(90deg, var(--brand-pink), transparent)",
              opacity: 0.5,
            }}
          />
        </div>

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
                visual={question.visual ? getVisualPreview(question.id, key, selected === key) : undefined}
              />
            );
          })}
        </div>

        <div className="bda-question-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {canGoBack ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleGoBack()}
              className="bda-back-btn"
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--neutral-500)",
                background: "transparent",
                border: "none",
                cursor: pending ? "default" : "pointer",
                padding: "8px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: pending ? 0.4 : 1,
                transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 14 }}>←</span>
              Back
            </button>
          ) : <span />}

          {restartAction && (
            confirmRestart ? (
              <span
                className="bda-restart-confirm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "var(--font-label)",
                  fontSize: 11,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "var(--neutral-500)",
                  flexWrap: "wrap",
                }}
              >
                <span>Clear all answers?</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleRestart()}
                  className="bda-restart-confirm-btn"
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 11,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "var(--brand-pink)",
                    background: "transparent",
                    border: "none",
                    cursor: pending ? "default" : "pointer",
                    padding: "8px 0",
                    opacity: pending ? 0.4 : 1,
                    transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  Yes, start over
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestart(false)}
                  className="bda-restart-cancel-btn"
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 11,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "var(--neutral-500)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px 0",
                    transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmRestart(true)}
                className="bda-restart-btn"
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 11,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "var(--neutral-500)",
                  background: "transparent",
                  border: "none",
                  cursor: pending ? "default" : "pointer",
                  padding: "8px 0",
                  opacity: pending ? 0.4 : 1,
                  transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                Start over
              </button>
            )
          )}
        </div>
      </motion.div>

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.bda-options-grid) {
            grid-template-columns: 1fr !important;
          }
          .bda-question-main {
            padding: 20px !important;
          }
          :global(.bda-question-inner) {
            gap: 24px !important;
          }
          :global(.bda-question-inner h2) {
            font-size: 26px !important;
            letter-spacing: -0.5px !important;
          }
          :global(.bda-question-footer) {
            flex-direction: column !important;
            gap: 12px !important;
            align-items: stretch !important;
          }
          :global(.bda-restart-confirm) {
            justify-content: center !important;
            gap: 8px !important;
          }
        }
        :global(.bda-back-btn:hover:not(:disabled)) {
          color: var(--brand-pink) !important;
        }
        :global(.bda-restart-btn:hover:not(:disabled)) {
          color: var(--brand-cream) !important;
        }
        :global(.bda-restart-cancel-btn:hover) {
          color: var(--brand-cream) !important;
        }
      `}</style>
    </main>
    </>
  );
}
