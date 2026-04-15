"use client";

/**
 * Pricing grid — desktop: one column per product, three tier cards
 * stacked inside. Mobile (< md): one per-product card per row,
 * collapsed by default, expands to reveal its three tiers via
 * `AnimatePresence`. Every state change animates per
 * `feedback_motion_is_universal`; reduced-motion is handled globally by
 * `MotionProvider`'s `MotionConfig`.
 *
 * Owner: SB-3.
 */
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import {
  CTA_COPY,
  PRICE_LINE_COPY,
  TIER_RANK_FRAMING,
} from "@/lib/content/pricing-page";
import {
  formatCentsAud,
  humaniseFlagKey,
  tierFrame,
  type ProductColumnViewModel,
  type TierCellViewModel,
} from "@/lib/saas-products/pricing-page-view-model";

export function PricingGridClient({
  products,
}: {
  products: ProductColumnViewModel[];
}) {
  return (
    <>
      {/* Desktop grid — horizontal columns */}
      <div
        className="hidden gap-6 md:grid"
        style={{
          gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))`,
        }}
        data-testid="pricing-grid-desktop"
      >
        {products.map((product) => (
          <ProductColumn key={product.productId} product={product} />
        ))}
      </div>

      {/* Mobile stack — collapsible per product */}
      <div className="flex flex-col gap-4 md:hidden" data-testid="pricing-grid-mobile">
        {products.map((product) => (
          <MobileProductCard key={product.productId} product={product} />
        ))}
      </div>
    </>
  );
}

function ProductColumn({ product }: { product: ProductColumnViewModel }) {
  return (
    <section
      aria-labelledby={`product-${product.productId}-name`}
      className="flex flex-col gap-4"
      data-product-slug={product.slug}
    >
      <header>
        <h3
          id={`product-${product.productId}-name`}
          className="font-heading text-xl font-semibold"
        >
          {product.name}
        </h3>
        {product.description ? (
          <p className="text-foreground/60 mt-1 text-sm leading-relaxed">
            {product.description}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">
        {product.tiers.map((tier) => (
          <TierCard key={tier.tierId} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function MobileProductCard({ product }: { product: ProductColumnViewModel }) {
  const [open, setOpen] = React.useState(false);
  const contentId = `product-${product.productId}-content`;
  return (
    <motion.section
      className="border-border bg-card overflow-hidden rounded-lg border"
      data-product-slug={product.slug}
      layout
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/40"
        data-testid={`product-toggle-${product.slug}`}
      >
        <div>
          <h3 className="font-heading text-lg font-semibold">
            {product.name}
          </h3>
          {product.description ? (
            <p className="text-foreground/60 mt-0.5 text-xs leading-relaxed">
              {product.description}
            </p>
          ) : null}
        </div>
        <motion.span
          aria-hidden
          className="text-foreground/60 text-sm"
          animate={{ rotate: open ? 180 : 0 }}
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
              {product.tiers.map((tier) => (
                <TierCard key={tier.tierId} tier={tier} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

export function TierCard({ tier }: { tier: TierCellViewModel }) {
  const frame = tierFrame(tier.tierRank, TIER_RANK_FRAMING);
  const setupFeeDollars =
    tier.setupFeeCents > 0 ? formatCentsAud(tier.setupFeeCents) : null;
  return (
    <motion.article
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.995 }}
      className="border-border bg-card relative flex flex-col rounded-lg border p-5 shadow-sm"
      data-testid={`tier-card-rank-${tier.tierRank}`}
      data-tier-id={tier.tierId}
    >
      {frame ? (
        <p className="text-foreground/50 mb-1 text-[10px] uppercase tracking-[0.22em]">
          {frame}
        </p>
      ) : null}
      <h4 className="font-heading text-lg font-semibold">{tier.name}</h4>

      <div className="mt-3">
        <p className="font-heading text-2xl font-semibold">
          ${formatCentsAud(tier.monthlyPriceCents)}
          <span className="text-foreground/60 text-sm font-normal">
            {" "}
            {PRICE_LINE_COPY.perMonthSuffix}
          </span>
        </p>
        <p className="text-foreground/50 mt-0.5 text-xs">
          {PRICE_LINE_COPY.gstNote}
        </p>
        {setupFeeDollars ? (
          <>
            <p className="text-foreground/70 mt-2 text-xs">
              {PRICE_LINE_COPY.setupFeeTemplate(setupFeeDollars)}
            </p>
            <p className="text-foreground/50 text-xs italic">
              {PRICE_LINE_COPY.annualWaivesLine}
            </p>
          </>
        ) : null}
      </div>

      {tier.limitEntries.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-1.5 text-sm">
          {tier.limitEntries.map((e) => (
            <li
              key={e.dimensionKey}
              className="flex items-baseline justify-between gap-3"
              data-dimension-key={e.dimensionKey}
            >
              <span className="text-foreground/70">{e.displayName}</span>
              <span className="font-medium">
                {e.missing
                  ? PRICE_LINE_COPY.missingLimitLabel
                  : e.limitValue === null
                    ? PRICE_LINE_COPY.unlimitedLabel
                    : e.limitValue.toLocaleString("en-AU")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {tier.featureFlags.length > 0 ? (
        <>
          <p className="text-foreground/40 mt-5 text-[10px] uppercase tracking-[0.22em] md:sr-only">
            {PRICE_LINE_COPY.whatYouGetHeading}
          </p>
          <ul className="text-foreground/80 mt-2 flex flex-col gap-1 text-sm md:mt-2">
            {tier.featureFlags.map((k) => (
              <li key={k} className="flex items-start gap-2">
                <span aria-hidden className="text-foreground/40 mt-[0.35em]">
                  ·
                </span>
                <span>{humaniseFlagKey(k)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-6">
        {tier.available ? (
          <Link
            href={tier.checkoutHref}
            data-testid={`cta-${tier.tierId}`}
            className="bg-primary text-primary-foreground inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-transform hover:translate-y-[-1px] active:translate-y-0"
          >
            {CTA_COPY.label}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            data-testid={`cta-${tier.tierId}`}
            className="text-foreground/50 bg-muted/50 w-full cursor-not-allowed rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            {CTA_COPY.disabledLabel}
          </button>
        )}
      </div>
    </motion.article>
  );
}
