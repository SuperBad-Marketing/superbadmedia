# Checkout page copy — `/get-started/checkout`

Canonical source for `lib/content/checkout-page.ts`. Changes here must be mirrored there (SB-5).

Voice: dry, first-person plural, identity-framed. No discount language. No "unlock", no "synergy", no "solutions". Prices include GST everywhere. Never "SuperBad Lite" — always "SuperBad".

## Page metadata

- **Title:** `Checkout — SuperBad`
- **Description:** `One form. Pick how you want to pay, enter a card, we're off.`

## Header

- **Eyebrow:** `You picked`
- **Lead-in before the product/tier names:** plain text, product name + tier name stacked. No re-sell language.

## Identity block (email + business name)

- **Heading:** `Who's this for?`
- **Email label:** `Email`
- **Email hint:** `We'll send receipts and anything important here.`
- **Business name label:** `Business name`
- **Business name hint:** `What goes on the invoice. Fix it later if it changes.`

## Commitment radio cards

Three stacked cards. Each has: a tier name, a price line, and an identity framing paragraph. The third gets a "all in" confirmation flourish on select.

### Monthly — "getting started"

- **Eyebrow:** `getting started`
- **Headline:** `Monthly`
- **Identity framing:** `Pay as you go. Cancel the day it stops earning its keep. The setup fee covers the one-time work of getting you wired in properly — it's not a tax, it's an onboarding.`
- **Price template:** `$X/mo + $Y setup fee`

### Annual monthly-billed — "committed"

- **Eyebrow:** `committed`
- **Headline:** `Annual, billed monthly`
- **Identity framing:** `Same monthly price, no setup fee, one twelve-month commitment. This is the "we know this is going to work, we just don't want to wire a lump" option.`
- **Price template:** `$X/mo · 12-month commitment`

### Annual upfront — "all in"

- **Eyebrow:** `all in`
- **Headline:** `Annual, upfront`
- **Identity framing:** `Pay the year today. No setup fee, no monthly reminder. The kind of move that says you've already decided.`
- **Price template:** `$X today · covers 12 months`
- **Select flourish:** `Alright. You're all in.`

## Total line

- **Label for Monthly:** `Today's charge`
- **Label for Annual monthly-billed:** `Today's charge`
- **Label for Annual upfront:** `Today's charge`
- **Setup fee footnote (Monthly only):** `Includes a one-time $Y setup fee. Not charged on renewals.`

## Second-product nudge (authenticated subscribers only)

- **Line:** `Already on another SuperBad tool? Full Suite is $Z/mo — usually less than two subscriptions.`
- Single line, inline, muted. Not a modal, not a popup. Links to `/get-started/pricing#full-suite`.

## Continue to payment button

- **Label (pre-payment):** `Continue to payment`
- **Label (processing, button disabled):** `Setting up…`

## Payment Element block

- Voice suppressed while visible (`feedback_primary_action_focus`). No extra copy above or below except the pay button and the issues line.
- **Pay button label:** `Pay and get going`
- **Pay button processing label:** `Working…`

## Issues footnote

- **Text:** `Issues? `
- **Email link:** `andy@superbadmedia.com.au`

## Error surface

- **Heading:** `That didn't go through.`
- **Body template:** `Stripe said: "{message}". Try again, or email andy@superbadmedia.com.au.`
- On failure we keep the commitment selection + Payment Element intact so retry is one click.

## Missing-tier fallback

If the `?tier=...` / `?product=...` parameters don't resolve, redirect to `/get-started/pricing` — no flash, no error page. The pricing page is the canonical list.
