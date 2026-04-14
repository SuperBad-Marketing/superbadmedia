# SP-5 — Trial Shoot panel + `trial_shoot_status` sub-machine — Handoff

**Closed:** 2026-04-14
**Spec:** `docs/specs/sales-pipeline.md` §§ 7, 9
**Brief:** `sessions/sp-5-brief.md`

## What shipped

- `lib/crm/trial-shoot-status.ts` — constants + pure helpers:
  - `TRIAL_SHOOT_SEQUENCE` (6-state tuple re-exported from schema).
  - `isForwardTransition(from, to)` — strict index comparison.
  - `isTrialShootComplete(status)` — true for the two `completed_*` states.
  - `legalForwardTargets(from)` — slice of sequence ahead of `from`.
- `lib/crm/advance-trial-shoot-status.ts`:
  - `advanceTrialShootStatus(companyId, toStatus, { by, nowMs? }, dbArg?)`
    — transaction; rejects unknown id / identity / regression; stamps
    `trial_shoot_completed_at_ms` on first `completed_*` landing only;
    writes one `activity_log` row `kind='note'`, `meta.kind='trial_shoot_status_change'`.
  - `advanceTrialShootStatusOnFeedback(companyId, …)` — silent no-op unless
    current status is `completed_awaiting_feedback`, in which case it
    advances to `completed_feedback_provided`. Will be called from the
    Intro Funnel feedback questionnaire handler when that ships.
- `lib/crm/update-trial-shoot-plan.ts` — writes `trial_shoot_plan` (trims;
  empty string clears), one `activity_log` row `meta.kind='trial_shoot_plan_updated'`
  with a truncated body preview.
- `lib/crm/index.ts` — barrel re-exports.
- `app/lite/admin/companies/[id]/actions.ts` — two Server Actions
  (`advanceTrialShootStatusAction`, `updateTrialShootPlanAction`) with
  admin re-check + `revalidatePath`.
- `app/lite/admin/companies/[id]/page.tsx` — thin admin route; header
  (name + shape/domain) + back link to `/lite/admin/pipeline` +
  `<TrialShootPanel>`. Client Management spec will extend this page.
- `components/lite/company/trial-shoot-panel.tsx` — stepper (5 real
  steps; `none` rendered as pre-stepper chip), plan textarea with dirty
  detection + "Save plan" button, feedback read-only block, completion
  timestamp in Australia/Melbourne. Advance control via `Select`
  listing `legalForwardTargets`; forward-only, no regression.
- Tests: `tests/crm/trial-shoot-status.test.ts` (4 describe blocks, 7
  cases); `tests/crm/advance-trial-shoot-status.test.ts` (11 cases
  covering forward/identity/regression, completed_at preservation,
  auto-flip on feedback, plan update + clear, unknown-id paths).

## Decisions

- **`activity_log.kind='note'` + `meta.kind=…`** — matches SP-4 snooze
  pattern. No enum widening; downstream filters use `meta.kind`.
- **Skip allowed, regression rejected.** Spec §9.3 doesn't require
  lock-step progression; skipping matches real operational flexibility.
  Regression blocked so the activity log remains a monotonic history
  — a corrections UI can ship later without breaking invariants.
- **`completed_at_ms` stamped once.** First landing in any `completed_*`
  state sets it; subsequent completed transitions preserve the value.
- **Thin Company page.** `/lite/admin/companies/[id]` reserved for the
  Client Management spec. Header is minimal; no tabs, no contacts list,
  no deals list in this session.
- **SheetWithSound deferred.** Spec §7.2 names it; not required to ship
  the panel, so deferred to whichever session builds it first.

## Preconditions verified

- `companies.trial_shoot_status` / `_plan` / `_feedback` / `_completed_at_ms`
  (SP-1 schema). ✓
- `activity_log` with FK `company_id` cascade (SP-1). ✓
- `components/ui/{textarea,select,button}.tsx` present. ✓
- Admin session gate pattern (`pipeline/page.tsx:59`). ✓

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — **470/470 green** (+18 new SP-5 tests).
- `npm run lint` — SP-5 files clean. 3 pre-existing errors remain in
  `pipeline/page.tsx` + `snooze-popover.tsx` (react-hooks/purity) — not
  owed by this session.
- G4 literal-grep — no autonomy thresholds introduced. `MAX_BODY_CHARS=280`
  is a readability truncation for log bodies, not a tunable; `rows={5}`
  is UI layout. No new settings keys.
- Manual browser — owed next session. Needs a seeded company with
  `trial_shoot_status='booked'` and a known id; open
  `/lite/admin/companies/<id>`, advance through the stepper, confirm
  completed_at stamp, save a plan, confirm toast.

## Not shipped (out of scope per brief §3)

- SheetWithSound primitive.
- Full Company profile (contacts/deals/billing tabs) — Client Management.
- Stripe webhook auto-transitions — SP-7.
- Intro Funnel feedback questionnaire — separate spec.
- Regression / correction UI.
- Enum extension for `trial_shoot_status_change` / `trial_shoot_plan_updated`.

## PATCHES_OWED

None opened or closed.

## Next session

**Wave 5 SP-6** — Won/Lost flows + `billing_mode` field + loss-reason
modal. Per `BUILD_PLAN.md`.
