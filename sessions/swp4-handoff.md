# SWP-4 Handoff — Shoot-Day Notes Form + Generate Plan Trigger

**Date:** 2026-04-19
**Wave:** 15
**Status:** COMPLETE

## What was built

- **Shoot-day notes panel** (`components/lite/company/shoot-day-notes-panel.tsx`):
  - Full structured form per spec §3: Marketing Infrastructure (6 radio groups with optional notes), Goals (ordered 1–3 with add/remove), Shoot-Day Signals (4 × 1–5 scale with anchor labels), Observations (textarea with 40-char minimum counter)
  - Enrichment pre-fill label shown when `enrichment_prefill_json` is present
  - Soft validation: all infra radios, ≥1 goal, all signals, observations ≥40 chars
  - Soft override: "Generate with incomplete notes?" confirmation when validation fails
  - Plan status badge (Generating / Strategy review / Detail review / Approved / Released / Archived / Superseded) with tone-matched colours
  - "Open review →" link shown when plan is in `pending_strategy_review` or `pending_detail_review`
  - "Generate plan" button hidden when an active plan exists (not archived/superseded)

- **Server actions** added to `app/lite/admin/companies/[id]/actions.ts`:
  - `saveShootDayNotesAction(companyId, input)` — upserts `trial_shoot_notes` row (creates on first save, updates on subsequent)
  - `generateSixWeekPlanAction(companyId, dealId)` — creates `six_week_plans` row (status: generating), enqueues `six_week_plan_generate` scheduled task, logs `six_week_plan_generation_started` activity

- **Company detail page integration** (`app/lite/admin/companies/[id]/page.tsx`):
  - Loads `trial_shoot_notes` + latest `six_week_plans` row for trial_shoot-stage deals
  - Renders `ShootDayNotesPanel` between LinkedDealsPanel and LinkedInvoicesPanel in the Overview tab
  - Panel only appears when a deal in `trial_shoot` stage exists

## New files

- `components/lite/company/shoot-day-notes-panel.tsx`
- `sessions/swp4-handoff.md`

## Edited files

- `app/lite/admin/companies/[id]/actions.ts` — +2 server actions, +5 imports
- `app/lite/admin/companies/[id]/page.tsx` — +3 imports, data loading for notes/plan, OverviewTab props extended, panel rendered

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)
- Dev server: form renders on Fitzroy Florist company page (trial_shoot deal), save persists to DB, generate creates plan row + enqueues task + logs activity, status badge shows "Generating", generate button disappears after plan created

## Key decisions

- Panel renders in OverviewTab (not a separate tab) — it's a sub-section of the deal lifecycle, visible when any deal is in trial_shoot stage
- `saveShootDayNotesAction` always saves before `generateSixWeekPlanAction` — generate calls save first to ensure notes are current
- Enrichment prefill is read-only display (label only); actual prefill of form values from enrichment data is deferred to when enrichment integration is wired (the schema stores `enrichment_prefill_json` for audit trail)
- Used the same visual panel pattern (PanelShell-like rounded card with header) as LinkedDealsPanel for consistency

## Rollback

- Kill-switch gated: `plan_automations_enabled` (from SWP-3) disables generation
- Feature-flag gated: `features.six_week_plan_enabled` (per spec §19)
- No new migrations — tables already existed from SWP-1
- Git-revertable: no data shape changes

## Next session should know

- SWP-5 scope depends on BUILD_PLAN.md — likely the PDF renderer or portal plan surface
- The review UI at `/lite/six-week-plans/[planId]/review` (built in SWP-3) is now reachable via the "Open review →" link on the panel when a plan reaches review state
- The `competitors` field is a free text comma-separated string (not structured) — matches spec §3.1
- Dev env note: `RESEND_API_KEY` must be set in `.env.local` (even a placeholder) to avoid module-level crash on page renders that transitively import Resend
