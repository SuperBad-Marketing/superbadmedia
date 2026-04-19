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
        <div className="mb-6">
          <h4 className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)]">
            {section.heading}
          </h4>
          <p className="mt-1 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
            {section.subline}
          </p>
        </div>
      )}

      {/* Progress */}
      <div className="mb-4 flex gap-1">
        {section.questions.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentQuestion
                ? "bg-[color:var(--color-brand-red)]"
                : "bg-[color:var(--color-neutral-700)]"
            }`}
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
      <div className="mt-4 flex gap-3">
        {question.freeText && (
          <button
            type="button"
            onClick={advanceQuestion}
            disabled={isPending}
            className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
          >
            Skip
          </button>
        )}
        {hasAnswer && (
          <button
            type="button"
            onClick={advanceQuestion}
            disabled={isPending}
            className="ml-auto rounded-lg bg-[color:var(--color-brand-red)] px-5 py-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] transition hover:brightness-110 disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
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
        <p className="mb-3 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
          {question.question}
        </p>
        <textarea
          value={currentAnswer ?? ""}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder={question.placeholder}
          maxLength={question.charLimit}
          rows={4}
          className="w-full resize-none rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3.5 py-2.5 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:border-[color:var(--color-brand-red)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-red)]"
        />
        {question.charLimit && (
          <p className="mt-1 text-right font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
            {(currentAnswer?.length ?? 0)}/{question.charLimit}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
        {question.question}
      </p>
      <div className="space-y-2">
        {question.options?.map((option) => (
          <motion.button
            key={option}
            type="button"
            onClick={() => onAnswer(question.id, option)}
            whileTap={{ scale: 0.98 }}
            transition={houseSpring}
            className={`w-full rounded-lg px-4 py-3 text-left font-[family-name:var(--font-body)] text-[14px] transition-colors ${
              currentAnswer === option
                ? "bg-[color:var(--color-brand-red)] text-[color:var(--color-brand-cream)]"
                : "bg-[color:var(--color-neutral-800)] text-[color:var(--color-neutral-300)] hover:bg-[color:var(--color-neutral-700)]"
            }`}
          >
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
