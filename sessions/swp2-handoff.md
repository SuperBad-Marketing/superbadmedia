# SWP-2 Handoff — Six-Week Plan Generator: Content Mini-Session

**Date:** 2026-04-19
**Wave:** 15
**Status:** COMPLETE

## What was built

- **4 prompt files populated** (were stubs, now fully fleshed):
  - `lib/ai/prompts/six-week-plan/strategy.ts` — Opus strategy outline prompt. Reads full context bundle, structures shoot-day notes with signal-based calibration (energy/ICP warnings), supports regen-with-note. Voice: direct, specific, banned marketing buzzwords.
  - `lib/ai/prompts/six-week-plan/weeks.ts` — Opus per-week elaboration prompt. Reads strategy outline + condensed context. Supports selective week regen, self-review issue injection. Enforces shoot-asset specificity, measurable success signals, real fallbacks.
  - `lib/ai/prompts/six-week-plan/review.ts` — Haiku self-review prompt. 8-point checklist: shoot asset specificity, measurable success signals, energy-task calibration, infrastructure foundation, real fallbacks, no duplicate weeks, interlocking progression, plan intro tone.
  - `lib/ai/prompts/six-week-plan/revision-reply.ts` — Haiku revision-reply draft. Addresses specific concern, explains strategic reasoning, Andy's register (first person, dry, warm underneath). Seeds Andy's reply, doesn't send.

- **Content doc created:** `docs/content/six-week-plan-generator.md` — all non-prompt content:
  - Portal plan page copy (intro surround, Start Week 1 button + subtext, week-card empty state, revision modal copy, revision reply inline card variants + dismiss)
  - Email bodies (revision-regenerated, revision-explained, non-converter expiry with 4-beat structure + mailto prefill)
  - Archived-portal offline-page microcopy
  - Pending-refresh-review band copy (pre-payment + post-payment variants)
  - PDF layout direction (cover page, intermediate footer, closing spread with sprinkle line, render overlay)
  - Andy's review UI microcopy (tab title rotation, flagged-assumption badges, regen-note placeholders, action labels for all review surfaces)

## New files

- `docs/content/six-week-plan-generator.md`
- `sessions/swp2-handoff.md`

## Edited files

- `lib/ai/prompts/six-week-plan/strategy.ts` — stub → full prompt + helper
- `lib/ai/prompts/six-week-plan/weeks.ts` — stub → full prompt + helper
- `lib/ai/prompts/six-week-plan/review.ts` — stub → full prompt
- `lib/ai/prompts/six-week-plan/revision-reply.ts` — stub → full prompt

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)

## Key decisions

- Strategy prompt includes inline signal-based warnings (low energy → "scale tasks down", low ICP clarity → "sharpen audience first") directly in the prompt text when shoot-day signals warrant
- Review checklist expanded from spec's approximate 6 items to 8 structured checks for completeness
- Revision-reply prompt outputs reply text only (no JSON wrapper) — Andy edits in a textarea, structured output adds friction
- Content doc includes all copy from §17 scope list including F3.b/c/d/e patches
- Sprinkle line confirmed: "This plan belongs to you. So does the nerve to run it."

## Next session should know

- SWP-3 builds the generator pipeline (stages 1 + 2 + self-review) consuming these prompts
- All 4 `build*Prompt()` functions are now live and typed — SWP-3 imports and calls them
- Portal copy in `docs/content/six-week-plan-generator.md` is ready for SWP session C (portal surface build)
- Email bodies in the content doc are ready for SWP session C/D (whichever builds the email paths)
- The `TRIAL_SHOOT_OFFER` constant hardcoded in `assemble-context.ts` is still the source — no external constant landed yet
