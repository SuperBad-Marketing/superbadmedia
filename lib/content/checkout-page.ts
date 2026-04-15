/**
 * Authored copy barrel for `/get-started/checkout`.
 *
 * Canonical prose lives at
 * `docs/content/saas-subscription-billing/checkout.md` per
 * `project_context_safety_conventions`. Keep this module in exact sync
 * with the markdown file.
 *
 * Owner: SB-5.
 */

export const CHECKOUT_PAGE_METADATA = {
  title: "Checkout — SuperBad",
  description:
    "One form. Pick how you want to pay, enter a card, we're off.",
} as const;

export const CHECKOUT_HEADER_COPY = {
  eyebrow: "You picked",
} as const;

export const CHECKOUT_IDENTITY_COPY = {
  heading: "Who's this for?",
  emailLabel: "Email",
  emailHint: "We'll send receipts and anything important here.",
  businessNameLabel: "Business name",
  businessNameHint: "What goes on the invoice. Fix it later if it changes.",
} as const;

export type CommitmentCadence =
  | "monthly"
  | "annual_monthly"
  | "annual_upfront";

type CommitmentCopy = {
  eyebrow: string;
  headline: string;
  body: string;
  selectFlourish?: string;
};

export const COMMITMENT_COPY: Record<CommitmentCadence, CommitmentCopy> = {
  monthly: {
    eyebrow: "getting started",
    headline: "Monthly",
    body:
      "Pay as you go. Cancel the day it stops earning its keep. The setup fee covers the one-time work of getting you wired in properly — it's not a tax, it's an onboarding.",
  },
  annual_monthly: {
    eyebrow: "committed",
    headline: "Annual, billed monthly",
    body:
      "Same monthly price, no setup fee, one twelve-month commitment. This is the \"we know this is going to work, we just don't want to wire a lump\" option.",
  },
  annual_upfront: {
    eyebrow: "all in",
    headline: "Annual, upfront",
    body:
      "Pay the year today. No setup fee, no monthly reminder. The kind of move that says you've already decided.",
    selectFlourish: "Alright. You're all in.",
  },
};

export const CHECKOUT_TOTAL_COPY = {
  todayLabel: "Today's charge",
  setupFeeFootnoteTemplate: (setupFeeDollars: string) =>
    `Includes a one-time $${setupFeeDollars} setup fee. Not charged on renewals.`,
  perMonthSuffix: "/ mo",
  gstNote: "inc. GST",
} as const;

export const CHECKOUT_SECOND_PRODUCT_NUDGE = {
  leadIn: "Already on another SuperBad tool?",
  template: (fullSuiteMonthlyDollars: string) =>
    `Full Suite is $${fullSuiteMonthlyDollars}/mo — usually less than two subscriptions.`,
  href: "/get-started/pricing#full-suite",
} as const;

export const CHECKOUT_CONTINUE_COPY = {
  continueLabel: "Continue to payment",
  continueProcessingLabel: "Setting up…",
  payLabel: "Pay and get going",
  payProcessingLabel: "Working…",
} as const;

export const CHECKOUT_ISSUES_COPY = {
  prefix: "Issues? ",
  email: "andy@superbadmedia.com.au",
} as const;

export const CHECKOUT_ERROR_COPY = {
  heading: "That didn't go through.",
  bodyTemplate: (message: string) =>
    `Stripe said: "${message}". Try again, or email andy@superbadmedia.com.au.`,
} as const;

export const CHECKOUT_COMMITMENT_ORDER: CommitmentCadence[] = [
  "monthly",
  "annual_monthly",
  "annual_upfront",
];
