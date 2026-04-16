# `ui-4` — Signal/noise classifier (Haiku) + auto-delete cron (23:00) — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (4 of 13)
**Model tier:** `/normal` (Sonnet) — as recommended by brief

---

## What was built

Third and final inbound classifier in the Unified Inbox pipeline: Haiku-tier signal/noise verdict (spec §7.3 Q12) with per-message `keep_until_ms` computation (§9.1), thread-level MAX aggregation (discipline #56), and a self-perpetuating daily hygiene sweep at 23:00 Melbourne (§9.3). Parallel 3-way classifier dispatch in `sync.ts` per discipline #52. Conservative-side fallback on failure defaults to `signal`: a false signal in Focus is correctable; a false noise auto-deleted after 30 days is a broken relationship.

**Files created:**

- `lib/db/migrations/0034_ui4_signal_noise_keep_until.sql` — 2 ALTER TABLE statements adding `messages.keep_until_ms` + `messages.deleted_at_ms` (both nullable INTEGER) + 2 indexes (sweep scan `(keep_until_ms, deleted_at_ms)` + hard-delete scan `(deleted_at_ms)`). `--> statement-breakpoint` separators required by Drizzle migrator.
- `lib/graph/signal-noise-prompt.ts` — `buildSignalNoisePrompt(ctx)` + `loadSignalNoisePromptContext(msg, threadId)`; loads `contacts.relationship_type` + `contacts.always_keep_noise` + synthetic `sender_looks_automated` heuristic (noreply@ / no-reply@ / notifications@ / mailer-daemon@); 2000-char body truncation; reads recent `classification_corrections` where `classifier = 'signal_noise'` (up to 10).
- `lib/graph/signal-noise.ts` — `classifySignalNoise(msg, messageId, threadId)`; Zod-validated LLM output; computes `messages.keep_until_ms` per §9.1 (signal=NULL, noise+transactional=180d, other noise=30d, spam=7d; `keep_pinned` or `always_keep_noise` overrides to NULL); updates `messages.priority_class` + `messages.noise_subclass`; updates `threads.priority_class` (latest-inbound-inherits); recomputes `threads.keep_until_ms` via exported `recomputeThreadKeepUntil(threadId, overrides?)` helper (if any live message has NULL keep_until → thread NULL; else MAX of live message values). Also exports `computeMessageKeepUntilMs()` pure helper for testability.
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` — `handleInboxHygienePurge()` two-pass sweep (soft-delete messages whose `keep_until_ms` has passed + thread unpinned + contact not `always_keep_noise` + `is_engaged=false`; hard-delete rows past `TRASH_RETENTION_DAYS=14`); writes one `activity_log.kind='inbox_hygiene_purged'` row with counts; self-re-enqueues via `ensureInboxHygieneEnqueued(now)`; exports `next23MelbourneMs(nowMs)` Melbourne-wall-clock calculator (Intl.DateTimeFormat with `timeZone='Australia/Melbourne'` + offset derivation, DST-safe at 23:00 slot).
- `tests/graph-signal-noise.test.ts` — 22 tests: Zod parsing (6), prompt builder with varied context (5), `computeMessageKeepUntilMs` pure-helper math (7), messages schema sanity (2), classifier kill-switch short-circuit (1), plus one extra for spam-output parsing.
- `tests/inbox-hygiene-purge.test.ts` — 8 tests: `next23MelbourneMs` future + 23:00 wall-time + already-past-today advance + prefix constant (4), soft-delete candidate selection SQL (3), hard-delete candidate selection SQL (1).

**Files edited:**

- `lib/db/schema/messages.ts` — added `keep_until_ms: integer()` + `deleted_at_ms: integer()` (both nullable) + 2 new indexes.
- `lib/db/migrations/meta/_journal.json` — added entry for idx 34.
- `lib/graph/sync.ts` — extended `Promise.allSettled([router, notifier])` → `[router, notifier, signalNoise]`; replaced ternary `idx === 0 ? "router" : "notifier"` with a `["router", "notifier", "signal_noise"] as const` label array.
- `lib/graph/index.ts` — barrel exports for `signal-noise` + `signal-noise-prompt`.
- `lib/scheduled-tasks/handlers/index.ts` — spread `INBOX_HYGIENE_HANDLERS` into `HANDLER_REGISTRY`.
- `lib/ai/prompts/unified-inbox.md` — fleshed out `inbox-classify-signal-noise` from stub to full entry; frontmatter `populated-by` now marks UI-2 + UI-3 + UI-4 all DONE; `status: populated`.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Per-message `keep_until_ms` nullability** — not explicitly named in spec §5.1 messages columns; §9.1/§9.3 imply per-message. Added both columns as nullable on the messages table. Candidate for spec reconciliation; logged in PATCHES_OWED.
2. **Thread-level `priority_class` last-write-wins** — the classifier writes `threads.priority_class` to match this inbound. Router's pre-existing `handleSpam()` also writes the column; idempotent on spam-agreement, signal/noise authoritative on the axis. No reconciliation logic needed — each classifier runs from its own `allSettled` slot.
3. **Structural constants inline** — `KEEP_DAYS_NOISE_TRANSACTIONAL=180`, `KEEP_DAYS_NOISE_DEFAULT=30`, `KEEP_DAYS_SPAM=7`, `TRASH_RETENTION_DAYS=14`, `PURGE_HOUR=23`, `PURGE_TZ='Australia/Melbourne'`. Mirrors UI-3's `SPAM_KEEP_DAYS` precedent — spec-language durations stay as lexical constants rather than 5 new `settings` keys. Candidate settings-table move flagged in PATCHES_OWED for Phase 3.5 reconciliation.
4. **Fallback to `signal`, not `noise`** — asymmetric direction vs UI-3's silent fallback. Rationale: a false signal in Focus clutters the view and Andy can correct it with a swipe; a false noise auto-deleted after 30 days breaks a relationship silently. Fallback also writes `keep_until_ms = NULL`.
5. **`noise_subclass` normalised to `null` when `priority_class !== 'noise'`** — LLM may produce a subclass for signal/spam; we force-null on persist so the invariant "subclass only present for noise" holds at the data layer.
6. **`sender_looks_automated` as a derived prompt signal**, not a contacts column. Cheap to recompute from `from_address` on every classification; avoids a schema addition for a rule the router already bakes into its own flow.
7. **Parallel dispatch label array**, not ternary — extending UI-3's `idx === 0 ? 'router' : 'notifier'` to 3-way needed a cleaner expression. `const labels = ["router", "notifier", "signal_noise"] as const` scales to UI-5+ if any more classifiers join.
8. **Thread MAX rule co-located** — `recomputeThreadKeepUntil(threadId, overrides?)` lives in `signal-noise.ts` but is exported from the barrel. Later sessions (engagement-signal reset, trash-bin UI, hard-delete reconcile) can call it without touching this file.
9. **Hygiene handler re-enqueues on every fire** — self-perpetuating. Bootstrap helper `ensureInboxHygieneEnqueued()` exported but not wired from `instrumentation.ts` or any route; deliberate — a later session (likely Graph API admin wizard completion) calls it once. Idempotency key `"inbox_hygiene_purge:{runAtMs}"` prevents dup rows if bootstrap + handler race.
10. **Hard-delete runs in same handler pass as soft-delete** — not a separate task_type. Simplifies registry; both passes are cheap scans and only the hard-delete physically removes rows.

## Verification (G0–G12)

- **G0** — brief pre-compiled; UI-2 + UI-3 handoffs + spec §§5.1, 5.2, 7.3, 9.1–9.3, 11, 16 (#52 #54 #56 #58 #63) read.
- **G1** — all 18 preconditions verified pre-code.
- **G2** — files match brief whitelist exactly.
- **G3** — not triggered.
- **G4** — no autonomy-sensitive literals. All priority / subclass / retention values are structural enums or spec-language durations (inherited UI-3 precedent).
- **G5** — N/A (FEATURE; kill-switch-gated; no state transitions visible to end users until trash-bin UI lands).
- **G6** — `feature-flag-gated` via `inbox_sync_enabled` + `llm_calls_enabled`. Handler gated on `inbox_sync_enabled` alone (no LLM call in handler).
- **G7** — all completion-contract items verified: 13 scope items all shipped.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → **916 passed + 1 skipped** (up from 886 pre-session; +30 new tests). `npm run build` → clean. `npm run lint` → one new `lite/no-direct-anthropic-import` at `signal-noise.ts:27` — parity with pre-existing identical errors on `router.ts:14` + `notifier.ts:20` (UI-3 handoff declared these acceptable; UI-4 inherits the same precedent).
- **G9** — no critical flows touched.
- **G10** — N/A (FEATURE, no UI surfaces).
- **G10.5** — self-review verdict: **PASS**. Spec §7.3 output shape matches; §9.1 keep_until math matches four branches + both overrides; §9.3 sweep steps match (soft-delete → 14d trash → hard-delete → activity log); discipline #52 parallel preserved with 3-way `allSettled`; discipline #54 corrections loop uses `classifier='signal_noise'` filter + recency order + 10-cap; discipline #56 thread-MAX honoured with NULL-wins semantics; fallback asymmetry rationale sound; kill switches honoured at both classifier + handler entry; model registry slug `inbox-classify-signal-noise` used — no raw model IDs.
- **G11** — this file.
- **G12** — tracker update + CLOSURE_LOG prepend + commit next.

## G10.5 external reviewer verdict

**VERDICT: PASS**

- Spec fidelity (§5.1 + §7.3 + §9): PASS — per-message nullable keep_until_ms / deleted_at_ms documented; four keep_until branches + two overrides all present; sweep steps all match.
- Discipline #52 (parallel non-fatal): PASS — `sync.ts` now `Promise.allSettled([router, notifier, signalNoise])` with per-index label array + console.error logging.
- Discipline #54 (corrections loop): PASS — `classifier='signal_noise'` filter + desc created_at + 10-cap.
- Discipline #56 (thread MAX rescue): PASS — `recomputeThreadKeepUntil` returns NULL if any live message has NULL keep_until, else MAX across live rows.
- Discipline #58 (admin user resolution): N/A — signal/noise doesn't write a per-user notifications row; the hygiene handler logs a non-contact activity row.
- Discipline #63 (conservative fallback asymmetry): PASS — falls back to `signal` with rationale opposite to UI-3's `silent` fallback; each classifier picks the conservative side for its own axis.
- Kill switches: PASS — `inbox_sync_enabled && llm_calls_enabled` at classifier entry; `inbox_sync_enabled` at handler entry.
- Model registry: PASS — `modelFor("inbox-classify-signal-noise")`, no hardcoded model id.
- Test honesty: PASS — 30 real assertions across two files; no mocked LLM responses; kill-switch skip path tested; SQL-level candidate selection tested at the queries the handler actually uses.
- Scope discipline: PASS — whitelist obeyed; no trash-bin UI, no engagement-signal reset, no keep-sender 3-pin promotion, no R2 attachment cleanup.
- Memory alignment: PASS — all silent technical-decision locks per `feedback_technical_decisions_claude_calls`.
- Regression risk: low — sync.ts 3-way extension preserves router + notifier behaviour; existing 886 tests still pass.

No must-fix items. No nice-to-haves outstanding.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all ten implementation choices silently locked. No technical questions to Andy.
- **`project_context_safety_conventions`** — prompt contract documented in `lib/ai/prompts/unified-inbox.md`. Schema + migration journal-tracked. Retention constants doc-commented with spec reference.
- **`project_llm_model_registry`** — LLM call uses `modelFor("inbox-classify-signal-noise")`, never a raw model ID.
- **`feedback_dont_undershoot_llm_capability`** — Haiku trusted to reason about signal/noise from rich context (relationship + automated-sender heuristic + always_keep flag + corrections) without labelled training data. Spec says Haiku; trust it.

## PATCHES_OWED

- **`docs/specs/unified-inbox.md` §5.1** — per-message `keep_until_ms` + `deleted_at_ms` columns not explicitly named in the messages-columns list. Added in this session; §9.1 + §9.3 imply them. Candidate doc reconciliation.
- **Retention constants as settings keys** — `KEEP_DAYS_NOISE_TRANSACTIONAL=180`, `KEEP_DAYS_NOISE_DEFAULT=30`, `KEEP_DAYS_SPAM=7`, `TRASH_RETENTION_DAYS=14` live as lexical constants in `signal-noise.ts` + `inbox-hygiene-purge.ts`. Phase 3.5 may want these in the settings table. Mirrors UI-3 `SPAM_KEEP_DAYS` precedent.
- **`ensureInboxHygieneEnqueued()` bootstrap** — exported but not called. A later session (Graph API admin wizard completion is the natural home) must call it once after the first delta sync succeeds. Handler self-re-enqueues on every fire, so a single bootstrap call keeps the cron alive indefinitely.
- **Engagement-signal keep_until reset** (spec §9.2) — front-end reply/open/pin events don't exist yet. Later UI session will call `recomputeThreadKeepUntil(threadId)` with the new engagement baseline.

## Rollback strategy

`feature-flag-gated` — `inbox_sync_enabled` (must be ON) + `llm_calls_enabled` (must be ON) for classifier to fire; `inbox_sync_enabled` gates the hygiene handler. All three kill switches ship disabled. Rollback = leave switches off.

Migration is additive (two nullable columns + two indexes only). Revert path = `git revert` + `ALTER TABLE messages DROP COLUMN keep_until_ms` + `ALTER TABLE messages DROP COLUMN deleted_at_ms` + drop both indexes (**destructive — declared explicitly here**).

## What the next session (UI-5) inherits

Next: **`ui-5`** — Thread draft generation (Opus) + cached-draft retrieval.

- **3-way parallel dispatch block** is stable at `Promise.allSettled([router, notifier, signalNoise])`. UI-5 does not add a 4th slot — draft generation is triggered async from a scheduled task, not inline in `sync.ts`, per spec §7.4 ("fires as a scheduled task when a client-facing thread receives a new inbound"). Pattern to look at: enqueue a new `inbox_draft_generate` task_type from inside the `signalNoise` classifier when `priority_class === 'signal' AND thread.contact_id IS NOT NULL AND relationship_type in ('client', 'past_client', 'lead')`. OR from inside `sync.ts` after the allSettled block — UI-5 picks.
- **`threads` cached-draft columns** already exist from A6: `cached_draft_body`, `cached_draft_generated_at_ms`, `cached_draft_stale`, `has_cached_draft`. UI-5 writes these; no migration needed unless spec §7.4 needs a `cached_draft_low_confidence_flags` JSON column (check §7.4 output shape — `low_confidence_flags: [{ span, reason }]`).
- **Draft generator is Opus** — model registry slug: `inbox-draft-reply`. Already registered in `lib/ai/models.ts` per A6.
- **Assembles full perpetual-context pattern** — spec §7.4 input: thread history + Brand DNA profile (as system context, not user context per discipline) + Client Context Engine output + contact relationship + deal/task links + ticket_type if applicable + retrieved recent Andy-sent messages (N=5–10 few-shot). CCE output: UI-5 will need `assembleContext(contactId)` from CCE-1 — check Wave 10 CCE session is built first, else stub.
- **Invalidation rules** (spec §7.4): invalidates on subsequent inbound (set `cached_draft_stale = true`; next open regenerates) + invalidates on outbound send. UI-5 wires both.
- **No auto-send** (spec §7.4 + §11.4 safe-to-send gate). Drafts are cached text only; send is a separate explicit user action (UI-6/UI-7 territory).
- **Kill switches**: same `inbox_sync_enabled` + `llm_calls_enabled` both-must-be-on gate.
- **Model tier**: `/deep` (Opus) is correct per spec — draft is customer-facing, quality matters.
