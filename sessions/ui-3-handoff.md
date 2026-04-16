# `ui-3` — Notification triage classifier (Haiku) + push vs silent gate — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (3 of 13)
**Model tier:** `/deep` (Opus — ran on Opus despite brief recommending Sonnet)

---

## What was built

Haiku-tier notification triage classifier (spec §7.2 Q10) that tags every inbound email as `urgent` / `push` / `silent`. Writes a `notifications` table row + populates `messages.notification_priority`. Wired in parallel with the UI-2 router (discipline #52) via `Promise.allSettled` — per-classifier failure cannot block message insert. Gated behind `inbox_sync_enabled` + `llm_calls_enabled`.

Actual web/PWA push transports are deferred to wave E (spec §17). UI-3 writes rows with `fired_transport = 'none'` for silent and `NULL` for push/urgent — the dispatcher picks them up when wave E lands.

**Files created:**

- `lib/db/schema/notifications.ts` — shared notifications table with `NOTIFICATION_PRIORITIES`, `NOTIFICATION_TRANSPORTS` (web_push/pwa_push/none, nullable), `NOTIFICATION_CORRECTION_ACTIONS` enums; indexes on user_id+fired_at_ms, message_id, priority+fired_at_ms
- `lib/db/migrations/0033_ui3_notifications.sql` — raw SQL with CHECK constraints on all three enum columns + FK cascade on message delete
- `lib/graph/notifier.ts` — `classifyNotificationPriority(msg, messageId, threadId)`; Zod-validated LLM output; persistence writes both `messages.notification_priority` and inserts notifications row; admin-user lookup via `role='admin'` scaffolded for discipline #58 multi-tenant; activity log `inbox_notification_fired`
- `lib/graph/notifier-prompt.ts` — `buildNotifierPrompt(ctx)` + `loadNotifierPromptContext(msg, threadId)`; loads thread context (relationship_type, is_client, ticket_status, waiting_on_andy, notification_weight) from contacts + threads join; reads recent `classification_corrections` where `classifier='notifier'` (up to 10); truncates body to 2000 chars
- `tests/graph-notifier.test.ts` — 15 tests: NotifierOutputSchema Zod parsing (5), buildNotifierPrompt context + truncation (4), notifications table insert / enum CHECK / FK cascade / correction_action update (5), kill-switch skip path (1)

**Files edited:**

- `lib/db/schema/index.ts` — re-export `notifications`
- `lib/db/migrations/meta/_journal.json` — added entry for idx 33
- `lib/graph/sync.ts` — replaced inline router-only call with `Promise.allSettled([router, notifier])`, per-index error logging
- `lib/graph/index.ts` — barrel exports for `notifier` + `notifier-prompt`
- `lib/ai/prompts/unified-inbox.md` — fleshed out `inbox-classify-notification-priority` from stub to full entry; frontmatter `populated-by` now marks UI-2 + UI-3 as DONE

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Nullable `fired_transport`** — diverges from spec §5.1 (where `fired_transport` appears required). Three-state representation: `'none'` = deliberately silent, `NULL` = queued for dispatcher (wave E), real values = fired. Rationale: UI-3 classifies but doesn't dispatch; the dispatcher owns the firing-step transition. Documented in schema doc-comment. Candidate for PATCHES_OWED if spec reconciliation is wanted.
2. **Silent-on-failure fallback** — asymmetric vs router's `new_lead` fallback. Rationale: missed urgency recoverable via morning digest; a spurious urgent push erodes trust and trains dismissal. Spec discipline #63 equivalent — conservative-side-of-asymmetry per classifier.
3. **Notifications row written from inside the classifier**, not via a future dispatcher primitive. Matches UI-2's inline router pattern. A later session will extract the dispatcher; keeping write co-located until then avoids premature abstraction.
4. **Admin user resolved via `role='admin'` query**, not environment var. Discipline #58 — scaffolded for future multi-user. If no admin row exists (pre-A8 state or test harness), the notifications row is silently skipped (the messages update still happens).
5. **Parallel wire-in uses `Promise.allSettled`**, not `Promise.all`. Either classifier rejecting must never cancel the other; both are non-fatal to message insert.
6. **Thread context loaded from contacts + threads only** — `ticket_status` and `waiting_on_andy` come off the threads row (both columns exist from A6). No join to `deals` yet; spec §7.2 lists "active retainer" as a signal but that's derivable from `relationship_type='client'` for v1.

## Verification (G0–G12)

- **G0** — brief read; ui-1 + ui-2 handoffs read; spec §§5.1, 5.2, 7.2, 10, 11, 16 (#52, #54, #63) read.
- **G1** — all 14 preconditions verified.
- **G2** — files match whitelist exactly.
- **G3** — not triggered.
- **G4** — no autonomy-sensitive literals. All priority / transport / correction-action values are structural enums from spec, not tunable thresholds.
- **G5** — N/A (FEATURE; kill-switch-gated; no state transitions visible to end users until wave E).
- **G6** — `feature-flag-gated` via `inbox_sync_enabled` + `llm_calls_enabled`.
- **G7** — all completion-contract items verified.
- **G8** — `npx tsc --noEmit` → 0 errors; `npm test` → 886 passed + 1 skipped (was 871 pre-session, +15); `npm run build` → clean. Lint: pre-existing `lite/no-direct-anthropic-import` at `notifier.ts:20` mirrors the identical pre-existing error at `router.ts:14`; not a UI-3 regression.
- **G9** — no critical flows touched.
- **G10** — N/A (FEATURE, no UI surfaces).
- **G10.5** — external reviewer verdict: **PASS WITH NOTES**. Both nice-to-haves reviewed; kill-switch skip test added (now 15 tests); fallback-path test deferred — matches UI-2 precedent (real-DB writes from mocked LLM failure would leak into dev db).
- **G11** — this file.
- **G12** — tracker update + commit next.

## G10.5 external reviewer verdict

**VERDICT: PASS WITH NOTES**

- Spec fidelity (§5.1 + §7.2): PASS — nullable `fired_transport` divergence documented with rationale; all six spec §7.2 signals present in prompt.
- Discipline #52 (parallel non-fatal): PASS — `sync.ts` uses `Promise.allSettled` + per-index error logging.
- Discipline #54 (corrections loop): PASS — `classifier='notifier'` filter + recency order + 10-cap.
- Kill switches: PASS — both honored at entry; clean skip with zero side effects.
- Fallback asymmetry: PASS — silent-on-failure rationale sound and documented.
- Model registry: PASS — `modelFor("inbox-classify-notification-priority")` at `notifier.ts:68`, no hardcoded model id.
- Test honesty: PASS (after add) — 15 real assertions; kill-switch skip test now included; fallback-path test skipped matching UI-2 precedent.
- Scope discipline: PASS — whitelist obeyed, no dispatcher primitive built, no UI work.
- Memory alignment: PASS — all silent locks appropriate.
- Regression risk: low — sync.ts dispatch change preserves router behaviour, existing tests still pass.

No must-fix items. Nice-to-have kill-switch test: **DONE** (added post-review, 15/15 notifier tests green, full suite 886/886).

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all six implementation choices (nullable fired_transport, fallback direction, inline-vs-dispatcher write placement, admin-user lookup strategy, `allSettled` vs `all`, thread-context sources) silently locked. No technical questions to Andy.
- **`project_context_safety_conventions`** — prompt contract documented in `lib/ai/prompts/unified-inbox.md`. Schema file self-contained with spec reference. Migration journal-tracked.
- **`project_llm_model_registry`** — LLM call uses `modelFor("inbox-classify-notification-priority")`, never a raw model ID.
- **`feedback_dont_undershoot_llm_capability`** — Haiku is trusted to reason about urgency from described context (relationship + ticket + waiting + weight + corrections) without labelled training data. Spec says Haiku; trust it.

## PATCHES_OWED

- **`docs/specs/unified-inbox.md` §5.1** — reconcile `fired_transport` column nullability. UI-3 implements it as nullable to represent the classified-but-not-yet-dispatched state. Wave E (dispatcher) can either (a) accept the nullable contract or (b) require a default of `'pending'` and UI-3 schema adjusts forward. Not blocking UI-4. Candidate patch entry in PATCHES_OWED.md.

## Rollback strategy

`feature-flag-gated` — kill-switch `inbox_sync_enabled` (must be ON) + `llm_calls_enabled` (must be ON) for notifier to fire. Both ship disabled. Rollback = leave switches off. Migration is additive (new table only); revert = `git revert` + drop `notifications` table (**destructive — declared explicitly here**).

## What the next session (UI-4) inherits

Next: **`ui-4`** — Signal/noise classifier (Haiku) + auto-delete cron (23:00).

- **Parallel-dispatch block in `sync.ts`** — now `Promise.allSettled([router, notifier])`. UI-4 extends it to 3-way: `[router, notifier, signalNoise]`. The `idx` / `which` naming pattern in the error logger needs a third label.
- **`classification_corrections`** — UI-4's classifier reads with `classifier = 'signal_noise'` filter (enum already includes it per UI-2).
- **Fallback convention** — UI-4's conservative side is **noise** for the signal/noise axis (false signal = noise in the inbox; false noise = deleted after 23:00 cron). Mirrors UI-3's silent-on-failure discipline.
- **`notifications` table** — UI-4 doesn't write here. It writes `messages.priority_class` + `noise_subclass` directly (columns exist from A6). Corrections land in `classification_corrections`.
- **Auto-delete cron** — scheduled-task-type needs registering in `SCHEDULED_TASK_TYPES`. 23:00 daily; reads from messages where `priority_class='noise' AND keep_until_ms IS NOT NULL AND keep_until_ms < now`.
- **Model tier**: `/normal` (Sonnet) should be fine — same classification pattern as UI-2 + UI-3. Actual Haiku invocation via `modelFor("inbox-classify-signal-noise")`.
