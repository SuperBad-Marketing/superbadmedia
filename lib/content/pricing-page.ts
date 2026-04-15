/**
 * Authored copy barrel for `/get-started/pricing`.
 *
 * Canonical prose lives at `docs/content/saas-subscription-billing/pricing-page.md`
 * per `project_context_safety_conventions`. This module is the typed
 * source components import — keep it in exact sync with the markdown
 * file. Mismatch is caught in code review, not by a test.
 *
 * Owner: SB-3.
 */

export const PRICING_PAGE_METADATA = {
  title: "Pricing — SuperBad",
  description:
    "The tools, the prices, and the rough cost of doing it all at once. No quote call required.",
  ogTitle: "SuperBad — Pricing",
  ogDescription:
    "What each tool costs, plus the one that quietly costs less than buying them one by one.",
} as const;

export const PRICING_PAGE_HEADER = {
  eyebrow: "Pricing",
  headline: "What things cost.",
  supporting:
    "All prices include GST. Monthly is month-to-month with a one-time setup fee. Annual waives it. Pick the one that sounds like you.",
} as const;

export const PRICING_GRID_COPY = {
  heading: "By the tool",
  subhead:
    "Each one does one thing well. Subscribe to as many as you need, cancel the ones you don't.",
} as const;

/**
 * Framing text that renders above the admin-authored tier name.
 * Product-agnostic; keyed by tier rank (1 / 2 / 3).
 */
export const TIER_RANK_FRAMING: Record<1 | 2 | 3, string> = {
  1: "getting started",
  2: "the one most people pick",
  3: "all in",
};

export const PRICE_LINE_COPY = {
  perMonthSuffix: "/ month",
  gstNote: "inc. GST",
  setupFeeTemplate: (setupFeeDollars: string) =>
    `+ $${setupFeeDollars} one-time setup fee on monthly`,
  annualWaivesLine: "Annual waives the setup fee.",
  unlimitedLabel: "Unlimited",
  missingLimitLabel: "—",
  whatYouGetHeading: "What you get",
} as const;

export const CTA_COPY = {
  label: "Get started",
  disabledLabel: "Not available yet",
} as const;

export const FULL_SUITE_COPY = {
  slug: "full-suite",
  eyebrow: "Or all of it",
  headline: "Full Suite.",
  subhead:
    "Every tool, one subscription. Priced so that getting two of anything on its own starts looking silly.",
  savingsLineTemplate: (
    individualSumPerMonthDollars: string,
    monthlySavingsDollars: string,
  ) =>
    `vs $${individualSumPerMonthDollars}/mo buying the top tier of each tool — you keep $${monthlySavingsDollars}/mo.`,
  savingsFallback: "Everything we make. One subscription.",
} as const;

export const EMPTY_STATE_COPY = {
  eyebrow: "Pricing",
  headline: "We're not selling anything yet.",
  body:
    "Andy's still building. Check back soon, or get on the list and we'll tell you when the shelves are full.",
} as const;

export const FOOTER_COPY = {
  gstFootnote:
    "Prices in Australian dollars, GST-inclusive. SuperBad Marketing, Melbourne.",
  questionsPrefix: "Questions? ",
  supportEmail: "andy@superbadmedia.com.au",
  wordmark: "SuperBad",
  wordmarkHref: "/",
  privacyHref: "/lite/legal/privacy",
  privacyLabel: "Privacy",
  termsHref: "/lite/legal/terms",
  termsLabel: "Terms",
  copyrightTemplate: (year: number) => `© ${year} SuperBad Marketing.`,
} as const;
