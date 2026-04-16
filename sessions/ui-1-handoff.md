# `ui-1` — Graph API client + M365 sync layer — Handoff

**Closed:** 2026-04-16
**Wave:** 9 — Unified Inbox (1 of 13)
**Model tier:** `/deep` (Opus)

---

## What was built

Graph API client wrapper, M365 delta sync layer, OAuth token exchange, webhook receiver, outbound send, RFC 5322 threading, and subscription renewal handler. All gated behind `inbox_sync_enabled` kill-switch (ships disabled).

**Files created:**

- `lib/graph/client.ts` — authenticated Graph API client with token refresh, subscription create/renew, credential encryption
- `lib/graph/types.ts` — Zod schemas for Graph API responses (token, message, delta, subscription, webhook notification)
- `lib/graph/normalize.ts` — normalizes Graph `Message` → `MessageInsert` shape, strips HTML, extracts RFC 5322 headers
- `lib/graph/sync.ts` — delta sync engine (paginated, idempotent on `graph_message_id`), sent items sync for Outlook-sent messages (discipline 61)
- `lib/graph/thread.ts` — RFC 5322 header threading (In-Reply-To → References → subject-similarity fallback with 30-day window)
- `lib/graph/send.ts` — outbound send via Graph API as `andy@` (via `/me/sendMail`) or `support@` (via `/users/{email}/sendMail`), records outbound message + clears cached draft
- `lib/graph/index.ts` — barrel export
- `lib/db/schema/graph-api-state.ts` — sync state table (subscription ID, delta token, import progress)
- `lib/db/migrations/0029_ui1_graph_api_state.sql` — table creation
- `lib/db/migrations/0030_ui1_inbox_settings.sql` — 3 new settings keys
- `app/api/webhooks/graph/route.ts` — Graph webhook receiver (validation token echo + notification-triggered delta sync)
- `lib/scheduled-tasks/handlers/inbox-graph-sync.ts` — standalone `runGraphSyncCycle()` for cron-triggered sync
- `lib/scheduled-tasks/handlers/inbox-graph-subscription-renew.ts` — subscription renewal handler (checks expiry buffer, renews via Graph API)
- `tests/graph-client.test.ts`, `tests/graph-normalize.test.ts`, `tests/graph-sync.test.ts`, `tests/graph-thread.test.ts`, `tests/graph-send.test.ts` — 22 new tests
- `sessions/ui-1-brief.md` — self-written brief (previous wave closer did not pre-compile it)

**Files edited:**

- `app/api/oauth/graph-api/callback/route.ts` — upgraded from skeleton to real code→token exchange + encrypted cookie handoff
- `lib/integrations/vendors/graph-api.ts` — added `Mail.ReadWrite` + `MailboxSettings.Read` to OAuth scopes
- `lib/kill-switches.ts` — added `inbox_sync_enabled` (default: false)
- `lib/db/schema/index.ts` — re-exports `graph-api-state`
- `lib/settings.ts` — added 3 inbox sync settings keys to registry
- `lib/scheduled-tasks/handlers/index.ts` — registered `INBOX_SUBSCRIPTION_RENEW_HANDLERS`
- `.env.example` — added `MS_GRAPH_CLIENT_SECRET`, updated scopes comment
- `docs/settings-registry.md` — added Unified Inbox section (3 keys), updated totals
- `tests/settings.test.ts` — updated count from 96 → 99

## Key decisions locked

1. **Credentials in `integration_connections`, sync state in `graph_api_state`.** Tokens stay in the generic integration table via vault encryption. Graph-specific state (delta tokens, subscription ID, import progress) lives in a dedicated table with proper indexes.
2. **Delta sync + sent items sync.** Inbound mail via delta queries with pagination (100-page cap). Sent items via a separate recent-50 query to catch Outlook-sent messages (spec discipline 61).
3. **Outbound routing.** `andy@` sends via `/me/sendMail`, `support@` sends via `/users/{email}/sendMail` (requires SendAs permission).
4. **Threading strategy.** Three-tier: In-Reply-To → References (reverse order) → subject-similarity fallback (30-day window, normalized subject matching). New thread created if all three fail.

## Verification (G0–G12)

