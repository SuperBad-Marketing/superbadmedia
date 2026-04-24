"use client";

/**
 * `review-and-confirm` step-type — read-only summary of collected data
 * across prior steps + single "confirm" CTA. Last step before celebration.
 */

import * as React from "react";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type ReviewConfirmSummary = {
  label: string;
  value: string;
};

export type ReviewConfirmState = {
  summary: ReviewConfirmSummary[];
  confirmed: boolean;
};

export type ReviewConfirmConfig = {
  ctaLabel?: string;
};

function ReviewConfirmComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<ReviewConfirmState>) {
  const cfg = config as ReviewConfirmConfig | undefined;
  return (
    <div data-wizard-step="review-and-confirm" className="space-y-6">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
        {state.summary.map((row, i) => (
          <React.Fragment key={i}>
            <dt
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--color-neutral-400)", fontFamily: "var(--font-label)" }}
              data-wizard-review-label
            >
              {row.label}
            </dt>
            <dd
              style={{ color: "var(--color-brand-cream)" }}
              data-wizard-review-value
            >
              {row.value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        type="button"
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          backgroundColor: "var(--color-brand-pink)",
          color: "var(--color-neutral-950)",
          fontFamily: "var(--font-label)",
        }}
        onClick={() => {
          onChange({ ...state, confirmed: true });
          onNext();
        }}
      >
        {cfg?.ctaLabel ?? "Looks good — confirm"}
      </button>
    </div>
  );
}

export const reviewConfirmStep: StepTypeDefinition<ReviewConfirmState> = {
  type: "review-and-confirm",
  resumableByDefault: true,
  Component: ReviewConfirmComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<ReviewConfirmState>;
    return {
      summary: Array.isArray(r.summary)
        ? (r.summary as ReviewConfirmSummary[])
        : [],
      confirmed: Boolean(r.confirmed),
    };
  },
  validate: (state) =>
    state.confirmed
      ? { ok: true }
      : invalid("Confirm the summary before finishing."),
};
