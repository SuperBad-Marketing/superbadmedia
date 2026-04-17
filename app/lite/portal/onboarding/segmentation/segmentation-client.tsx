"use client";

/**
 * Revenue Segmentation questionnaire — 5 MC questions, card-per-question.
 *
 * Spec §3.3: consistent with Brand DNA's visual language but lighter —
 * no ambient visual evolution, no between-question transitions. Progress
 * indicator showing 5 of 5. Submit button at the bottom.
 *
 * Hidden egg suppression: full. No S&D on this surface.
 *
 * Owner: OS-2.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { houseSpring } from "@/lib/design-tokens";
import { submitRevenueSegmentation, type SubmitRevSegInput } from "./actions";
import type {
  RevenueRange,
  TeamSize,
  BiggestConstraint,
  TwelveMonthGoal,
  IndustryVertical,
} from "@/lib/db/schema/companies";

// ── Question definitions ──────────────────────────────────────────────

type QuestionDef<T extends string> = {
  key: string;
  label: string;
  options: { value: T; label: string }[];
};

const Q1: QuestionDef<RevenueRange> = {
  key: "revenue_range",
  label: "Monthly revenue",
  options: [
    { value: "under_250k", label: "Under $250K" },
    { value: "250k_500k", label: "$250K\u2013$500K" },
    { value: "500k_1m", label: "$500K\u2013$1M" },
    { value: "1m_3m", label: "$1M\u2013$3M" },
    { value: "3m_plus", label: "$3M+" },
  ],
};

const Q2: QuestionDef<TeamSize> = {
  key: "team_size",
  label: "Team size",
  options: [
    { value: "solo", label: "Just me" },
    { value: "2_5", label: "2\u20135" },
    { value: "6_15", label: "6\u201315" },
    { value: "16_50", label: "16\u201350" },
    { value: "50_plus", label: "50+" },
  ],
};

const Q3: QuestionDef<BiggestConstraint> = {
  key: "biggest_constraint",
  label: "Biggest constraint right now",
  options: [
    { value: "not_enough_right_customers", label: "Not enough of the right customers" },
    { value: "no_time_marketing", label: "No time to do marketing properly" },
    { value: "dont_know_whats_working", label: "Don\u2019t know what\u2019s working and what\u2019s not" },
    { value: "brand_doesnt_reflect", label: "Brand doesn\u2019t reflect who we actually are" },
    { value: "burned_before", label: "Tried agencies/freelancers, got burned" },
    { value: "growing_not_kept_up", label: "We\u2019re growing but marketing hasn\u2019t kept up" },
  ],
};

const Q4: QuestionDef<TwelveMonthGoal> = {
  key: "twelve_month_goal",
  label: "12-month goal",
  options: [
    { value: "steady", label: "Keep things ticking over" },
    { value: "grow", label: "Grow \u2014 more of the right customers" },
    { value: "scale", label: "Scale \u2014 double down and push hard" },
    { value: "launch_new", label: "Launch something new alongside what we\u2019ve got" },
    { value: "figure_out", label: "Honestly, figure out what\u2019s next" },
  ],
};

const Q5: QuestionDef<IndustryVertical> = {
  key: "industry_vertical",
  label: "Industry",
  options: [
    { value: "health_wellness", label: "Health & wellness" },
    { value: "professional_services", label: "Professional services" },
    { value: "trades_construction", label: "Trades & construction" },
    { value: "hospitality_food", label: "Hospitality & food" },
    { value: "education", label: "Education" },
    { value: "retail", label: "Retail" },
    { value: "creative_media", label: "Creative & media" },
    { value: "other", label: "Other" },
  ],
};

const QUESTIONS = [Q1, Q2, Q3, Q4, Q5] as const;
const TOTAL = QUESTIONS.length;

// ── Component ─────────────────────────────────────────────────────────

export function SegmentationClient() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [otherText, setOtherText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const answeredCount = QUESTIONS.filter((q) => answers[q.key]).length;
  const allAnswered = answeredCount === TOTAL;

  function select(questionKey: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionKey]: value }));
    setError(null);
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);

    const input: SubmitRevSegInput = {
      revenue_range: answers.revenue_range as SubmitRevSegInput["revenue_range"],
      team_size: answers.team_size as SubmitRevSegInput["team_size"],
      biggest_constraint: answers.biggest_constraint as SubmitRevSegInput["biggest_constraint"],
      twelve_month_goal: answers.twelve_month_goal as SubmitRevSegInput["twelve_month_goal"],
      industry_vertical: answers.industry_vertical as SubmitRevSegInput["industry_vertical"],
      industry_vertical_other:
        answers.industry_vertical === "other" ? otherText || null : null,
    };

    const result = await submitRevenueSegmentation(input);
    if (!result.ok) {
      setError("Something went sideways. Try again in a moment.");
      setSubmitting(false);
      return;
    }

    // Navigate to the next onboarding step
    router.push("/lite/portal");
    router.refresh();
  }

  const fadeUp = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 } as const,
        animate: { opacity: 1, y: 0 } as const,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
      };

  const stagger = (i: number) =>
    shouldReduceMotion
      ? {}
      : { transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.08 } };

  return (
    <main className="flex min-h-dvh flex-col items-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
        {/* Header */}
        <motion.header {...fadeUp} className="flex flex-col gap-3 text-center">
          <p className="font-[family-name:var(--font-righteous)] text-xs uppercase tracking-widest text-[var(--color-foreground)]/40">
            Almost there
          </p>
          <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-medium tracking-tight text-[var(--color-foreground)] md:text-4xl">
            Five quick questions.
          </h1>
          <p className="text-sm text-[var(--color-foreground)]/60">
            About where your business is right now. Takes about two minutes.
          </p>
        </motion.header>

        {/* Progress indicator */}
        <motion.div
          {...fadeUp}
          {...stagger(1)}
          className="flex items-center gap-2"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={TOTAL}
          aria-label={`${answeredCount} of ${TOTAL} questions answered`}
        >
          {QUESTIONS.map((q, i) => (
            <div
              key={q.key}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                answers[q.key]
                  ? "bg-[var(--color-brand-pink)]"
                  : "bg-[var(--color-foreground)]/10"
              }`}
              aria-hidden
            />
          ))}
          <span className="ml-2 text-xs tabular-nums text-[var(--color-foreground)]/40">
            {answeredCount}/{TOTAL}
          </span>
        </motion.div>

        {/* Question cards */}
        <div className="flex flex-col gap-8">
          {QUESTIONS.map((q, qi) => (
            <motion.div
              key={q.key}
              {...fadeUp}
              {...stagger(qi + 2)}
              className="flex flex-col gap-3"
              data-testid={`rev-seg-q-${q.key}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs tabular-nums text-[var(--color-foreground)]/30">
                  {qi + 1}.
                </span>
                <h2 className="text-sm font-medium text-[var(--color-foreground)]">
                  {q.label}
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {q.options.map((opt) => {
                  const selected = answers[q.key] === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      onClick={() => select(q.key, opt.value)}
                      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      transition={houseSpring}
                      className={`rounded-[var(--radius-default)] border px-4 py-3 text-left text-sm transition-colors ${
                        selected
                          ? "border-[var(--color-brand-pink)] bg-[var(--color-brand-pink)]/5 text-[var(--color-foreground)]"
                          : "border-[var(--color-foreground)]/10 text-[var(--color-foreground)]/70 hover:border-[var(--color-foreground)]/20 hover:text-[var(--color-foreground)]"
                      }`}
                      data-testid={`rev-seg-opt-${opt.value}`}
                      data-selected={selected}
                    >
                      {opt.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* "Other" free-text field for industry */}
              {q.key === "industry_vertical" && answers.industry_vertical === "other" && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, height: "auto" }}
                  transition={houseSpring}
                  className="overflow-hidden"
                >
                  <Input
                    placeholder="What industry are you in?"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    maxLength={200}
                    className="mt-1"
                    data-testid="rev-seg-other-input"
                  />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Submit */}
        <motion.div {...fadeUp} {...stagger(TOTAL + 2)} className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full"
            data-testid="rev-seg-submit"
          >
            {submitting ? "Saving\u2026" : "Continue"}
          </Button>
          {error && (
            <p className="text-center text-xs text-[var(--color-foreground)]/60" data-testid="rev-seg-error">
              {error}
            </p>
          )}
        </motion.div>
      </div>
    </main>
  );
}
