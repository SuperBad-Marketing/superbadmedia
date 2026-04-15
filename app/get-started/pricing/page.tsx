/**
 * `/get-started/pricing` — public comparison grid.
 *
 * Server-rendered. Reads `listActivePricingProducts()` and runs the raw
 * rows through `buildPricingPageViewModel()` — pure function, unit
 * tested separately — before handing the shape to the client grid.
 *
 * Empty state ships a 200, not a 404 (AC4): no active products is a
 * valid "haven't launched anything yet" state, not an error.
 *
 * Spec: docs/specs/saas-subscription-billing.md §3.1 + §10.1.
 * Owner: SB-3.
 */
import type { Metadata } from "next";

import {
  EMPTY_STATE_COPY,
  FOOTER_COPY,
  PRICING_GRID_COPY,
  PRICING_PAGE_HEADER,
  PRICING_PAGE_METADATA,
} from "@/lib/content/pricing-page";
import { listActivePricingProducts } from "@/lib/saas-products/queries";
import { buildPricingPageViewModel } from "@/lib/saas-products/pricing-page-view-model";

import { PricingGridClient } from "./clients/pricing-grid-client";
import { FullSuiteCardClient } from "./clients/full-suite-card-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PRICING_PAGE_METADATA.title,
  description: PRICING_PAGE_METADATA.description,
  openGraph: {
    title: PRICING_PAGE_METADATA.ogTitle,
    description: PRICING_PAGE_METADATA.ogDescription,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PRICING_PAGE_METADATA.ogTitle,
    description: PRICING_PAGE_METADATA.ogDescription,
  },
  robots: { index: true, follow: true },
};

export default async function PricingPage() {
  const raw = await listActivePricingProducts();
  const view = buildPricingPageViewModel(raw);

  if (view.isEmpty) {
    return (
      <section
        aria-labelledby="pricing-empty-heading"
        className="mx-auto max-w-3xl px-6 py-24 text-center"
      >
        <p className="text-foreground/50 mb-3 text-xs uppercase tracking-[0.22em]">
          {EMPTY_STATE_COPY.eyebrow}
        </p>
        <h1
          id="pricing-empty-heading"
          className="font-heading mb-4 text-3xl font-semibold md:text-4xl"
        >
          {EMPTY_STATE_COPY.headline}
        </h1>
        <p className="text-foreground/70 text-base leading-relaxed">
          {EMPTY_STATE_COPY.body}
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-10 md:mb-14">
        <p className="text-foreground/50 mb-2 text-xs uppercase tracking-[0.22em]">
          {PRICING_PAGE_HEADER.eyebrow}
        </p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
          {PRICING_PAGE_HEADER.headline}
        </h1>
        <p className="text-foreground/70 mt-4 max-w-2xl text-base leading-relaxed md:text-lg">
          {PRICING_PAGE_HEADER.supporting}
        </p>
      </header>

      {view.products.length > 0 ? (
        <section aria-labelledby="pricing-grid-heading" className="mb-16">
          <div className="mb-6">
            <h2
              id="pricing-grid-heading"
              className="font-heading text-2xl font-semibold"
            >
              {PRICING_GRID_COPY.heading}
            </h2>
            <p className="text-foreground/60 mt-1 text-sm">
              {PRICING_GRID_COPY.subhead}
            </p>
          </div>
          <PricingGridClient products={view.products} />
        </section>
      ) : null}

      {view.fullSuite ? <FullSuiteCardClient data={view.fullSuite} /> : null}

      <p className="text-foreground/50 mt-16 text-xs">
        {FOOTER_COPY.questionsPrefix}
        <a
          href={`mailto:${FOOTER_COPY.supportEmail}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {FOOTER_COPY.supportEmail}
        </a>
      </p>
    </div>
  );
}
