# `os-1` — Company auto-creation + onboarding state + welcome screens — Handoff

**Closed:** 2026-04-17
**Wave:** 11 — Onboarding + Segmentation (1 of 3 — Wave 11 opener)
**Model tier:** Sonnet

---

## What was built

The **onboarding foundation** — company auto-creation for SaaS signups, derived onboarding state orchestrator, welcome email generation (Opus + drift-checked), and branded welcome screens for both retainer and SaaS paths.

**Files created:**

- `lib/onboarding/create-company-from-signup.ts` — synchronous company + contact auto-creation in a single transaction. Solo operator fallback (customer name as company name). Accepts injectable `db` for hermetic testing.
- `lib/onboarding/get-onboarding-state.ts` — thin composition layer reading Brand DNA status, Rev Seg completion, wizard completions, and credential state. Returns `{ currentStep, completedSteps, totalSteps, audience }`. No dedicated table — derived at read time per spec §10.
- `lib/onboarding/generate-welcome-email.ts` — Opus-tier welcome email generator with retainer + SaaS prompt variants. Zod-validated JSON output. Drift-checked via `checkBrandVoiceDrift()`. Returns null on kill-switch-off or invalid LLM response.
- `lib/onboarding/generate-welcome-summary.ts` — Opus-tier "what we already know about you" paragraph for the retainer welcome screen. Reads deal context through the client doc source hierarchy.
- `lib/onboarding/index.ts` — barrel export for all onboarding primitives.
- `lib/ai/prompts/onboarding.md` — prompt documentation for both LLM jobs.
- `lib/db/migrations/0040_os1_onboarding_columns.sql` — 8 columns on `companies` (7 Rev Seg + location) + 1 on `contacts` (`onboarding_welcome_seen_at_ms`). All nullable/additive.
- `app/lite/portal/welcome/page.tsx` — Server Component. Portal session guard, entry-path branch (trial-shoot graduates bypass → redirect to portal home), audience detection (retainer/SaaS), deal context assembly.
- `app/lite/portal/welcome/welcome-client.tsx` — Client Component. Premium branded welcome screen with Framer Motion fade-up stagger. Retainer: name + dry line + "what we already know" panel + step preview + CTA. SaaS: name + dry line + step preview + CTA (no pre-populated summary). Token-styled throughout.
- `app/lite/portal/welcome/actions.ts` — `markWelcomeSeen()` server action. One-shot write to `contacts.onboarding_welcome_seen_at_ms`.
- `tests/onboarding/create-company-from-signup.test.ts` — 5 tests. Happy path, solo operator fallback, empty business name, email normalisation, nullable fields.
- `tests/onboarding/get-onboarding-state.test.ts` — 5 tests. SaaS current step, SaaS brand_dna step, retainer sequence, retainer complete, edge case (no primary contact).
- `tests/onboarding/generate-welcome-email.test.ts` — 5 tests. Kill switch, retainer generation, SaaS generation, invalid JSON, drift failure.

**Files edited:**

- `lib/db/schema/companies.ts` — 5 new enum types (RevenueRange, TeamSize, BiggestConstraint, TwelveMonthGoal, IndustryVertical) + 8 new nullable columns.
- `lib/db/schema/contacts.ts` — `onboarding_welcome_seen_at_ms` column.
- `lib/ai/models.ts` — 2 new LLM slugs: `onboarding-welcome-email` (Opus), `onboarding-welcome-summary` (Opus).
- `lib/ai/prompts/INDEX.md` — updated to 60 prompts across 15 specs. Onboarding removed from prompt-free list.
- `lib/db/migrations/meta/_journal.json` — added entry idx 40.
- `tests/inbox-conversation-view.test.tsx` — added new columns to mock objects (schema parity fix).

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Company auto-creation accepts injectable db.** Matches `createDealFromLead` pattern for hermetic testing.
2. **Entry-path branch uses won-deal heuristic.** Full `intro_funnel_submissions` check deferred — simple won-deal presence for trial-shoot graduate detection.
3. **Deal context sourced from company notes.** `deals` table has no `notes` column; `companies.notes` serves as the deal context proxy. Future: compose from activity log + quote context + outreach research.
4. **Product config step is a placeholder.** Always returns false (not done) since no product specs have registered their wizard keys yet. OS-2 refines this.
5. **Practical setup wizard keys are forward references.** `practical-contact-details`, `practical-ad-accounts`, `practical-content-archive` — will be registered when their wizard definitions are built.
6. **No `logActivity` in auto-creation.** Removed to keep the function synchronous and injectable-db-compatible. Callers log activity in their own context.

