"use client";

/**
 * Full Suite section — its own emphasis block below the per-product
 * grid. Rendered only when `slug="full-suite"` is present in the
 * active set; the page gates on `view.fullSuite !== null`.
 *
 * Popcorn visibility: the savings line under the largest Full Suite
 * tier spells out the comparison per spec §3.1. Falls back to a
 * voice-consistent single line when only Full Suite is active.
 *
 * Owner: SB-3.
 */
import { FULL_SUITE_COPY } from "@/lib/content/pricing-page";
import {
  formatCentsAud,
  type FullSuiteViewModel,
} from "@/lib/saas-products/pricing-page-view-model";

import { TierCard } from "./pricing-grid-client";

export function FullSuiteCardClient({ data }: { data: FullSuiteViewModel }) {
  const savingsLine =
    data.savings.kind === "computed"
      ? FULL_SUITE_COPY.savingsLineTemplate(
          formatCentsAud(data.savings.individualSumPerMonthCents),
          formatCentsAud(data.savings.monthlySavingsCents),
        )
      : FULL_SUITE_COPY.savingsFallback;

  return (
    <section
      aria-labelledby="full-suite-heading"
      data-testid="full-suite-section"
      className="border-primary/20 bg-primary/5 mt-4 rounded-2xl border p-6 md:p-10"
    >
      <header className="mb-6 md:mb-8">
        <p className="text-primary/80 mb-2 text-xs uppercase tracking-[0.22em]">
          {FULL_SUITE_COPY.eyebrow}
        </p>
        <h2
          id="full-suite-heading"
          className="font-heading text-3xl font-semibold tracking-tight md:text-4xl"
        >
          {FULL_SUITE_COPY.headline}
        </h2>
        <p className="text-foreground/70 mt-3 max-w-2xl text-base leading-relaxed">
          {FULL_SUITE_COPY.subhead}
        </p>
        {data.description ? (
          <p className="text-foreground/60 mt-2 max-w-2xl text-sm leading-relaxed">
            {data.description}
          </p>
        ) : null}
      </header>

      <div
        className="grid gap-4 md:gap-6"
        style={{
          gridTemplateColumns: `repeat(${Math.max(data.tiers.length, 1)}, minmax(0, 1fr))`,
        }}
        data-testid="full-suite-tier-grid"
      >
        {data.tiers.map((tier) => (
          <TierCard key={tier.tierId} tier={tier} />
        ))}
      </div>

      <p
        className="text-foreground/70 mt-6 text-sm italic"
        data-testid="full-suite-savings"
      >
        {savingsLine}
      </p>
    </section>
  );
}
