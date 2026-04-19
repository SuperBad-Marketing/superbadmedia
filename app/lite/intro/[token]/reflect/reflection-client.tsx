"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import {
  REFLECTION_QUESTIONS,
  SAFETY_VALVE_PROMPT,
  SAFETY_VALVE_PLACEHOLDER,
  type ReflectionQuestion,
} from "./reflection-data";
import {
  saveReflectionAnswer,
  triggerSafetyValve,
  completeReflection,
  recordDecision,
} from "./reflection-actions";
import type { IntroFunnelReflectionRow } from "@/lib/db/schema/intro-funnel-reflections";

interface Props {
  token: string;
  submissionId: string;
  dealId: string;
  submissionName: string;
  existingReflection: IntroFunnelReflectionRow | null;
}

type Phase =
  | "intro"
  | "question"
  | "safety_valve_text"
  | "safety_valve_done"
  | "synthesis"
  | "decision"
  | "done";

export function ReflectionClient({
  token,
  submissionId,
  dealId,
  submissionName,
  existingReflection,
}: Props) {
  const router = useRouter();
  const firstName = submissionName.split(" ")[0];

  const alreadyCompleted = !!existingReflection?.completed_at_ms;

  const [phase, setPhase] = useState<Phase>(
    alreadyCompleted ? "done" : "intro",
  );
  const [questionIdx, setQuestionIdx] = useState(0);
  const [reflectionId, setReflectionId] = useState<string | undefined>(
    existingReflection?.id,
  );
  const [safetyText, setSafetyText] = useState("");
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentQ =
    questionIdx < REFLECTION_QUESTIONS.length
      ? REFLECTION_QUESTIONS[questionIdx]
      : null;

  function handleStart() {
    setPhase("question");
  }

  function handleAnswer(answer: string) {
    if (!currentQ) return;

    startTransition(async () => {
      const result = await saveReflectionAnswer({
        submissionId,
        dealId,
        questionIndex: currentQ.index,
        answer,
        reflectionId,
      });
      setReflectionId(result.reflectionId);

      // Q1 safety valve branch
      if (
        currentQ.index === 1 &&
        answer === "There was something off — I'd like to share"
      ) {
        setPhase("safety_valve_text");
        return;
      }

      // Advance to next question or synthesis
      if (questionIdx + 1 < REFLECTION_QUESTIONS.length) {
        setQuestionIdx(questionIdx + 1);
      } else {
        const { synthesisText: text } = await completeReflection(
          result.reflectionId,
          submissionId,
          dealId,
        );
        setSynthesisResult(text);
        setPhase("synthesis");
      }
    });
  }

  function handleSkip() {
    if (!currentQ) return;
    startTransition(async () => {
      const result = await saveReflectionAnswer({
        submissionId,
        dealId,
        questionIndex: currentQ.index,
        answer: "__skipped__",
        reflectionId,
      });
      setReflectionId(result.reflectionId);

      if (questionIdx + 1 < REFLECTION_QUESTIONS.length) {
        setQuestionIdx(questionIdx + 1);
      } else {
        const { synthesisText: text } = await completeReflection(
          result.reflectionId,
          submissionId,
          dealId,
        );
        setSynthesisResult(text);
        setPhase("synthesis");
      }
    });
  }

  function handleSafetyValveSubmit() {
    if (!reflectionId || !safetyText.trim()) return;
    startTransition(async () => {
      await triggerSafetyValve(reflectionId, submissionId, dealId, safetyText);
      setPhase("safety_valve_done");
    });
  }

  function handleDecision(choice: "yes_talk" | "think_about_it") {
    if (!reflectionId) return;
    startTransition(async () => {
      await recordDecision(reflectionId, submissionId, dealId, choice);
      setPhase("done");
      setTimeout(() => router.push(`/lite/intro/${token}`), 2000);
    });
  }

  const synthesisText =
    synthesisResult ??
    existingReflection?.synthesis_text ??
    "You showed up. That's the part most people talk about but don't do.\n\nEverything from the shoot — the photos, the video, the plan — it's in your portal whenever you're ready to look at it properly. Take your time with it.\n\nIf something clicks, you know where to find us.";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.12), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178,40,72,0.10), transparent 60%)",
          ].join(","),
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 520,
          margin: "0 auto",
          padding: "96px 24px",
        }}
      >
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={houseSpring}
              style={{ textAlign: "center" }}
            >
              <h1
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 12,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
                }}
              >
                A Few Things to Think About
              </h1>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  color: "var(--neutral-300)",
                  marginTop: 16,
                }}
              >
                This takes a couple of minutes. There&rsquo;s something at the
                end worth seeing.
              </p>
              <motion.button
                onClick={handleStart}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={houseSpring}
                style={{
                  marginTop: 40,
                  padding: "14px 40px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--brand-red)",
                  color: "var(--brand-cream)",
                  fontFamily: "var(--font-label)",
                  fontSize: 12,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Let&rsquo;s go
              </motion.button>
            </motion.div>
          )}

          {phase === "question" && currentQ && (
            <QuestionScreen
              key={`q-${currentQ.index}`}
              question={currentQ}
              onAnswer={handleAnswer}
              onSkip={currentQ.type === "freetext_optional" ? handleSkip : undefined}
              pending={pending}
              progress={questionIdx + 1}
              total={REFLECTION_QUESTIONS.length}
            />
          )}

          {phase === "safety_valve_text" && (
            <motion.div
              key="safety"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={houseSpring}
            >
              <p
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: 20,
                  color: "var(--brand-cream)",
                  lineHeight: 1.4,
                }}
              >
                {SAFETY_VALVE_PROMPT}
              </p>
              <textarea
                value={safetyText}
                onChange={(e) => setSafetyText(e.target.value.slice(0, 1000))}
                placeholder={SAFETY_VALVE_PLACEHOLDER}
                style={{
                  marginTop: 24,
                  width: "100%",
                  minHeight: 120,
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(253,245,230,0.12)",
                  background: "rgba(34,34,31,0.7)",
                  color: "var(--brand-cream)",
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  resize: "vertical",
                }}
              />
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--neutral-500)",
                  marginTop: 8,
                }}
              >
                Andy will read this personally and get back to you.
              </p>
              <motion.button
                onClick={handleSafetyValveSubmit}
                disabled={!safetyText.trim() || pending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={houseSpring}
                style={{
                  marginTop: 24,
                  padding: "14px 32px",
                  borderRadius: 12,
                  border: "none",
                  background: safetyText.trim()
                    ? "var(--brand-red)"
                    : "var(--neutral-700)",
                  color: safetyText.trim()
                    ? "var(--brand-cream)"
                    : "var(--neutral-500)",
                  fontFamily: "var(--font-label)",
                  fontSize: 12,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  cursor: safetyText.trim() ? "pointer" : "not-allowed",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                {pending ? "Sending…" : "Send this through"}
              </motion.button>
            </motion.div>
          )}

          {phase === "safety_valve_done" && (
            <motion.div
              key="safety-done"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={houseSpring}
              style={{ textAlign: "center" }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: 24,
                  color: "var(--brand-cream)",
                }}
              >
                Got it. Andy will be in touch.
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                  marginTop: 12,
                }}
              >
                Your photos, video, and plan are still in your portal — nothing
                changes there.
              </p>
              <a
                href={`/lite/intro/${token}`}
                style={{
                  display: "inline-block",
                  marginTop: 32,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--brand-pink)",
                  textDecoration: "none",
                }}
              >
                ← Back to portal
              </a>
            </motion.div>
          )}

          {phase === "synthesis" && (
            <motion.div
              key="synthesis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={houseSpring}
              style={{ textAlign: "center" }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 12,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
                }}
              >
                One More Thing
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  color: "var(--neutral-300)",
                  marginTop: 12,
                }}
              >
                We&rsquo;ve been listening. Here&rsquo;s what we heard.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...houseSpring, delay: 0.6 }}
                style={{
                  marginTop: 40,
                  textAlign: "left",
                }}
              >
                {synthesisText.split("\n\n").map((para, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: "var(--font-narrative)",
                      fontStyle: "italic",
                      fontSize: 18,
                      lineHeight: 1.7,
                      color: "var(--brand-cream)",
                      marginTop: i > 0 ? 20 : 0,
                    }}
                  >
                    {para}
                  </p>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...houseSpring, delay: 1.0 }}
                style={{
                  marginTop: 48,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <motion.button
                  onClick={() => handleDecision("yes_talk")}
                  disabled={pending}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={houseSpring}
                  style={{
                    padding: "16px 32px",
                    borderRadius: 12,
                    border: "none",
                    background: "var(--brand-red)",
                    color: "var(--brand-cream)",
                    fontFamily: "var(--font-label)",
                    fontSize: 14,
                    letterSpacing: "1px",
                    cursor: "pointer",
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  Yes — let&rsquo;s talk about what&rsquo;s next
                </motion.button>
                <motion.button
                  onClick={() => handleDecision("think_about_it")}
                  disabled={pending}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={houseSpring}
                  style={{
                    padding: "16px 32px",
                    borderRadius: 12,
                    border: "1px solid rgba(253,245,230,0.2)",
                    background: "transparent",
                    color: "var(--neutral-300)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    cursor: "pointer",
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  Let me think about it
                </motion.button>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--neutral-500)",
                    marginTop: 8,
                  }}
                >
                  Either way, your portal stays open. Your plan is yours.
                </p>
              </motion.div>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={houseSpring}
              style={{ textAlign: "center" }}
            >
              <p
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: 20,
                  color: "var(--brand-cream)",
                }}
              >
                Thanks, {firstName}.
              </p>
              <a
                href={`/lite/intro/${token}`}
                style={{
                  display: "inline-block",
                  marginTop: 24,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--brand-pink)",
                  textDecoration: "none",
                }}
              >
                ← Back to portal
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function QuestionScreen({
  question,
  onAnswer,
  onSkip,
  pending,
  progress,
  total,
}: {
  question: ReflectionQuestion;
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
  pending: boolean;
  progress: number;
  total: number;
}) {
  const [freeText, setFreeText] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={houseSpring}
    >
      {/* Progress */}
      <div
        style={{
          marginBottom: 32,
          display: "flex",
          gap: 4,
        }}
      >
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background:
                i < progress
                  ? "var(--brand-pink)"
                  : "rgba(253,245,230,0.12)",
            }}
          />
        ))}
      </div>

      <p
        style={{
          fontFamily: "var(--font-narrative)",
          fontStyle: "italic",
          fontSize: 20,
          lineHeight: 1.4,
          color: "var(--brand-cream)",
          marginBottom: 28,
        }}
      >
        {question.question}
      </p>

      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {question.options.map((opt) => (
            <motion.button
              key={opt}
              onClick={() => onAnswer(opt)}
              disabled={pending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={houseSpring}
              style={{
                display: "block",
                width: "100%",
                padding: "16px 20px",
                borderRadius: 12,
                border: "1px solid rgba(253,245,230,0.12)",
                background: "rgba(34,34,31,0.6)",
                cursor: pending ? "not-allowed" : "pointer",
                textAlign: "left",
                fontFamily: "var(--font-body)",
                fontSize: 16,
                color: "var(--brand-cream)",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {opt}
            </motion.button>
          ))}
        </div>
      )}

      {(question.type === "freetext" ||
        question.type === "freetext_optional") && (
        <div>
          <textarea
            value={freeText}
            onChange={(e) =>
              setFreeText(
                e.target.value.slice(0, question.characterLimit ?? 500),
              )
            }
            placeholder={question.placeholder}
            style={{
              width: "100%",
              minHeight: 100,
              padding: 16,
              borderRadius: 12,
              border: "1px solid rgba(253,245,230,0.12)",
              background: "rgba(34,34,31,0.7)",
              color: "var(--brand-cream)",
              fontFamily: "var(--font-body)",
              fontSize: 16,
              resize: "vertical",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
            }}
          >
            {question.type === "freetext_optional" && onSkip && (
              <button
                onClick={onSkip}
                disabled={pending}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--neutral-500)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {question.skipLabel ?? "Skip"}
              </button>
            )}
            <motion.button
              onClick={() => onAnswer(freeText)}
              disabled={
                pending ||
                (question.type === "freetext" && !freeText.trim())
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={houseSpring}
              style={{
                padding: "12px 28px",
                borderRadius: 10,
                border: "none",
                background:
                  freeText.trim() || question.type === "freetext_optional"
                    ? "var(--brand-red)"
                    : "var(--neutral-700)",
                color:
                  freeText.trim() || question.type === "freetext_optional"
                    ? "var(--brand-cream)"
                    : "var(--neutral-500)",
                fontFamily: "var(--font-label)",
                fontSize: 12,
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor:
                  freeText.trim() || question.type === "freetext_optional"
                    ? "pointer"
                    : "not-allowed",
                opacity: pending ? 0.6 : 1,
                marginLeft: "auto",
              }}
            >
              {pending ? "Saving…" : "Continue"}
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
