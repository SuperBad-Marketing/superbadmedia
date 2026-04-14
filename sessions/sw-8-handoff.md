# SW-8 — Wizard nudge + expiry crons — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-8-brief.md`
**Model:** Sonnet (`/normal`)
**Type:** INFRA + FEATURE
**Track:** **A** — wizard nudge/expiry crons + voice (Track B non-critical admin wizards deferred to SW-9).
**Rollback:** feature-flag-gated via new `wizards_nudges_enabled` kill-switch (nudges + warn emails). `wizard_expire` handler runs regardless — it's the data-only lifecycle terminator and must keep releasing the partial-unique-index slot on `wizard_progress(user_id, wizard_key)` even if comms are paused. Revert = delete new files + revert schema task-type enum + kill-switch key. No migration. No data-shape change.

## What shipped

- **3 new `ScheduledTaskType` enum values** in `lib/db/schema/scheduled-tasks.ts` — grouped under a new `// --- Setup Wizards (3) ---` block: `wizard_resume_nudge`, `wizard_expiry_warn`, `wizard_expire`. Names match `docs/specs/setup-wizards.md` §11 (brief drifted on the third name — it said `wizard_auto_expire`, spec says `wizard_expire`; went with the spec per START_HERE "specs are authoritative, handoffs are supplementary").
- **New kill-switch `wizards_nudges_enabled`** in `lib/kill-switches.ts` (default `false`). Nudge + warn handlers no-op when off; expire handler ignores the switch. Brief §7 authorised the independent switch so Phase-6 shadow can pause comms without freezing the lifecycle.
- **`lib/wizards/nudge/content.ts`** — subject pools + HTML bodies for resume-nudge + expiry-warn emails, plus a deterministic `pickSubject(pool, seed)` for per-row subject rotation. Canonical content lives at `docs/content/setup-wizards/nudge-emails.md` (matches the Phase 3.5 step 3a "content home under `docs/content/<spec-name>.md`" rule).
- **`lib/wizards/nudge/handlers.ts`** — three `TaskHandler` impls exported together as `wizardNudgeHandlers: HandlerMap`. All three are defensive: re-read `wizard_progress` at fire time, drop silently if abandoned, completed, or the scheduling assumption has been invalidated by later activity. Resume-nudge additionally checks `scheduledForLastActiveAtMs === row.last_active_at_ms` so stale tasks (left behind after an activity update enqueued a fresher nudge) fire and no-op. Both email handlers send via the A7 `sendEmail()` adapter with `classification: "transactional"` (spec §9 line 244) so quiet window + outreach kill-switch don't interfere with a user-initiated flow continuation.
- **`lib/wizards/nudge/enqueue.ts`** — `scheduleWizardNudges(row)` and `cancelWizardNudges(progressId)` helpers. The enqueue path is idempotent per task type:
  - `wizard_resume_nudge` idempotency key includes `last_active_at_ms` so re-enqueue on each activity update yields a fresh row; old tasks stay pending and no-op at fire time.
  - `wizard_expiry_warn` + `wizard_expire` idempotency keys are tied to `progressId` alone — exactly one of each per live row.
  Cancel uses `idempotency_key` LIKE/= patterns to scope to a single progress row (cheap + correct given the row's keys encode `progressId`). Both helpers ship unwired — SW-1's runtime doesn't yet write `wizard_progress`; the eventual insert path (plus the celebration orchestrator on completion) will call these.
- **`docs/content/setup-wizards/nudge-emails.md`** — canonical copy, written in the dry observational voice (no synergy/leverage/solutions). Subject pool + body template per stage. Notes the expire handler is data-only (no "you ran out of time" email — reads as scold).
- **`tests/wizard-nudge-handlers.test.ts`** — 10 new unit/integration tests:
  - schedule writes all three tasks with correct fire times and idempotency keys
  - schedule on activity update yields a second resume-nudge row (expiry-warn + expire stay at 1 each)
  - cancel deletes only the given progressId's pending rows (uses a second wizard_key for the co-tenant row to clear the partial unique index)
  - resume-nudge handler: no-op when kill-switch off, sends transactional email when live, skips on stale `last_active_at_ms`, skips on abandoned row
  - expire handler: marks `abandoned_at_ms`, logs `wizard_abandoned`, runs regardless of nudge kill-switch
  - integration: schedule → rewind `run_at` → `tick(wizardNudgeHandlers)` → assert 3 processed, 2 emails sent (nudge + warn), row abandoned

## Decisions

- **Task name = `wizard_expire`, not `wizard_auto_expire`.** Brief §4 used the latter; spec §11 + PATCHES_OWED cadence both use `wizard_expire`. Spec wins per START_HERE "specs authoritative, handoffs supplementary". Brief cross-reference noted in this handoff so SW-9's brief-writer doesn't reintroduce the drift.
- **New `wizards_nudges_enabled` kill-switch** rather than folding into `setup_wizards_enabled`. Brief §7 flagged this as the right call for the Phase-6 shadow — Andy wants to be able to pause nudge comms without taking the whole wizard family offline. Independent switch, default `false` (flipped on at Phase 6 launch alongside outreach/scheduled-tasks).
- **`wizard_expire` runs regardless of the nudge kill-switch.** It's the only thing that releases the `wizard_progress` partial-unique-index slot for `(user_id, wizard_key)` once a user abandons mid-flow. If it were kill-switched, pausing nudges would also mean no user could ever restart that wizard — broken. Gated only inside itself on the row being live to begin with.
- **Resume URL picked locally from a small `CRITICAL` set** (`stripe-admin`, `resend`, `graph-api-admin`). Non-critical admin wizard routes are TBD per brief §6 (owned by SW-9+). Fallback: `/lite/setup/<wizardKey>?resume=1`. Avoids building a wizard-route registry before Track B lands and forces the route-tree question at SW-9 rather than silently hard-coding it here.
- **Display name = wizard key.** `WizardDefinition` doesn't carry a display-name field. `getWizard(key)?.key ?? key` reads fine in copy (`"Your setup is still there"` is fine without naming the wizard inline; body templates reference `stripe-admin` verbatim which is acceptable dev voice). A content mini-session can refine this by adding `displayName?: string` to `WizardDefinition` later — logged informally in Open threads, not as a PATCHES_OWED row (it's optional polish, not a gap).
- **Helpers unwired.** Brief didn't require wiring into any existing write path because `wizard_progress` isn't yet inserted by any production code — SW-1 landed the schema, but row creation plumbing is still deferred. When the eventual progress-row writer lands (SW-9 or later), it calls `scheduleWizardNudges()` on insert/activity and `cancelWizardNudges()` on completion/abandonment. Contract is narrow enough to not drift.
- **`cancelWizardNudges` uses `idempotency_key` LIKE/equality** rather than payload JSON querying. SQLite's JSON1 functions work but Drizzle requires a raw SQL helper; the idempotency-key encoding (`<task_type>:<progressId>[:...]`) already carries the progressId, so a prefix match is both cheap and exact.

