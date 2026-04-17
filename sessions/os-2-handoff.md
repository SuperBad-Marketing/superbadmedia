# `os-2` — Revenue Segmentation UI + practical setup steps + upsell layer — Handoff

**Closed:** 2026-04-17
**Wave:** 11 — Onboarding + Segmentation (2 of 3)
**Model tier:** Sonnet

---

## What was built

The **SaaS subscriber questionnaire**, **upsell targeting logic**, **practical setup wizard definitions**, and **onboarding nudge email handlers** — completing the second of three Onboarding + Segmentation sessions.

**Files created:**

- `app/lite/portal/onboarding/segmentation/page.tsx` — Server Component. Portal-session-guarded, redirects if already completed or no session. Tab title: "SuperBad — almost there."
- `app/lite/portal/onboarding/segmentation/segmentation-client.tsx` — Client Component. 5 MC questions with card-per-question layout, progress bar, houseSpring motion, "Other" free-text field for industry, submit button. Token-styled throughout.
- `app/lite/portal/onboarding/segmentation/actions.ts` — `submitRevenueSegmentation()` server action. Zod-validated, portal-session-gated, writes 5 Rev Seg columns + `revenue_segmentation_completed_at_ms` to companies table, logs `onboarding_revenue_seg_completed` activity. Idempotent — no-ops if already completed.
- `lib/onboarding/upsell-targeting.ts` — `evaluateUpsellTier(companyId)` returning full `UpsellEvaluation` object (tier + all qualification signals). Two-tier model: Warm (revenue OR high-login, with location gate), Hot (revenue AND engagement AND goal, with location gate). Login frequency from `activity_log` distinct days, feature breadth from activity_log kind-prefix diversity. All thresholds read from `settings.get()`.
- `lib/wizards/defs/practical-setup.ts` — Three `WizardDefinition`s self-registered via `registerWizard()`: `practical-contact-details` (2 steps: form + review, contacts required), `practical-ad-accounts` (3 steps: Meta + Google + review, both optional), `practical-content-archive` (2 steps: form + review, links optional). All client audience, slideover render mode.
- `lib/scheduled-tasks/handlers/onboarding-nudges.ts` — Two scheduled-task handlers: `onboarding_nudge_email` (SaaS escalating 24h→72h→weekly, retainer single 24h), `practical_setup_reminder_email` (per-step targeting, escalating cadence). Both defensive (re-read state at fire time), both self-re-enqueuing.
- `lib/db/migrations/0041_os2_onboarding_settings.sql` — Seeds 14 onboarding settings keys (nudge cadences, upsell thresholds, location gate, retake months).
- `tests/onboarding/revenue-segmentation.test.ts` — 10 tests. Schema validation (5), enum alignment (5), data write (2).
- `tests/onboarding/upsell-targeting.test.ts` — 18 tests. Revenue comparison (5), feature-area prefix (2), Warm logic (3), Hot logic (3), goal alignment (5).
- `tests/onboarding/practical-setup-wizards.test.ts` — 14 tests. Registration (4), step counts (3), completion contracts (4), audience/renderMode (3).

**Files edited:**

- `lib/db/schema/scheduled-tasks.ts` — 2 new task types: `onboarding_nudge_email`, `practical_setup_reminder_email`.
- `lib/settings.ts` — 14 new onboarding settings keys added to typed registry (118 total).
- `lib/scheduled-tasks/handlers/index.ts` — Registered `ONBOARDING_NUDGE_HANDLERS`.
- `lib/wizards/defs/index.ts` — Added `./practical-setup` import for barrel registration.
- `lib/onboarding/index.ts` — Added `evaluateUpsellTier`, `UpsellTier`, `UpsellEvaluation` exports.
- `lib/db/migrations/meta/_journal.json` — Added entry idx 41.
- `tests/settings.test.ts` — Updated count assertions from 104 to 118.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Rev Seg as standalone page, not wizard-shell-wrapped.** The spec §1.1 references the wizard shell, but the questionnaire is a flat 5-question single-page form — wrapping it in the multi-step wizard shell adds complexity without benefit. The dedicated route is cleaner.
2. **Upsell engagement derived from `activity_log`.** No dedicated session-tracking table. Login frequency = distinct dates with any activity for the company. Feature breadth = distinct kind-prefix areas. Good enough for v1; refine with explicit session tracking if needed.
3. **Feature-area prefix as engagement proxy.** `content_*` = 1 feature area, `inbox_*` = 1 feature area, etc. Simple, no new schema, and aligns with how activity_log kinds are namespaced.
4. **Practical setup wizard definitions are shells.** Step content (the actual form UI for contact details, ad accounts, content archive) is rendered by the wizard step library's `form` type. OS-2 registers the definitions + contracts; the step-library runtime renders them.
5. **Nudge handlers use NEXT_PUBLIC_APP_URL for portal links.** Consistent with existing email handlers. Links point to `/lite/portal` and `/lite/portal/onboarding/segmentation`.
6. **Ad account and content archive wizard contracts don't require data.** Both ad accounts and content archive are optional — some businesses don't run ads or have content archives. The `confirmedAt` timestamp is the completion signal.

