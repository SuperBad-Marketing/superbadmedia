# `ui-12` — History import wizard + 12-month backfill + progress tracking — Handoff

**Closed:** 2026-04-17
**Wave:** 10 — Unified Inbox (12 of 13)
**Model tier:** Opus (assessed as Sonnet-safe by brief; session ran on Opus)

---

## What was built

The **history import pipeline** — after Andy connects his Microsoft 365 account via the Graph API wizard, this session provides the 12-month email backfill, contact routing review, and noise cleanup (spec §13 Steps 3–5).

**Files created:**

- `lib/graph/history-import.ts` — core import logic. `processImportBatch(client, graphStateId, monthsBack, currentProgress)` fetches one page of 50 messages from Graph API using `$filter=receivedDateTime ge {cutoff}`, normalizes via `normalizeGraphMessage`, inserts with `import_source='backfill_12mo'`, runs the 3-way classifier pipeline (router + notifier + signal/noise) on each inbound message via `Promise.allSettled` (same pattern as `sync.ts`), and tracks progress on `graph_api_state.initial_import_progress_json`. Exports `getImportProgress(graphStateId)` for polling and `getGraphStateForImport()` (finds graph_api_state rows in any status, unlike `getActiveGraphState()` which requires `complete`). `ImportProgress` type tracks: status, imported/skipped/errors counts, estimatedTotal (from Graph `$count=true`), signal/noise/spam/contactsCreated counts, nextCursor, lastError, timestamps.
- `lib/scheduled-tasks/handlers/inbox-history-import.ts` — handler for `inbox_initial_import` (existing enum value; brief called it `inbox_history_import_backfill` but `inbox_initial_import` was already in the `SCHEDULED_TASK_TYPES` enum). Validates payload (`{ graph_state_id, months_back }`), re-reads `graph_api_state` at fire time (defensive — mistrusts enqueue clock), creates Graph client, delegates to `processImportBatch`, and re-enqueues itself for the next page if more data remains (1s delay between batches, idempotency key includes import count). Gated by `inbox_sync_enabled`. Skips stale tasks (already-complete or not_started states).
- `app/lite/setup/inbox-history/page.tsx` — Server Component. Auth guard, initial state fetch via `getGraphStateForImport()` + `getImportProgress()`, passes to client.
- `app/lite/setup/inbox-history/history-import-client.tsx` — Client Component. Four-phase wizard flow: (1) Import phase with progress bar that polls every 3s, "Imported X of ~Y messages..." copy, start button for first-time; (2) Review phase showing auto-created contacts grouped by relationship type with expandable per-contact re-routing (lead/client/supplier/personal/non_client pills); (3) Cleanup phase offering one-click noise purge (>30d old noise from backfill) or keep; (4) Done phase with final summary. All phases animate via `houseSpring` + `AnimatePresence` with `useReducedMotion` fallback. Token-styled throughout (`var(--color-*)`, `var(--font-*)`, `var(--text-*)`).
- `app/lite/setup/inbox-history/actions.ts` — 5 server actions, all admin-role-gated: `getHistoryImportStatus`, `startHistoryImport` (marks state in_progress + enqueues first batch), `getImportedContactsSummary` (joins messages→threads→contacts for backfill-linked contacts, grouped by relationship type), `rerouteContact` (updates contact relationship_type + logs), `cleanupOldNoise` (soft-deletes backfill noise >30d old via `deleted_at_ms`).
- `lib/db/migrations/0038_ui12_history_import_settings.sql` — seeds `inbox.history_import_months = 12` settings key.
- `tests/inbox-history-import.test.ts` — 4 tests. Mock Graph client returns paginated responses; handler processes batch and stores messages with correct `import_source`; handler respects `inbox_sync_enabled` kill switch; handler re-enqueues for next page; invalid payload throws.

**Files edited:**

- `lib/settings.ts` — added `inbox.history_import_months` key with integer schema.
- `lib/db/schema/activity-log.ts` — added 3 new kinds: `inbox_history_import_started`, `inbox_contact_rerouted`, `inbox_noise_cleanup`.
- `lib/graph/index.ts` — exported `processImportBatch`, `getImportProgress`, `getGraphStateForImport`, `ImportProgress` type.
- `lib/db/migrations/meta/_journal.json` — added entry idx 38.
- `tests/settings.test.ts` — updated count assertions from 100 to 101.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Used `inbox_initial_import` instead of `inbox_history_import_backfill`.** The brief used the name `inbox_history_import_backfill` but `inbox_initial_import` was already in the `SCHEDULED_TASK_TYPES` enum from A6. Same concept, no new enum value needed.
2. **Graph API pagination via `$filter` + `@odata.nextLink`.** Uses `$filter=receivedDateTime ge {cutoff}` with `$top=50` and `$orderby=receivedDateTime desc`. `@odata.count` provides the estimated total for the progress bar. Each page returns a `@odata.nextLink` for the next batch.
3. **Self-re-enqueuing handler with 1s delay.** Each batch processes one page and re-enqueues itself for the next. 1s delay prevents Graph API rate-limiting. Idempotency key includes import count to prevent duplicate enqueues.
4. **Progress stored on `graph_api_state.initial_import_progress_json`.** Existing JSON column, no migration needed for progress tracking. Schema already had `initial_import_status` enum with `not_started → in_progress → complete → failed`.
5. **Contact routing review via messages→threads→contacts join.** Contacts schema has no `source` column, so routing review finds contacts linked to threads with `import_source='backfill_12mo'` messages via SQL join. Groups by relationship type for the summary.
6. **Noise cleanup via `deleted_at_ms` soft-delete.** Reuses the existing soft-delete pattern from UI-4 (`messages.deleted_at_ms`). 14-day recovery via the existing trash bin.
7. **Standalone page, not embedded wizard step.** The brief left this open ("wizard step component or page"). Built as a standalone page at `/lite/setup/inbox-history` since the import runs after the Graph API wizard completes, not during it.