## Files touched

| File | Change |
| --- | --- |
| `lib/db/schema/scheduled-tasks.ts` | Add 3 `ScheduledTaskType` values (Setup Wizards block) |
| `lib/kill-switches.ts` | Add `wizards_nudges_enabled` key + default |
| `lib/wizards/nudge/content.ts` | NEW — subject pools + body templates |
| `lib/wizards/nudge/handlers.ts` | NEW — 3 handlers + `wizardNudgeHandlers` HandlerMap |
| `lib/wizards/nudge/enqueue.ts` | NEW — `scheduleWizardNudges()` + `cancelWizardNudges()` |
| `docs/content/setup-wizards/nudge-emails.md` | NEW — canonical email copy |
| `tests/wizard-nudge-handlers.test.ts` | NEW — 10 tests |
| `sessions/sw-8-handoff.md` | NEW (this file) |
| `sessions/sw-9-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-9 |

No migration. No schema change (enum extension only in TS — the SQLite `task_type` column is `text`, no CHECK constraint). No new settings keys (`wizards.resume_nudge_hours` + `wizards.expiry_days` already seeded from the Phase-5 Foundation-A seed migration).

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — **340/340 green** (330 prior + 10 new from `wizard-nudge-handlers.test.ts`)
- `npm run lint` — clean (one unused-var warning fixed inline via `void params`)
- `npm run build` — clean; no new routes
- `npm run test:e2e` — not required (non-critical flow per AUTONOMY §G12; handlers run inside an already-covered worker path)

## G0–G12 walkthrough

- **G0 kickoff** — brief read; last two handoffs (SW-7, SW-6) read; Sonnet tier matches brief.
- **G1 preflight** — 5/5 preconditions verified: SW-7 handoff, per-wizard client split present, defs barrel imports `graph-api-admin`, `scheduled_tasks` schema present (A6), `sendEmail()` present at `lib/channels/email/send.ts` (brief said `lib/email/` — minor inaccuracy, noted without a patch because A7's handoff already documents the real path).
- **G2 scope discipline** — every file in Track A's whitelist; nothing in Track B's whitelist touched. Route-tree decision for non-critical admin wizards deliberately deferred to SW-9 (brief §6 allows either path).
- **G3 context budget** — comfortable single-session; no split needed.
- **G4 literal-grep** — no autonomy thresholds introduced. Reads `wizards.resume_nudge_hours` via `settings.get()`. The `24 * 60 * 60 * 1000` and `30 * 24 * 60 * 60 * 1000` expressions are unit conversions (hours/days → ms) on top of settings values, not thresholds themselves — same shape as existing `lib/scheduled-tasks/worker.ts`'s `5 * 60 * 1000` backoff constants.
- **G5 motion** — no motion changes.
- **G6 rollback** — feature-flag-gated via new `wizards_nudges_enabled` switch; expire handler intentionally ungated (lifecycle correctness). No schema migration.
- **G7 artefacts** — every file in the handoff table present (verified by test run importing each module + git status before commit).
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — not required. Handlers ride the scheduled-tasks worker which has existing integration coverage in `tests/scheduled-tasks.test.ts`; this session's integration test exercises the full `tick(wizardNudgeHandlers)` path end-to-end.
- **G10 manual browser** — N/A (no UI surface this session).
- **G11.b** — SW-9 brief pre-compiled.
- **G12** — tracker + commit next.

## Consolidated cron view — additions

Three rows added to the BUILD_PLAN.md §C conceptual table (enum names match spec §11):

| Job | Cadence | Owner | Handler | Touches | Kill-switch |
|---|---|---|---|---|---|
| `wizard_resume_nudge` | 24h after `wizard_progress.last_active_at_ms` | SW-8 | `handleWizardResumeNudge` | `wizard_progress` read, `sendEmail()` | `wizards_nudges_enabled` |
| `wizard_expiry_warn` | `expires_at_ms − 1d` | SW-8 | `handleWizardExpiryWarn` | `wizard_progress` read, `sendEmail()` | `wizards_nudges_enabled` |
| `wizard_expire` | `expires_at_ms` | SW-8 | `handleWizardExpire` | `wizard_progress` update + `activity_log` insert | none (always runs) |

## PATCHES_OWED status

- **Closed this session:** none
- **Opened this session:** none
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave
  - `sw7b_graph_oauth_callback_hardening` — pairs with Azure app registration

## Open threads for SW-9

- **Track B (non-critical admin wizards)** still unshipped. Recommended first unit: **Pixieset-admin** (IF-2 in Wave 14 consumes it; P0 spike locked outcome B — on-brand link-out paste-URL wizard). Second unit after that: Meta Ads / Google Ads / Twilio / generic API-key wizards in any order.
- **Non-critical admin wizard route tree** still TBD. Brief §6 Track B flagged this as a decide-in-session call. SW-9 must pick a location before landing Pixieset — likely `/lite/setup/admin/[key]` (parallel to the critical-flight tree) or `/lite/setup/integrations/[key]`. Patch `docs/specs/setup-wizards.md` §5 in the same session.
- **`WizardDefinition.displayName`** — optional nicety for copy readability in nudge emails. Not blocking; can land alongside the first non-critical wizard if the copy starts feeling wooden.
- **Wiring into the progress-row writer.** `scheduleWizardNudges()` and `cancelWizardNudges()` are unconsumed until a future session lands the `wizard_progress` insert/update plumbing. That session must:
  1. Call `scheduleWizardNudges(row)` on row create + on every `last_active_at_ms` bump.
  2. Call `cancelWizardNudges(row.id)` on `wizard_completed` + manual abandon.
- **Worker handler composition.** `wizardNudgeHandlers` is exported but not yet plugged into any top-level `startWorker()` call — Quote Builder is the first feature to wire `startWorker`, and that session (Wave 6 QB-6) merges all HandlerMaps. Until then the handlers sit dormant. Not a gap; just a dependency on a later wave.

## Notes

- The `"use server"` test-file note from SW-7 (next-server orphan on port 3101 before Playwright) didn't recur this session — no E2E run required.
- `sendEmail()` mock in the test file uses `void params` to silence `no-unused-vars` while keeping the typed signature intact; follows the same pattern as A7's mocked-Resend tests.
- The `cancelWizardNudges` implementation intentionally does not touch `running` or `done`/`failed` rows — only `pending`. If the worker has already claimed a resume-nudge at the moment the user completes the wizard, the handler will re-check liveness and drop silently (the row is no longer live), so the race is closed without needing cancel to reach into `running`.
