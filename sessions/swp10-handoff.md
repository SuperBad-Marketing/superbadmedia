# SWP-10 Handoff — Non-Converter Expiry + Settings Audit

**Date:** 2026-04-20
**Wave:** 15
**Status:** COMPLETE

## What was built

- **Day-53 expiry email handler** (`lib/six-week-plan/expiry.ts` → `runExpiryEmailSweep()`):
  - Daily sweep finds non-converter plans where `trial_shoot_completed_at_ms` is 53+ days ago (configurable via `plan.portal_access_days_post_shoot` − `plan.expiry_email_days_before_archive`)
  - Three-condition gate: deal NOT won, portal NOT already archived, portal NOT manually extended
  - Sends email via `sendEmail()` with `six_week_plan_expiry_email` classification
  - Fresh PDF render attached (bypasses cache via `skipCache: true`)
  - Email body includes warm sign-off, signposting, soft CTA with mailto + prefilled subject
  - Stamps `portal_expiry_email_sent_at_ms` and logs `six_week_plan_expiry_email_sent` activity

- **Day-60 portal archive handler** (`lib/six-week-plan/expiry.ts` → `runPortalArchiveSweep()`):
  - Same three-condition gate
  - Sets `portal_archived_at_ms` and transitions plan status to `archived`
  - Logs `six_week_plan_portal_archived_non_converter` activity
  - No email — that's the day-53 job's responsibility

- **Self-perpetuating scheduled task handlers:**
  - `lib/scheduled-tasks/handlers/six-week-plan-expiry-email.ts` — runs at ~07:00 AEST, schedules next day
  - `lib/scheduled-tasks/handlers/six-week-plan-non-converter-archive.ts` — runs at ~07:30 AEST, schedules next day
  - Both gated on `killSwitches.plan_automations_enabled`
  - Registered in `lib/scheduled-tasks/handlers/index.ts`

- **Settings audit — 3 literals converted to `settings.get()`:**
  - `lib/six-week-plan/render-plan-pdf.ts`: PDF cache TTL was hardcoded `24 * 60 * 60 * 1000` → now reads `settings.get("plan.pdf_cache_hours")`
  - `components/lite/portal/plan-view.tsx`: revision note minimum was hardcoded `40` → now reads `revisionMinChars` prop from `settings.get("plan.revision_note_min_chars")`
  - `components/lite/company/shoot-day-notes-panel.tsx`: observations minimum was hardcoded `40` → now reads `observationsMinChars` prop from `settings.get("plan.observations_min_chars")`

- **`renderPlanPdf()` gained `skipCache` option** — used by expiry email for fresh renders per spec §6.5

## New files

- `lib/six-week-plan/expiry.ts`
- `lib/scheduled-tasks/handlers/six-week-plan-expiry-email.ts`
- `lib/scheduled-tasks/handlers/six-week-plan-non-converter-archive.ts`
- `tests/swp10-expiry.test.ts` (16 tests)

## Edited files

- `lib/scheduled-tasks/handlers/index.ts` — registered 2 new handler maps
- `lib/six-week-plan/render-plan-pdf.ts` — added `skipCache` opt + settings-based cache TTL
- `components/lite/portal/plan-view.tsx` — `revisionMinChars` prop replaces hardcoded 40
- `components/lite/company/shoot-day-notes-panel.tsx` — `observationsMinChars` prop replaces hardcoded 40
- `app/lite/portal/[token]/plan/page.tsx` — fetches `plan.revision_note_min_chars` setting, passes to PlanView
- `app/lite/admin/companies/[id]/page.tsx` — fetches `plan.observations_min_chars` setting, passes through OverviewTab to ShootDayNotesPanel

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 225 files, 1867 passed, 1 skipped (unchanged)

## Key decisions

- Both sweeps share `findEligiblePlans()` in `expiry.ts` to avoid duplication of the three-condition gate
- Shoot completion date read from `companies.trial_shoot_completed_at_ms` (not from the plan row)
- Handlers self-perpetuate via `enqueueTask()` with daily idempotency keys, staggered 30 min apart
- Settings audit scope was all SWP feature code — three autonomy-sensitive literals found and converted

## Rollback

- Git-revertable: no data shape changes, no migration, no new settings keys (all pre-seeded in SWP-1)
- Both handlers gated on `plan_automations_enabled` kill switch

## Wave 15 status

**Wave 15 COMPLETE.** All 10 SWP sessions (SWP-1 through SWP-10) are done. Next wave is Wave 16 (Client Context Engine).
