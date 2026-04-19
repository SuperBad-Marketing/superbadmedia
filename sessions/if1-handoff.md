# IF-1 Handoff — Intro Funnel Landing + Section 1 + Portal Shell + Questionnaire + Payment Panel

**Date:** 2026-04-19
**Wave:** 14
**Status:** COMPLETE (landing → form → deal creation → portal → questionnaire → payment panel all wired)

## What was built

- **Landing page** (`app/trial-shoot/page.tsx` + `landing-client.tsx`) — 9 content blocks matching spec, hero → form CTA transition with house spring animation
- **Section 1 form** (`app/trial-shoot/section-1-form.tsx`) — name, business, email, phone, SMS opt-in (default checked), 3 shape classification tappable cards
- **Server action** (`app/trial-shoot/actions.ts`) — `submitSection1Action` creates company+contact+deal via `createDealFromLead(source: 'intro_funnel_contact_submitted')`, writes `intro_funnel_submissions` row, mirrors funnel state onto deal, logs activity, returns token for portal redirect
- **Portal shell** (`app/lite/intro/[token]/`) — token-based public page with welcome header, questionnaire card (active during contact_submitted/questionnaire_in_progress), payment card (locked until questionnaire_complete), "what to expect" section
- **Questionnaire panel** (`questionnaire-panel.tsx` + `questionnaire-data.ts`) — one-question-per-screen UI, 3 shapes × 3 sections = 9 question banks, progress bar, tappable option cards, free-text support, server actions for save/complete
- **Payment panel** (`payment-panel.tsx` + `payment-actions.ts`) — Stripe Payment Element with cinematic reveal, creates PaymentIntent via `ensureStripeCustomer`, confirmation flow with `router.refresh()`

## New schema files

- `lib/db/schema/intro-funnel-submissions.ts` — 12 funnel states, 3 shapes, 6 abandon sequence states
- `lib/db/schema/intro-funnel-payments.ts` — payment records linked to Stripe PI
- `lib/db/schema/intro-funnel-bookings.ts` — booking slots with reschedule tracking
- `lib/db/schema/intro-funnel-reflections.ts` — post-shoot reflection + synthesis
- `lib/db/schema/intro-funnel-retainer-fit.ts` — Claude-generated recommendations
- `lib/db/schema/intro-funnel-config.ts` — singleton (price, currency, copy blocks)
- `lib/db/schema/calendar.ts` — generic bookings + config singleton
- `lib/db/schema/twilio-sms-log.ts` — SMS delivery tracking
- `lib/db/schema/dnc-phones.ts` — phone-level DNC list

## Schema extensions

- `deals` gained: `funnel_submission_id`, `funnel_state`, `post_trial_signal`, `reschedule_count`
- `contacts` gained: `sms_opt_in`, `sms_consent_at_ms`
- `DEAL_LOSS_REASONS` expanded from 7 to 14 (added 7 intro funnel reasons)

## Key decisions

- `createDealFromLead` lands intro funnel deals at `trial_shoot` stage via `SOURCE_STAGE_OVERRIDES`
- Token is 16-char hex (UUID stripped of hyphens, sliced)
- Shape mismatch between repeat submitter's canonical company.shape and new section 1 shape → logged as `shape_mismatch_flagged` activity, not overwritten

## Bug fixes during session

- **Migration 0052 was a mega-migration** — drizzle-kit generated it with duplicate CREATE TABLE statements for ~30 tables already created by earlier migrations. Stripped to only new IF-1 tables + ALTER TABLE statements. Root cause: drizzle-kit snapshot parent pointer collision (0012 pointed at same parent as 0011; fixed in prior session but drizzle-kit still generated stale diff).
- **Dev DB column drift** — companies table missing 8 OS-1 columns, contacts missing 6 CM-1/wave columns, deals missing 3 columns, threads missing 2 columns. All added via ALTER TABLE. This drift accumulated because earlier migrations used `IF NOT EXISTS` but the drizzle-kit push was blocked by an index collision.
- **Unused imports** in `actions.ts` cleaned up (normalisePhone, activity_log, settings)

## Verification

- `npx tsc --noEmit` — zero source errors (only .next/types generated file noise)
- `npx vitest run` — 218 files, 1833 passed, 1 skipped
- Browser verified: landing page renders all 9 blocks, CTA→form transition works, form submission creates deal+contact+company+submission, redirects to portal, questionnaire renders first question, answer selection works

## What's NOT tested yet

- Stripe Payment Element (requires test keys configured in .env.local)
- Full questionnaire completion flow (all 3 sections × 5-7 questions)
- Portal page after payment confirmation
- SMS opt-in downstream effects

## Next session should know

- IF-2 is next per BUILD_PLAN.md — check what it covers
- Payment panel exists but Stripe test keys may not be configured; IF-2 or IF-E2E should verify
- The questionnaire `saveAnswerAction` and `completeSectionAction` are wired but the full flow through all sections hasn't been exercised end-to-end