- **G0** — brief self-written per G11.b mop-up rule; spec §§1,5.1,6,8,16 read; skills loaded (drizzle-orm, typescript-validation).
- **G1** — all 14 preconditions verified (files, tables, exports, env vars, settings).
- **G2** — files match whitelist. Worker.ts listed but correctly not touched (handlers/index.ts was the right edit point).
- **G3** — not triggered (medium context session, well within 70%).
- **G4** — no autonomy-sensitive literals in the diff. Sync interval, subscription TTL, and renewal buffer all use `settings.get()`.
- **G5** — N/A (INFRA, no state transitions visible to users).
- **G6** — `feature-flag-gated` via `inbox_sync_enabled` kill-switch.
- **G7** — all artefacts enumerated and verified.
- **G8** — `npx tsc --noEmit` → 0 errors; `npm test` → 854 passed / 1 skipped; `npm run build` → clean.
- **G9** — no critical flows touched.
- **G10** — N/A (INFRA, no UI surfaces).
- **G10.5** — external reviewer verdict below.
- **G11** — this file.
- **G12** — tracker updated, committed.

## G10.5 external reviewer verdict

**VERDICT: PASS_WITH_NOTES**

### Axis verdicts

- Spec fidelity: PASS_WITH_NOTES — all acceptance criteria met; one bug fixed in-session (lte→eq in subscription renew)
- Mockup fidelity: N/A — INFRA session
- Voice fidelity: N/A — no user-visible copy
- Memory alignment: PASS — all three memories honoured
- Test honesty: PASS_WITH_NOTES — normalization and threading tests are solid; sync/send tests are type-level only (acceptable while kill-switch ships disabled)
- Scope discipline: PASS_WITH_NOTES — no scope creep; one whitelist item (worker.ts) correctly not edited

### Notes logged to PATCHES_OWED

1. `ui_1_webhook_client_state_verification` — webhook route does not verify `clientState` from Graph notifications. Low risk (handler is idempotent) but should be addressed before Phase 6 launch.
2. `ui_1_sync_send_integration_tests` — `graph-sync.test.ts` and `graph-send.test.ts` test types/kill-switch but not actual sync/send logic with mocked DB/client. Should be added before kill-switch is enabled.
3. `ui_1_settings_registry_total_drift` — `docs/settings-registry.md` total says 92 but code has 99 keys. Pre-existing drift, not caused by UI-1.

### In-session fix

- **lte→eq bug** in `inbox-graph-subscription-renew.ts` line 52 — fixed immediately. `lte(graph_api_state.id, row.id)` changed to `eq(graph_api_state.id, row.id)` to prevent multi-row update on subscription renewal.
- **Dead code cleanup** — removed unused `INBOX_GRAPH_SYNC_HANDLERS` empty export from `inbox-graph-sync.ts`.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all implementation choices (credential storage pattern, delta sync approach, threading strategy, sent items sync for discipline 61) made silently. No technical questions surfaced to Andy.
- **`project_context_safety_conventions`** — new content lives in `lib/graph/` module. Settings keys registered in `docs/settings-registry.md`. Migrations versioned. Brief self-contained.
- **`project_tier_limits_protect_margin`** — N/A for this session (no tier/pricing logic).

## PATCHES_OWED opened this session

- `ui_1_brief_missing` — UI-1 brief was not pre-compiled by the Wave 9 closer (admin-polish-6). Self-written per G11.b mop-up rule.
- `ui_1_webhook_client_state_verification` — webhook route should verify `clientState` before Phase 6 launch. Non-blocking.
- `ui_1_sync_send_integration_tests` — integration tests for sync/send with mocked client. Non-blocking while kill-switch is off.
- `ui_1_settings_registry_total_drift` — pre-existing drift in settings-registry.md totals. Non-blocking.

## Rollback strategy

`feature-flag-gated` — kill-switch `inbox_sync_enabled` in `lib/kill-switches.ts`. Ships disabled. Rollback = leave the switch off. Migration is additive (new table, no destructive changes); revert = `git revert`.

## What the next session should know

Next: **`ui-2`** — Inbound router classifier (Haiku) + contact resolution + auto-create.

- `lib/graph/normalize.ts` exports `NormalizedMessage` — UI-2's classifier consumes this shape.
- `resolveThread()` in `lib/graph/thread.ts` handles threading for email channel. UI-2 adds the Q5 router classification layer on top.
- `graph_api_state.last_delta_token` is the sync cursor — delta sync runs before classifiers see messages.
- OAuth scopes expanded to `Mail.ReadWrite` + `MailboxSettings.Read` — if Azure AD app hasn't been reconsented, the wizard will re-prompt.
- `inbox_sync_enabled` ships disabled. Phase 6 enables it.
- Model tier: `/normal` (Sonnet) — UI-2 is FEATURE/medium, classifier prompt work.
