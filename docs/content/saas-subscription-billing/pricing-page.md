# Pricing page — authored copy

**Surface:** `/get-started/pricing` (public). **Spec:** `docs/specs/saas-subscription-billing.md` §3.1 + §10.1. **Author:** Claude (SB-3), 2026-04-15, per `feedback_no_content_authoring`. Voice register checked against `superbad-brand-voice`: dry, observational, slow burn, no synergy / leverage / solutions.

Every string below is re-exported type-safe from `lib/content/pricing-page.ts`. Components import from that module. Editing a string here without mirroring it in the barrel won't ship — do both.

---

## Metadata

- **Title:** `Pricing — SuperBad`
- **Description:** `The tools, the prices, and the rough cost of doing it all at once. No quote call required.`
- **OG title:** `SuperBad — Pricing`
- **OG description:** `What each tool costs, plus the one that quietly costs less than buying them one by one.`

## Page header

- **Eyebrow:** `Pricing`
- **Headline:** `What things cost.`
- **Supporting line:** `All prices include GST. Monthly is month-to-month with a one-time setup fee. Annual waives it. Pick the one that sounds like you.`

## Grid surround

- **Grid heading:** `By the tool`
- **Grid subhead:** `Each one does one thing well. Subscribe to as many as you need, cancel the ones you don't.`

## Tier card framing

Tier names come from admin (per product). The grid surfaces a short framing line per tier rank — voice-consistent, product-agnostic. These render as small-caps eyebrow text above the tier name on each card.

- **Rank 1 framing:** `getting started`
- **Rank 2 framing:** `the one most people pick`
- **Rank 3 framing:** `all in`

## Price line

- **Per-month suffix:** `/ month`
- **GST note (under price):** `inc. GST`
- **Setup fee (if > 0):** `+ $X one-time setup fee on monthly`
- **Setup fee waived line (rank-agnostic, under tier-total block):** `Annual waives the setup fee.`

## Limits and feature bullets

- **Unlimited label:** `Unlimited`
- **Dimension row format:** `{display_name} · {limit}` — e.g. `Outreach sends · 200 / month`, `Seats · Unlimited`.
- **No-limit-set label (defensive, shouldn't render in prod):** `—`
- **Feature flag section heading (visually hidden on desktop, visible on mobile):** `What you get`

## CTA

- **Primary button label:** `Get started`
- **Disabled state (if tier has no Stripe Price yet):** `Not available yet`

## Full Suite section

Renders only if a product with `slug="full-suite"` exists in the active set. Lives below the per-product grid as its own block.

- **Eyebrow:** `Or all of it`
- **Headline:** `Full Suite.`
- **Sub-head:** `Every tool, one subscription. Priced so that getting two of anything on its own starts looking silly.`
- **Savings line template (under the largest Full Suite tier):** `vs ${individualSumPerMonth}/mo buying the top tier of each tool — you keep ${monthlySavings}/mo.`
- **Savings line fallback (if no other active products to compare against):** `Everything we make. One subscription.`

## Empty state (no active products)

- **Eyebrow:** `Pricing`
- **Headline:** `We're not selling anything yet.`
- **Body:** `Andy's still building. Check back soon, or get on the list and we'll tell you when the shelves are full.`
- **CTA:** none — `feedback_primary_action_focus` + `feedback_earned_ctas_at_transition_moments`: no product = no transition moment = no CTA. Mailing-list capture belongs on the marketing site, not here.

## Footer copy

- **GST footnote:** `Prices in Australian dollars, GST-inclusive. SuperBad Marketing, Melbourne.`
- **Questions line:** `Questions? `{email:andy@superbadmedia.com.au}` — dry, no exclamation, single contact path per `feedback_primary_action_focus`.

## Header wordmark

- **Wordmark text:** `SuperBad`
- **Link target:** `/` (marketing site root — placeholder; Phase 2 Foundations still open per `sessions/phase-2-handoff.md`). Routed in this wave regardless.

## Footer links

- **Privacy:** `/lite/legal/privacy`
- **Terms:** `/lite/legal/terms`
- **Copyright line template:** `© ${year} SuperBad Marketing.`

## Voice register notes (for future editors + G10.5 reviewer)

- Every line reads like someone who isn't trying to sell you anything. Observations, not pitches.
- No "unlock", "empower", "seamless", "solutions", "synergy", "leverage", "scale your business".
- The Full Suite block is the closest thing to a sales line and it deliberately undersells — "looking silly" is the peak of the pitch.
- Empty state is dry, not apologetic. "We're not selling anything yet" beats "Coming soon! Sign up to be notified!"
- GST-inclusive framing is non-negotiable per `feedback_felt_experience_wins` — the number Andy wants subscribers to feel is the one they'll actually pay.
- The word **Lite** never appears on this page per `feedback_no_lite_on_client_facing`.
