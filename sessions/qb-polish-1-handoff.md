# QB-POLISH-1 — Handoff (2026-04-15)

Three-fix surgical mop-up. All three landed with a test each. Three commits, gates green.

## Fixes shipped

1. **`qbe2e_manual_quote_settled_missing`** — `lib/quote-builder/accept.ts` manual-mode branch now emits a `quote_settled` activity row (matching the Stripe webhook path). Test: `tests/qb-polish-1-manual-settled.test.ts` (hermetic, `foreign_keys = OFF` because `seedQbE2e` references a user id only Playwright globalSetup seeds). Commit `456c16f`.
2. **`qb7_supersede_email_variant`** — `QuoteSendEmailInput` gained `supersedesQuoteNumber: string | null`; `buildDraftSendEmailPrompt` injects a REPLACEMENT block when set (dry/factual, no apology loop); `composeQuoteSendEmail` looks up the superseded quote number and the deterministic fallback swaps subject + paragraphs accordingly. Tests: prompt-shape (`qb-polish-1-supersede-email.test.ts`) + fallback composer (`qb-polish-1-supersede-compose.test.ts`). Commit `e63a3e4`.
3. **`bdapolish1_question_selection_regression_e2e`** — `tests/e2e/brand-dna-question-selection.spec.ts` walks alignment gate → Q1 → Q2 → Q3 asserting no `button.bda-opt[data-selected="true"]` carries between questions. Required flipping `BRAND_DNA_GATE_BYPASS: ""` → `"true"` in `playwright.config.ts` because `app/lite/brand-dna/layout.tsx` redirects to `/lite/onboarding` when `brand_dna_assessment_enabled` kill-switch is off (JWT `brand_dna_complete` bypasses the page gate but not the layout kill-switch).

## Gates

- `npx tsc --noEmit` — clean
- `npm test` — 728 passed / 1 skipped (100 files)
- `npx playwright test tests/e2e/brand-dna-question-selection.spec.ts` — 1/1 green

## PATCHES_OWED closed

- `qbe2e_manual_quote_settled_missing` (line 309)
- `qb7_supersede_email_variant` (line 302)
- `bdapolish1_question_selection_regression_e2e` (line 462)

All struck through with `CLOSED 2026-04-15 by qb-polish-1`.

## Anti-cycle

No mop-up spawned. No new PATCHES_OWED opened. Guardrail observed.

## Next

Wave 8 **SB-2b** — brief at `sessions/sb-2b-brief.md`, fresh conversation, `/deep` (Opus).
