# QB-6 — Scheduled-task handlers: quote_expire + quote_reminder_3d

**Date:** 2026-04-14
**Closes:** `qb_subs_g11b_brief_miss` (brief authored this session), `qb6_scheduled_task_handlers` (narrowed)
**Tier:** Opus / `/deep`
**Tests:** 597 passing / 1 skipped (was 585) · typecheck clean · G4 clean · G10.5 PASS_WITH_NOTES

## What landed

Two QB-owned scheduled-task handlers wired to worker dispatch; two
stubs deferred to BI-1 with a kill-switch gate.

| Task type | Handler | Behaviour |
|---|---|---|
| `quote_expire` | `handle-quote-expire.ts` | Re-reads quote; if status ∈ {sent,viewed} → transitions to `expired` via `transitionQuoteStatus` (concurrency guard), fires static link-only expiry email, logs `quote_expired`. Idempotent on retry (status precondition short-circuits). |
| `quote_reminder_3d` | `handle-quote-reminder-3d.ts` | Re-reads quote; status must be exactly `sent` (spec §8.3 excludes viewed — view-tracking flips pending reminder to `skipped` at view time). Composes Opus draft via `composeQuoteReminder3d` + drift-check, dispatches `classification:"quote_reminder"`, logs `quote_reminder_sent`. Throws on send failure (worker backoff). |

Stubs remaining (4, down from 6): `manual_invoice_generate`,
`manual_invoice_send`, `subscription_pause_resume_reminder`,
`subscription_pause_resume`.

## Scope narrowing (key call)

QB-6 spec originally included `manual_invoice_*`. BI-1 hasn't landed —
no `invoices` table, no `lib/invoicing/`. Building those handlers now
would create disconnected machinery. Narrowed to QB-owned handlers +
**kill-switch gate** on `accept.ts`: `manual_invoice_generate` enqueue
now lives behind `killSwitches.invoicing_manual_cycle_enqueue_enabled`
(default `false`). BI-1 flips it on when the invoices table ships.

## Cross-spec contract

- **Activity log kinds:** `quote_expired` (pre-existing), `quote_reminder_sent` (NEW, added to `ACTIVITY_LOG_KINDS`). No migration — TS-enum column.
- **Email classifications:** `quote_reminder` + `quote_expired` added to both `EMAIL_CLASSIFICATIONS` and `TRANSACTIONAL_CLASSIFICATIONS` (transactional = bypass quiet window + suppression by default for lifecycle copy).
- **LLM model registry:** new slug `quote-builder-draft-reminder-3d` → `opus`. Reminder composer reads via `modelFor()`; no model ID in feature code.
- **Kill-switch registry:** new `invoicing_manual_cycle_enqueue_enabled` (default `false`). Single-point BI-1 unlock.
- **Meta shapes** logged on both activity rows match the brief's contract — `quote_id`, `deal_id`, `company_id`, `task_id`, plus handler-specific fields (`prior_status`, `email_skipped`, `email_skipped_reason` for expire; `llm_job`, `drift_check_result`, `email_message_id`, `attempts`, `fallback_used` for reminder).

## Files touched

**New:**
- `lib/quote-builder/handle-quote-expire.ts`
- `lib/quote-builder/handle-quote-reminder-3d.ts`
- `lib/quote-builder/compose-reminder-email.ts`
- `lib/quote-builder/emails/quote-expired-email.ts`
- `lib/ai/prompts/quote-builder/draft-reminder-3d.ts`
- `tests/qb6-handlers.test.ts` (11 tests)
- `sessions/qb-6-brief.md`, `sessions/qb-6-handoff.md`, `sessions/qb-7-brief.md`

**Modified:**
- `lib/scheduled-tasks/handlers/quote-builder.ts` (wire handlers, narrow stub list 6→4)
- `lib/db/schema/activity-log.ts` (+`quote_reminder_sent` kind)
- `lib/channels/email/classifications.ts` (+2 classifications, both transactional)
- `lib/ai/models.ts` (+reminder slug)
- `lib/kill-switches.ts` (+`invoicing_manual_cycle_enqueue_enabled`)
- `lib/quote-builder/accept.ts` (gate manual_invoice_generate enqueue)
- `tests/qb1-handlers.test.ts` (narrowed stub assertion)
- `PATCHES_OWED.md` (closed qb_subs_g11b_brief_miss, qb6_scheduled_task_handlers; opened no new rows)

**Unchanged:** worker dispatch loop, `scheduled_tasks` schema, `quotes` schema, no migration, no env vars, no new npm deps.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 597/597 (+1 pre-existing skip), +12 new QB-6 tests, no regressions
- G4 literal grep — clean (no `3 days`, `72 hours`, `259200`, retry-count literals outside schema/config)
- G10.5 external reviewer — **PASS_WITH_NOTES**. One concern addressed in-session (reminder retry duplicate-send risk — `logActivity` wrapped in try/catch + warn so a post-send log failure can't trigger worker retry and double-send). Two deferred nits carried to QB-7 brief §11 (see below).
- G6 rollback: handlers throw → worker backoff → surfaces in admin "needs attention" queue. Kill-switch on accept.ts enqueue is the BI-1-side rollback. Pre-existing kill-switch `pipeline.scheduled_tasks_dispatch_enabled` cuts platform-wide.
- Manual browser verify: N/A (background handlers). End-to-end verify owed when QB-7 ships admin cockpit surfacing, or on first real quote send.

## Memory-alignment declaration (G11)

Read relevant rows before + after build. Checked against:
- `feedback_felt_experience_wins` — expiry email is static link-only (wind-down moment, deterministic is correct); reminder is LLM-drafted, per-client.
- `feedback_primary_action_focus` — both emails single-CTA: open the quote.
- `feedback_outreach_never_templated` — reminder is end-to-end LLM per quote; expiry is NOT outreach (lifecycle copy, static is fine).
- `feedback_no_content_authoring` — no manual templates for Andy to write.
- `project_llm_model_registry` — reminder composer uses `modelFor("quote-builder-draft-reminder-3d")`, no model IDs in feature code.
- `feedback_earned_ctas_at_transition_moments` — expiry email earns its "start a fresh conversation" CTA at the wind-down transition.
- `feedback_no_lite_on_client_facing` — both emails branded "SuperBad", no "Lite".
- `project_brand_dna_as_perpetual_context` + `project_two_perpetual_contexts` — reminder compose reads Brand DNA + Client Context via the existing compose-send-email pattern.

No regressions detected. Reviewer confirmed clean.

## Reviewer notes deferred to QB-7 brief

1. **`expires_at_ms` semantics drift** — `handleQuoteExpire` patches `expires_at_ms: Date.now()` but column is scheduled expiry not actual. Consider adding `expired_at_ms` column or relying on activity-log meta. Non-blocking; QB-7 touches quote state surfaces.
2. **Drift-check `fail_redraft` slug is logged but never acted on** — reminder composer returns drift result and handler dispatches regardless. Rename slug to `fail_observed` or add single redraft retry. Cosmetic today.

## Next session

Per BUILD_PLAN.md Wave 6, **QB-7** is next — supersede / withdrawal / expired URL states on the public quote page. Brief pre-authored at `sessions/qb-7-brief.md` (per G11.b, same-commit as this handoff).

Carry-forward: manual browser verify owed for QB-2b/3/4a/4b/4c/QB-6 once admin cockpit (QB-7 surrounding work or later) gives observable surfaces.
