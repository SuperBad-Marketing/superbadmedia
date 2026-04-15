# QB-POLISH-1 brief — three small surgical fixes before BI-2b

**Wave:** polish mop-up (sequenced before Wave 8 SB-2b — Wave 6 Quote Builder + Wave 7 Branded Invoicing are both complete; this clears three lingering surface-level debts from those waves). **Tier:** `/normal` (Sonnet). **Pre-authored by:** 2026-04-15 ad-hoc review after BI-E2E closed Wave 7. **Anti-cycle guardrail:** this mop-up must not spawn another mop-up (per memory `project_phase_3_5_and_4_mop_up_sessions_authorised`).

## Why this session

Three known-debt items surfaced clean enough to fix now rather than carry further. All three are small, self-contained, and ship without waiting on future waves. Bundling as a single session to keep commit hygiene simple (three commits, one concern each).

## Pre-conditions (verify before coding)

- Read `sessions/bi-2a-handoff.md` (most recent close).
- Read `PATCHES_OWED.md` entries for the three tokens below — confirm none have been tightened/closed in the interim.
- Run `npx tsc --noEmit` and `npm test` before starting — establish green baseline (expected: 675/1/0).

## Expected scope — three fixes, one commit each

### 1. `qbe2e_manual_quote_settled_missing` (~15 min, first commit)

**Where:** `lib/quote-builder/accept.ts` — manual-mode branch of `acceptQuote()`.

**Current state:** Only the Stripe path (`payment-intent-succeeded.ts` webhook handler) logs a `kind: "note", meta.kind: "quote_settled"` row on `activity_log`. Spec §5.1 says both paths settle; manual accept is silent.

**Fix:** Inside the manual-mode branch of `acceptQuote()`, after `finaliseDealAsWon(...)` and the `manual_invoice_generate` enqueue, insert a `quote_settled` activity row. Include `meta.paidVia: "manual"` so downstream consumers can discriminate. Match the column shape used by the Stripe path.

**Tests:** one unit test in an appropriate existing QB test file (or extend `tests/quote-builder/accept.test.ts` if present) — asserts `activity_log` row exists after manual-mode accept. Must not alter Stripe-path behaviour.

**Closes:** `qbe2e_manual_quote_settled_missing` in `PATCHES_OWED.md`.

### 2. `qb7_supersede_email_variant` (~30 min, second commit)

**Where:** `lib/quote-builder/compose-send-email.ts` (or a new sibling `compose-supersede-send-email.ts` — Claude's call based on pipeline shape).

**Current state:** Spec §Q20 says the supersede outbound email explains the replacement to the client. QB-7's `sendQuoteAction` supersede branch reuses the standard compose pipeline, so the intro paragraph doesn't acknowledge the replacement at all.

**Fix:** Detect `supersedes_quote_id` on the draft inside the composer. When set, swap the §1 intro paragraph for a short variant that names the superseded quote number — voice-sensitive: dry, factual, no apology loop. Example tone (not literal copy — Claude drafts through the existing registry slot): *"Here's the updated version — this replaces quote SB-2026-0041."* Must still pass drift-check against Brand DNA.

**Prompt work:** likely a new registry slot `quote-builder-draft-supersede-send-email` or a branch inside the existing slot's prompt. Use a prompt file per the prompt-file-per-slot convention in `lib/ai/prompts/`.

**Tests:** snapshot test on the composed intro paragraph when `supersedes_quote_id` is set vs unset; drift-check test (mocked) against a stub Brand DNA.

**Voice check:** Andy-review this one before ship — voice-sensitive surface. Paste the drafted variant into the handoff note for sign-off.

**Closes:** `qb7_supersede_email_variant` in `PATCHES_OWED.md`.

### 3. `bdapolish1_question_selection_regression_e2e` (~30 min, third commit)

**Where:** new Playwright spec in `tests/e2e/brand-dna/` (mirror existing spec shape — probably `tests/e2e/` layout, confirm at write time).

**Current state:** BDA-POLISH-1 fixed a selection-leak bug in `components/lite/brand-dna/question-card-client.tsx` via `useEffect([question.id])` reset. Regression test was deferred to `PATCHES_OWED`. The bug: selecting option A on question 1 leaked into question 2's visual selected state on navigation.

**Fix:** Playwright spec — seed a Brand DNA session with at least three consecutive single-select questions; select an option on Q1; advance to Q2; assert no option on Q2 carries a selected-state class/attribute; repeat Q2 → Q3. One spec file, 2–3 assertions total.

**webServer note:** per QB-E2E resolution, Playwright runs against `next build && next start` — inherit that config, don't touch it.

**Closes:** `bdapolish1_question_selection_regression_e2e` in `PATCHES_OWED.md`.

## Out of scope (explicit)

- Any other `PATCHES_OWED` row — even if it looks adjacent.
- Any new `settings` key, migration, or schema change. If any of the three fixes appear to need one, stop and raise — likely means I've misread the scope.
- OAuth hardening debt. QB-4c subscription-lifecycle coverage expansion. Sound-trigger wiring. Admin drawer buttons. All still gated on their proper waves.
- Dev-server write-persistence root cause investigation.

## Verification gates (G1–G12 per AUTONOMY_PROTOCOL)

- `npx tsc --noEmit` — zero errors.
- `npm test` — all tests green; count should rise by 3–5 (one unit test for fix 1, 1–2 for fix 2, 1 Playwright spec for fix 3).
- Manual browser verify: fix 3's Playwright run counts; fix 1 + fix 2 are surface-adjacent enough that Andy will encounter them naturally in BI-2b verify.
- G4 literal grep: no new hardcoded tunables.
- Three separate commits, one concern each, per CLAUDE.md `git` discipline.
- Close the three `PATCHES_OWED` rows (strike-through + `CLOSED YYYY-MM-DD by qb-polish-1`).
- Write `sessions/qb-polish-1-handoff.md`.
- Update `SESSION_TRACKER.md` 🧭 Next Action to point at BI-2b.

## What SB-2b picks up after this

Unchanged from `sessions/sb-2b-brief.md` — tier editor + pricing + demo-config + review + celebration steps + `publishSaasProductAction` calling SB-1's `syncProductToStripe` / `syncTierPricesToStripe`. `/deep` required.
