"use client";

/**
 * SB-6b — authed SaaS subscriber dashboard.
 *
 * Three status variants driven by `subscriptionState`:
 *   - `active`                 → full dashboard + Brand DNA CTA hero
 *   - `past_due`               → "Payment didn't land" + billing portal link
 *   - anything else (null,
 *     incomplete, paused, …)   → "We're still waiting on Stripe" + portal link
 *
 * Billing-portal link POSTs to `/api/stripe/billing-portal`, which creates a
 * short-TTL session and 302s to Stripe. A plain anchor with a form works
 * without JS — house spring adds polish on hover/tap when JS is live.
 */
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";
import type { SubscriberSummary } from "@/lib/saas-products/subscriber-summary";

function cadenceLabel(c: string | null): string {
  if (c === "annual_upfront") return "Annual — paid upfront";
  if (c === "annual_monthly") return "Annual — billed monthly";
  if (c === "monthly") return "Monthly";
  return "—";
}

type Props = {
  summary: SubscriberSummary;
};

type Variant = "active" | "past_due" | "waiting";

function resolveVariant(state: string | null): Variant {
  if (state === "active") return "active";
  if (state === "past_due") return "past_due";
  return "waiting";
}

export function OnboardingDashboardClient({ summary }: Props) {
  const variant = resolveVariant(summary.subscriptionState);

  return (
    <main
      className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-start justify-center gap-8 px-6 py-16"
      data-testid="subscriber-onboarding"
      data-variant={variant}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={variant}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={houseSpring}
          className="flex w-full flex-col gap-6"
        >
          <header className="flex flex-col gap-3">
            <p className="text-foreground/50 text-xs uppercase tracking-[0.22em]">
              {variant === "active" ? "You're in" : "One loose end"}
            </p>
            <h1 className="font-heading text-3xl font-semibold md:text-4xl">
              {headline(variant)}
            </h1>
          </header>

          <motion.section
            layout
            transition={houseSpring}
            className="border-foreground/10 rounded-md border px-5 py-4 text-sm"
            data-testid="subscription-summary"
          >
            <div className="text-foreground/60 mb-1 text-xs uppercase tracking-[0.18em]">
              Your subscription
            </div>
            <div className="text-base font-semibold">
              {summary.productName}
              {summary.tierName ? ` · ${summary.tierName}` : ""}
            </div>
            <div className="text-foreground/70 text-sm">
              {cadenceLabel(summary.billingCadence)}
              {summary.subscriptionState
                ? ` · ${humanState(summary.subscriptionState)}`
                : ""}
            </div>
          </motion.section>

          {variant === "active" ? (
            <BrandDnaHero />
          ) : (
            <BillingPortalHero variant={variant} />
          )}

          {variant === "active" ? (
            <p
              className="text-foreground/60 text-sm leading-relaxed"
              data-testid="followup-line"
            >
              Andy will be in touch within a business day.
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function headline(v: Variant): string {
  if (v === "active") return "Welcome to SuperBad.";
  if (v === "past_due") return "Payment didn't land.";
  return "Still warming up.";
}

function humanState(s: string): string {
  if (s === "active") return "active";
  if (s === "past_due") return "payment failed";
  if (s === "paused") return "paused";
  return s.replaceAll("_", " ");
}

function BrandDnaHero() {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={houseSpring}
      className="w-full"
      data-testid="brand-dna-hero"
    >
      <Link
        href="/lite/brand-dna"
        className="bg-foreground text-background hover:bg-foreground/90 flex w-full flex-col gap-2 rounded-md px-6 py-8 no-underline transition-colors"
        data-testid="brand-dna-cta"
      >
        <span className="text-xs uppercase tracking-[0.22em] opacity-60">
          Step one
        </span>
        <span className="font-heading text-2xl font-semibold md:text-3xl">
          Teach SuperBad your brand.
        </span>
        <span className="text-sm opacity-80">
          Twenty minutes. Everything else is downstream of this.
        </span>
      </Link>
    </motion.div>
  );
}

function BillingPortalHero({ variant }: { variant: "past_due" | "waiting" }) {
  const copy =
    variant === "past_due"
      ? "Your card didn't go through. Update it and we're back on track."
      : "Stripe hasn't confirmed the first payment yet. Give it a minute, then refresh. If nothing changes, pop the billing details open below.";
  return (
    <div className="flex flex-col gap-4" data-testid="billing-portal-hero">
      <p className="text-foreground/80 text-base leading-relaxed">{copy}</p>
      <form action="/api/stripe/billing-portal" method="post">
        <motion.button
          type="submit"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={houseSpring}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-5 py-3 text-sm font-semibold"
          data-testid="billing-portal-button"
        >
          Open billing details
        </motion.button>
      </form>
    </div>
  );
}