## Verification (G0–G12)

- **G0** — UI-13 and UI-12 handoffs read. Spec `onboarding-and-segmentation.md` read in full. BUILD_PLAN Wave 11 read.
- **G1** — preconditions verified: `companies` table exists, `contacts` table exists, `brand_dna_profiles` schema exists, `wizard_completions` schema exists, `user` table exists, `sendEmail` adapter exists, `checkBrandVoiceDrift` exists, `invokeLlmText` exists, portal guard exists.
- **G2** — files match BUILD_PLAN OS-1 scope.
- **G3** — Tier-1 motion only. `houseSpring`-compatible fade-up stagger with `useReducedMotion` fallback. Zero Tier-2 slots claimed.
- **G4** — no numeric/string literals in autonomy-sensitive paths.
- **G5** — context budget held. Medium session as estimated.
- **G6** — migration 0040 additive (all nullable ALTER TABLE ADD COLUMN). Feature-flag-gated via `llm_calls_enabled` for LLM calls. No new kill switch.
- **G7** — 0 TS errors, 147 test files / 1066 passed + 1 skipped (+15 new), clean production build, lint at 35 errors (baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1066 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 35 errors (baseline).
- **G9** — no desktop regression (new route at `/lite/portal/welcome` is standalone).
- **G10** — manual browser verify not runnable (requires portal session cookie from magic-link flow). Library behaviours exercised by unit tests.
- **G10.5** — N/A (no external reviewer for Wave 11 opener).
- **G11** — this file.
- **G12** — tracker flip + CLOSURE_LOG + commit.

## PATCHES_OWED (raised this session)

- **`os_1_trial_shoot_graduate_detection`** — current heuristic uses won-deal presence. Should use `intro_funnel_submissions` table per spec §8.1 F4.c for precise detection.
- **`os_1_deal_context_assembly`** — welcome summary reads `companies.notes` only. Future: compose from activity_log + quotes + outreach research for richer context.
- **`os_1_product_config_wizard_key`** — product config step always returns false. Each SaaS product spec must register its wizard key in the orchestrator.
- **`os_1_welcome_redirect_wiring`** — magic-link redeem endpoint (`/lite/portal/r/[token]`) currently redirects to `/lite/portal`. Should redirect to `/lite/portal/welcome` for first-time visitors. Wire in a separate session or as part of OS-3.
- **`os_1_manual_browser_verify_owed`** — G10 interactive verification requires a live portal session. Next interactive dev session should test the welcome screen end-to-end.

## Rollback strategy

`git-revertable` + migration-reversible. Migration 0040 is all nullable ALTER TABLE ADD COLUMN — no data loss. Reverting the new files + edits removes:
- Onboarding module (lib/onboarding/)
- Welcome page (app/lite/portal/welcome/)
- 2 LLM model slugs (additive, harmless if unused)
- 8 companies columns + 1 contacts column (nullable, harmless if orphaned)
- Schema enum types (unused if no consumers)

## What the next session (OS-2) inherits

OS-2 is **Revenue Segmentation UI + practical setup steps + upsell layer**. It inherits:

- **`companies` Rev Seg columns** — all 7 columns exist and are nullable. OS-2 writes to them via the Rev Seg questionnaire.
- **`getOnboardingState()`** — OS-2 can call this to determine the current onboarding step. If Rev Seg is the current step, render the questionnaire.
- **`companies.revenue_segmentation_completed_at_ms`** — OS-2 sets this on questionnaire completion.
- **Welcome screen exists** — the CTA on the welcome screen sends clients to `/lite/portal` where the Brand DNA gate fires. After Brand DNA, OS-2's Rev Seg questionnaire is the next step for SaaS.
- **Product config placeholder** — OS-2 should wire real product config wizard key detection into `getOnboardingState()` if product specs are ready.