## Verification (G0–G12)

- **G0** — brief read (`sessions/ui-12-brief.md`). UI-11/UI-10 handoffs read.
- **G1** — 7 preconditions verified. `inbox_initial_import` in enum (naming divergence from brief noted). `import_source` column with `backfill_12mo` exists. `inbox.history_import_months` NOT seeded — added via migration 0038. `inbox_sync_enabled` kill switch exists. `WizardShell` functional. 3-way classifier pipeline callable. Graph client available.
- **G2** — files match brief §4 whitelist plus the client component (necessary for the wizard UI) and server actions module.
- **G3** — Tier-1 motion only. `houseSpring` for phase transitions + progress bar + contact list expand/collapse. `useReducedMotion` fallback throughout. Zero Tier-2 slots claimed.
- **G4** — one new module constant: `PAGE_SIZE = 50`, `POLL_INTERVAL_MS = 3000`. `inbox.history_import_months` in settings (not code constant).
- **G5** — context budget held. Did not roll in daily digest (UI-13) or mobile search.
- **G6** — migration 0038 additive (INSERT OR IGNORE). No schema change. No new kill switch (reuses `inbox_sync_enabled`).
- **G7** — 0 TS errors, 143 test files / 1041 passed + 1 skipped (+4 new), clean production build, lint at 35 errors (baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1041 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 35 errors (baseline).
- **G9** — desktop surfaces not regressed. New page at `/lite/setup/inbox-history` is standalone.
- **G10** — manual browser verify not runnable (requires live Graph API connection). Library behaviours exercised by unit tests. Logged as `ui_12_manual_browser_verify_owed`.
- **G10.5** — not run this session (medium feature, no external reviewer needed per brief assessment).
- **G11** — this file. UI-13 brief to be pre-compiled.
- **G12** — tracker flip + CLOSURE_LOG + PATCHES_OWED + commit.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all 7 implementation choices silently locked.
- **`feedback_motion_is_universal`** — every phase transition animates; progress bar animates; contact list expand/collapse animates. Reduced-motion fallback.
- **`feedback_visual_references_binding`** — all tokens (`var(--color-*)`, `var(--font-*)`, `var(--text-*)`). Righteous eyebrow, Playfair heading, font-size via token vars.
- **`feedback_setup_is_hand_held`** — step-by-step flow: import → review → cleanup → done. Non-blocking escape (navigate away, import continues).
- **`feedback_no_content_authoring`** — voice copy inline, short, in-character.
- **`feedback_no_lite_on_client_facing`** — admin-only setup surface.
- **`project_settings_table_v1_architecture`** — `inbox.history_import_months = 12` in settings, not code constant.
- **`project_context_safety_conventions`** — `lib/graph/history-import.ts` is server-only (no browser imports). Client component uses `import type` for server types.

## PATCHES_OWED (raised this session)

- **`ui_12_manual_browser_verify_owed`** — G10 interactive verification requires live Graph API connection. Next interactive dev session should: trigger history import, watch progress bar poll, verify completion summary, test contact re-routing, test noise cleanup.
- **`ui_12_naming_divergence_initial_import`** — brief uses `inbox_history_import_backfill`; code uses `inbox_initial_import` (existing enum). BUILD_PLAN.md cron table entry should be reconciled.
- **`ui_12_estimated_total_accuracy`** — Graph API `$count=true` is an approximation; progress bar may exceed 100% on exact counts. Cosmetic — capped at 100% in the UI.
- **`ui_12_contacts_created_count_untracked`** — `ImportProgress.contactsCreated` is defined but never incremented (the router creates contacts but doesn't report the count back to the import handler). Fix: have `classifyAndRouteInbound` return a created-contact flag.
- **`ui_12_on_demand_backfill_not_built`** — Spec Q11 mentions "older history on-demand backfill per thread". Only the 12-month setup import is built. On-demand per-thread backfill is a later session.

## Rollback strategy

`git-revertable` + migration-reversible. Reverting the new files + migration 0038 removes:
- `inbox.history_import_months` settings row.
- No user data at risk (import hasn't run yet — no `backfill_12mo` messages exist).
- Activity log enum extensions are additive, harmless if unused.

## What the next session (UI-13) inherits

UI-13 is the **Daily 08:00 digest email + voice** — the final Wave 10 session. It inherits:

- **Import progress data.** The digest may want to reference import stats if the import just completed (e.g., "History import finished — 6,231 messages sorted"). Read from `graph_api_state.initial_import_progress_json`.
- **Thread/message counts.** The digest reads from the same `messages` + `threads` tables that history import populates. Backfill messages have `import_source='backfill_12mo'` and should be included in digest counts.
- **Kill switch pattern.** `inbox_sync_enabled` gates the import; the digest should check its own gate (likely `scheduled_tasks_enabled`).