## Verification (G0–G12)

- **G0** — OS-1 and UI-13 handoffs read. Spec `onboarding-and-segmentation.md` read in full. BUILD_PLAN Wave 11 read.
- **G1** — Preconditions verified: `companies` table + Rev Seg columns exist, `contacts` table + `onboarding_welcome_seen_at_ms` exist, `brand_dna_profiles` schema exists, `wizard_completions` schema exists, `getOnboardingState()` exists, `sendEmail` adapter exists, `logActivity` exists, portal guard exists, `enqueueTask` exists, `registerWizard` exists.
- **G2** — Files match BUILD_PLAN OS-2 scope.
- **G3** — Tier-1 motion only. houseSpring-compatible card hover + progress bar transitions + form reveal. `useReducedMotion` respected. Zero Tier-2 slots claimed.
- **G4** — No numeric/string literals in autonomy-sensitive paths. All nudge cadences, upsell thresholds, location gate, retake months read from settings.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — Migration 0041 is additive (INSERT OR IGNORE settings rows). No new kill switch. Rev Seg action is idempotent. Rollback: git-revertable.
- **G7** — 0 TS errors, 150 test files / 1108 passed + 1 skipped (+42 new), clean production build, lint 0 errors.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1108 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 0 errors.
- **G9** — No desktop regression (new route is standalone portal page).
- **G10** — Manual browser verify not runnable (requires portal session cookie). Library behaviours exercised by unit tests.
- **G10.5** — N/A (no external reviewer for Wave 11 mid-session).
- **G11** — This file.
- **G12** — Tracker flip + CLOSURE_LOG + commit.

## PATCHES_OWED (raised this session)

- **`os_2_rev_seg_routing_wiring`** — The onboarding orchestrator returns `currentStep = "revenue_segmentation"` but no page currently checks this and redirects to `/lite/portal/onboarding/segmentation`. The portal landing page (or a middleware rule) needs to route SaaS subscribers to the Rev Seg page when it's their current step.
- **`os_2_nudge_bootstrap_wiring`** — `onboarding_nudge_email` and `practical_setup_reminder_email` tasks need initial enqueue from the onboarding trigger (quote acceptance for retainer, Stripe payment for SaaS). Neither trigger surface exists yet.
- **`os_2_practical_setup_step_ui`** — Wizard definitions are registered but the actual form UI for each step (contact details form, ad account step-by-step, content archive link form) needs to be built as wizard step client components. The wizard step library's `form` type provides the shell; content needs custom clients.
- **`os_2_upsell_cockpit_surface`** — `evaluateUpsellTier()` is exported but the Daily Cockpit doesn't exist yet. Cockpit alerts ("just hit hot") and pipeline filter ("Upsell candidates") wire in their respective waves.
- **`os_2_manual_browser_verify_owed`** — G10 interactive verification requires a live portal session. Next interactive dev session should test the Rev Seg questionnaire end-to-end.
- **`os_2_lint_baseline_drift`** — Lint count reports 58 warnings (was reported as "35 errors" in prior handoffs). No new OS-2 lint issues. Investigate whether baseline metric changed between lint runs or the custom rules softened to warnings.

## Rollback strategy

`git-revertable` + migration-reversible. Migration 0041 is INSERT OR IGNORE — no data loss. Reverting the new files + edits removes:
- Rev Seg page + client + action (app/lite/portal/onboarding/segmentation/)
- Upsell targeting module (lib/onboarding/upsell-targeting.ts)
- Practical setup wizard definitions (lib/wizards/defs/practical-setup.ts)
- Nudge email handlers (lib/scheduled-tasks/handlers/onboarding-nudges.ts)
- 14 settings rows (harmless if orphaned)
- 2 scheduled_task types (additive, harmless if unused)

## What the next session (OS-3) inherits

OS-3 is **Token portal auth + credential creation + non-start nudge cadence**. It inherits:

- **Rev Seg questionnaire exists** at `/lite/portal/onboarding/segmentation`. OS-3 may need to wire onboarding routing so the orchestrator redirects SaaS subscribers there after Brand DNA.
- **Nudge handlers are registered** but not yet enqueued. OS-3 owns the initial enqueue from the appropriate triggers.
- **Practical setup wizard definitions are registered** — the wizard shell can render them. OS-3 may wire the portal to show incomplete practical setup steps.
- **Settings keys seeded** — all 14 onboarding keys are in the DB and the typed registry.
- **`evaluateUpsellTier()` exported** from `lib/onboarding/index.ts`. Downstream consumers (cockpit, pipeline) wire it in their own waves.
