"use client";

import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import { getSections, type QuestionDef } from "./questionnaire-data";
import { saveAnswerAction, completeSectionAction } from "./questionnaire-actions";
import type { FunnelShape } from "@/lib/db/schema/intro-funnel-submissions";

interface QuestionnairePanelProps {
  token: string;
  submissionId: string;
  shape: FunnelShape;
  sectionsCompleted: number;
  existingAnswers: Record<string, unknown> | null;
}

export function QuestionnairePanel({
  token,
  submissionId,
  shape,
  sectionsCompleted,
  existingAnswers,
}: QuestionnairePanelProps) {
  const sections = getSections(shape);
  const [currentSection, setCurrentSection] = useState(sectionsCompleted);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    (existingAnswers as Record<string, string>) ?? {},
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const section = sections[currentSection];
  if (!section) return null;

  const question = section.questions[currentQuestion];
  if (!question) return null;

  const isLastQuestion = currentQuestion === section.questions.length - 1;
  const isLastSection = currentSection === sections.length - 1;

  const handleAnswer = useCallback(
    (questionId: string, answer: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      startTransition(async () => {
        await saveAnswerAction({ submissionId, questionId, answer });
      });
    },
    [submissionId],
  );

  function advanceQuestion() {
    if (isLastQuestion) {
      const sectionNumber = currentSection + 2;
      startTransition(async () => {
        const result = await completeSectionAction({
          submissionId,
          sectionNumber,
        });
        if (result.allComplete) {
          router.refresh();
        } else {
          setCurrentSection((s) => s + 1);
          setCurrentQuestion(0);
        }
      });
    } else {
      setCurrentQuestion((q) => q + 1);
    }
  }

  const hasAnswer = question.freeText
    ? (answers[question.id]?.length ?? 0) > 0
    : !!answers[question.id];

  return (
    <div>
      {/* Section intro */}
      {currentQuestion === 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
              margin: 0,
            }}
          >
            {section.heading}
          </h4>
          <p
            style={{
              marginTop: 6,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--neutral-500)",
            }}
          >
            {section.subline}
          </p>
        </div>
      )}

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {section.questions.map((_, i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background:
                i <= currentQuestion
                  ? "var(--brand-red)"
                  : "var(--neutral-700)",
              transition: "background 300ms ease",
            }}
          />
        ))}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={houseSpring}
        >
          <QuestionCard
            question={question}
            currentAnswer={answers[question.id]}
            onAnswer={handleAnswer}
          />
        </motion.div>
      </AnimatePresence>

      {/* Next / Skip */}
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {question.freeText && (
          <button
            type="button"
            onClick={advanceQuestion}
            disabled={isPending}
            style={{
              background: "none",
              border: "none",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--neutral-500)",
              cursor: "pointer",
              padding: 0,
              transition: "color 200ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--neutral-300)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--neutral-500)";
            }}
          >
            Skip
          </button>
        )}
        {hasAnswer && (
          <button
            type="button"
            onClick={advanceQuestion}
            disabled={isPending}
            style={{
              marginLeft: "auto",
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: isPending ? "var(--neutral-700)" : "var(--brand-red)",
              color: "var(--brand-cream)",
              fontFamily: "var(--font-label)",
              fontSize: 12,
              letterSpacing: "2px",
              textTransform: "uppercase",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.5 : 1,
              boxShadow: isPending
                ? "none"
                : "0 6px 20px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)",
              transition:
                "transform 280ms cubic-bezier(0.2,0.8,0.2,1.05), box-shadow 280ms cubic-bezier(0.2,0.8,0.2,1.05), opacity 280ms ease",
            }}
            onMouseEnter={(e) => {
              if (!isPending) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 10px 28px rgba(178,40,72,0.4), inset 0 1px 0 rgba(253,245,230,0.15)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              if (!isPending) {
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)";
              }
            }}
          >
            {isPending
              ? "Saving\u2026"
              : isLastQuestion && isLastSection
                ? "Finish"
                : isLastQuestion
                  ? "Next section"
                  : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  currentAnswer,
  onAnswer,
}: {
  question: QuestionDef;
  currentAnswer?: string;
  onAnswer: (questionId: string, answer: string) => void;
}) {
  if (question.freeText) {
    return (
      <div>
        <p
          style={{
            marginBottom: 12,
            fontFamily: "var(--font-body)",
            fontSize: 15,
            color: "var(--brand-cream)",
          }}
        >
          {question.question}
        </p>
        <textarea
          value={currentAnswer ?? ""}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder={question.placeholder}
          maxLength={question.charLimit}
          rows={4}
          style={{
            width: "100%",
            resize: "none",
            padding: "14px 16px",
            borderRadius: 8,
            border: "1px solid rgba(253,245,230,0.08)",
            background: "var(--neutral-800)",
            boxShadow: "inset 0 1px 0 rgba(253,245,230,0.04)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--brand-cream)",
            outline: "none",
            transition: "border-color 250ms cubic-bezier(0.16,1,0.3,1)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(244,160,176,0.4)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(253,245,230,0.08)";
          }}
        />
        {question.charLimit && (
          <p
            style={{
              marginTop: 4,
              textAlign: "right",
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "var(--neutral-500)",
            }}
          >
            {(currentAnswer?.length ?? 0)}/{question.charLimit}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p
        style={{
          marginBottom: 12,
          fontFamily: "var(--font-body)",
          fontSize: 15,
          color: "var(--brand-cream)",
        }}
      >
        {question.question}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options?.map((option) => (
          <motion.button
            key={option}
            type="button"
            onClick={() => onAnswer(question.id, option)}
            whileTap={{ scale: 0.98 }}
            transition={houseSpring}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "14px 20px",
              borderRadius: 12,
              border:
                currentAnswer === option
                  ? "1px solid var(--brand-red)"
                  : "1px solid rgba(253,245,230,0.08)",
              background:
                currentAnswer === option
                  ? "var(--brand-red)"
                  : "var(--neutral-800)",
              color:
                currentAnswer === option
                  ? "var(--brand-cream)"
                  : "var(--neutral-300)",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              cursor: "pointer",
              boxShadow:
                currentAnswer === option
                  ? "0 4px 16px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)"
                  : "inset 0 1px 0 rgba(253,245,230,0.04)",
              transition:
                "background 250ms cubic-bezier(0.16,1,0.3,1), border-color 250ms cubic-bezier(0.16,1,0.3,1), box-shadow 250ms cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={(e) => {
              if (currentAnswer !== option) {
                e.currentTarget.style.background = "var(--neutral-700)";
                e.currentTarget.style.borderColor = "rgba(244,160,176,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              if (currentAnswer !== option) {
                e.currentTarget.style.background = "var(--neutral-800)";
                e.currentTarget.style.borderColor = "rgba(253,245,230,0.08)";
              }
            }}
          >
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
