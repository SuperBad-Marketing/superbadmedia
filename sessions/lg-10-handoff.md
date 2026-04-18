# `LG-10` — Lead Gen approval queue UI + autonomy state machine — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (10 of 10, wave-closing session)
**Model tier:** Sonnet (native; `/normal`)

## What was built

- **`lib/lead-gen/autonomy.ts`** (new): `transitionAutonomyState(track, event)` — single write path to `autonomy_state` per §12.F. Handles 4 events × 4 modes. Writes `activity_log` on graduation/demotion. Gated behind `lead_gen_enabled` kill-switch. upserts row if missing.

- **`app/lite/admin/lead-gen/actions.ts`** (edit): `approveDraft(draftId)` + `rejectDraft(draftId)` server actions. Approve: sets `status='approved_queued'`, `approval_kind='manual'`, `approved_at`, `approved_by`, then calls `transitionAutonomyState(track, 'clean_approve')`. Reject: sets `status='rejected'`, calls `transitionAutonomyState(track, 'reject')`.

- **`app/lite/admin/lead-gen/QueueTab.tsx`** (new): client component. Filter chips (All/SaaS/Retainer), draft row per AC (company, track chip, score, touch kind, subject, body preview, Approve/Reject). Empty state voiced. `houseSpring` on row enter/exit, `AnimatePresence mode="popLayout"` on list. Optimistic removal.

- **`app/lite/admin/lead-gen/LeadGenTabs.tsx`** (new): tab wrapper (Runs Log / Approval Queue). `layoutId` tab indicator with `houseSpring`. `AnimatePresence mode="wait"` on tab panels. Badge on queue tab showing pending count.

- **`app/lite/admin/lead-gen/page.tsx`** (edit): fetches `outreach_drafts` (pending_approval, left-joined with `lead_candidates`) + `autonomy_state` rows + latest run stats. Passes to `LeadGenTabs`.

- **`tests/lead-gen/lg10-autonomy.test.ts`** (new): 10 tests. All transitions covered: manual→probation at threshold, streak increment below threshold, streak reset on non_clean, probation→auto_send, reject from probation→manual, maintenance_demote from auto_send→manual, reject from auto_send→circuit_broken, kill-switch gate.

## Key decisions

- `approveDraft` always fires `clean_approve` (no edit UI exists yet — see PATCHES_OWED `lg_10_approve_draft_always_clean`).
- `LeadGenTabs.tsx` added (not in original brief whitelist) as a necessary tab container — file whitelist note recorded.
- G3 escape hatch invoked for Wave 14 briefs: only IF-1 brief written; IF-2 through IF-E2E owed by IF-1 session.

## Artefacts

- `lib/lead-gen/autonomy.ts` (new)
- `app/lite/admin/lead-gen/actions.ts` (edited)
- `app/lite/admin/lead-gen/QueueTab.tsx` (new)
- `app/lite/admin/lead-gen/LeadGenTabs.tsx` (new)
- `app/lite/admin/lead-gen/page.tsx` (edited)
- `tests/lead-gen/lg10-autonomy.test.ts` (new)
- `sessions/if-1-brief.md` (new — G11.b)
- `PATCHES_OWED.md` (appended)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 179 files, 1524 passed, 1 skipped
- `npm run build` → clean; `/lite/admin/lead-gen` in output
- `npm run lint` → 0 errors (73 warnings — pre-existing baseline)
- G10: headless CCR environment — dev server not bootable. Build clean + route confirmed in build output.

## Rollback

`feature-flag-gated` — all new code gated behind `lead_gen_enabled`. Rollback = flip flag off.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

No autonomy-sensitive literals shipped. All thresholds (`graduation_threshold`, `probation_threshold`, `maintenance_floor_pct`) read from the `autonomy_state` DB row (schema defaults, not hardcoded in logic). G4: PASS.

## G5 — Motion check

- Draft row enter/exit: `motion.div` with `houseSpring` (y:6→0 / y:-4 + scale:0.98 exit). PASS.
- Tab panel transition: `AnimatePresence mode="wait"` with `houseSpring`. PASS.
- Tab indicator: `layoutId="lead-gen-tab-active"` with `houseSpring`. PASS.
- Filter chip active state: CSS `transition-colors` (see PATCHES_OWED D2). Functional.
- Feedback bar: `AnimatePresence` + `houseSpring`. PASS.
- Reduced-motion: Framer Motion honours `prefers-reduced-motion` by default. PASS.

## G10.5 reviewer verdict — PASS_WITH_NOTES

- Spec fidelity: PASS_WITH_NOTES (D1: approveDraft always fires clean_approve — deferred gap)
- Mockup fidelity: PASS
- Voice fidelity: PASS
- Test honesty: PASS
- Scope discipline: PASS_WITH_NOTES (LeadGenTabs.tsx as necessary helper, noted)

## PATCHES_OWED rows added

- `lg_10_approve_draft_always_clean` — always fires clean_approve; fix when edit UI lands
- `lg_10_filter_chip_animation` — CSS transition vs layoutId on filter chips

## Wave 14 brief status

- `sessions/if-1-brief.md` written (G11.b rolling cadence)
- **Briefs owed by IF-1 before its own work:** `if-2-brief.md`, `if-3-brief.md`, `if-4-brief.md`, `if-e2e-brief.md`
