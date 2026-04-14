# SP-5 — Trial Shoot panel + `trial_shoot_status` sub-machine — Brief

**Type:** FEATURE (small–medium)
**Model tier:** Opus (/deep) — state-machine + schema-touching helpers + first admin Company route.
**Spec:** `docs/specs/sales-pipeline.md` §§ 7, 9, 10.1
**Depends on:** SP-1 (`companies.trial_shoot_*` columns), SP-2 (activity-log transaction pattern), SP-4 (snooze-popover-style meta-keyed activity pattern).

## 1. Goal

Lock the Trial Shoot sub-status lifecycle in code + ship the admin-facing panel the spec §9 describes. Deal stage stays in `trial_shoot` throughout; this sub-machine is orthogonal.

## 2. Scope

### 2.1 `lib/crm/trial-shoot-status.ts` — constants
- `TRIAL_SHOOT_SEQUENCE` tuple: `['none', 'booked', 'planned', 'in_progress', 'completed_awaiting_feedback', 'completed_feedback_provided']`.
- `isForwardTransition(from, to)` — returns true when `to`'s index > `from`'s index. Rejects equal + regression.
- Terminal predicate `isTrialShootComplete(status)` — true when status in `completed_*`.

### 2.2 `lib/crm/advance-trial-shoot-status.ts` — mutation helper
- `advanceTrialShootStatus(companyId, toStatus, { by, nowMs? }, dbArg?)`:
  - Loads company, rejects unknown id.
  - Rejects identity + regression via `isForwardTransition`.
  - Updates `companies.trial_shoot_status = toStatus` + `updated_at_ms`.
  - If `toStatus` is `completed_*` and `trial_shoot_completed_at` is null, stamps `trial_shoot_completed_at = nowMs`.
  - Inserts `activity_log` row `kind='note'`, `company_id=companyId`, `meta={kind:"trial_shoot_status_change", from, to, by}`.
  - Entire op inside `database.transaction(tx)`.
- `advanceTrialShootStatusOnFeedback(companyId, { nowMs? }, dbArg?)` — convenience wrapper the Intro Funnel spec will call. If current status is `completed_awaiting_feedback`, advances to `completed_feedback_provided`; any other state is a no-op (no error, returns `{ advanced: false }`). Matches spec §9.3 auto-flip rule.
- `lib/crm/index.ts` re-exports.

### 2.3 `lib/crm/update-trial-shoot-plan.ts` — mutation helper
- `updateTrialShootPlan(companyId, plan, { by }, dbArg?)` — writes `companies.trial_shoot_plan = plan` + `updated_at_ms`. Inserts `activity_log` row `kind='note'` + `meta={kind:"trial_shoot_plan_updated", by}` (body is the plan text truncated to 280 chars for the feed). Transaction-wrapped.

### 2.4 Panel component `components/lite/company/trial-shoot-panel.tsx`
- Client Component, accepts `{ companyId, status, plan, completedAt, feedback }` props.
- **Stepper:** horizontal, 5 steps (drops `none` from the display — it's a "not started" placeholder, rendered as a muted "Not started" chip above the stepper when status === 'none'). Current step highlighted; prior checked; future dim. Uses tokens from the design system — no raw hex; reuse `components/ui/*` where possible; step indicator built with tailwind primitives.
- **Plan:** `textarea` (from `components/ui/textarea.tsx`); "Save plan" button fires `updateTrialShootPlanAction`. Dirty-state detection; toast on save.
- **Advance control:** dropdown (or row of buttons) listing every legal forward status; disabled entries for regression. Clicking commits via `advanceTrialShootStatusAction`. Transition triggers optimistic local update + success toast.
- **Feedback display:** read-only rendering of `feedback` text/JSON if present. If JSON, render `<pre>` with light formatting; otherwise plain paragraphs. Explicit "No feedback yet." empty state.
- **Completion timestamp:** formatted Australia/Melbourne (match errors page formatter) when status is completed.

### 2.5 Server actions `app/lite/admin/companies/[id]/actions.ts`
- `updateTrialShootPlanAction(companyId, plan)` — admin re-check → `updateTrialShootPlan()` → `revalidatePath("/lite/admin/companies/"+id)`.
- `advanceTrialShootStatusAction(companyId, toStatus)` — admin re-check → `advanceTrialShootStatus()` → revalidate.

### 2.6 Thin admin route `app/lite/admin/companies/[id]/page.tsx`
- Server Component, admin-gated (mirror `pipeline/page.tsx`).
- Loads company by id → 404 on miss.
- Renders minimal header (company name + shape + website if present) and mounts `<TrialShootPanel>` with props. No tabs, no contacts list, no deals list — those are Client Management spec surface area.
- Back link to `/lite/admin/pipeline`.

## 3. Out of scope

- SheetWithSound primitive (§7.2) — defer; not required since the panel is surfaced on a plain admin page for SP-5.
- Full Company profile (contacts, deals, billing) — Client Management spec.
- Stripe webhook auto-transitions (§10.1 `trial_shoot_status='booked'` on intro checkout) — SP-7.
- Feedback questionnaire UI — Intro Funnel spec. We only render the stored value.
- Emailing/notifying on state changes.
- Regression / "undo" transitions — forward-only; corrections are a later enhancement.
- `activity_log` enum extension (`trial_shoot_status_change` / `trial_shoot_plan_updated`) — using `kind='note'` + `meta.kind` per SP-4 convention.

## 4. Preflight

- `companies.trial_shoot_status` / `_plan` / `_feedback` / `_completed_at` present (SP-1). ✓ confirmed via spec §11.2 + SP-1 handoff.
- `activity_log` accepts `kind='note'` + `company_id` FK (SP-1 added FKs). ✓
- `components/ui/textarea.tsx` present. ✓
- Admin auth pattern — mirror `app/lite/admin/pipeline/page.tsx:59`. ✓

## 5. Verification

- `npx tsc --noEmit` clean; `npm test` green (add ~10 unit tests covering forward/identity/regression matrix, feedback auto-flip no-op & fire, plan update, completed_at stamp on first completed transition, FK validation).
- G4 literal-grep: no autonomy thresholds introduced (all timing/state constants are enum values or UI layout, not tunable).
- Manual browser (owed): seed a company with `trial_shoot_status='booked'`, open `/lite/admin/companies/[id]`, advance to `planned`, save plan text, advance to `completed_awaiting_feedback`, confirm `completed_at` stamps.

## 6. Risks

- **Forward-only lockout.** If Andy mis-advances, there's no UI to back out. Mitigation: transitions are logged via activity_log so a DB fix is auditable; regression helper can ship later.
- **Feedback JSON shape unlocked.** Intro Funnel hasn't locked the structure yet. Render as `<pre>` fallback + plain-text branch; no validation. No schema migration depends on shape.
- **Admin Company route collision.** Client Management spec will own `/lite/admin/companies/[id]`. We reserve the path deliberately so that spec extends rather than replaces. Layout in this session is intentionally thin.

## 7. Settings keys

None added. None read.

## 8. Migrations

None. All columns exist from SP-1.

## 9. PATCHES_OWED

None opened or closed.
