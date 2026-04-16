# `ui-4` — Signal/noise classifier (Haiku) + auto-delete cron (23:00) — Brief

**Wave:** 10 (Unified Inbox 4 of 13 — classifier + hygiene slice)
**Type:** FEATURE
**Size:** small–medium
**Model tier:** `/normal` (Sonnet) — same classification pattern as UI-2/UI-3 plus one scheduled-task handler. No architecture decisions.
**Spec:** `docs/specs/unified-inbox.md` §§5.1 (`threads.keep_until_ms`, `threads.priority_class`, message keep_until inferred per §9.1), 5.2 (`contacts.always_keep_noise`), 7.3 (Q12 signal/noise classifier), 9.1–9.3 (keep_until calc + engagement reset stub + auto-delete daily job), 11.3 (activity-log kinds), 11.4 (`inbox_hygiene_purge` task_type), 16 disciplines #52, #54, #56, #58, #63
**Precedent:** `sessions/ui-2-handoff.md` + `sessions/ui-3-handoff.md` — UI-2 locked the classifier shape (prompt + Zod + non-fatal `Promise.allSettled` wire-in); UI-3 locked the conservative-fallback asymmetry + admin-user resolution pattern.

---

## Scope — what lands in this session

1. **Schema additions on `messages`** — migration idx 34 adds two nullable columns:
   - `keep_until_ms INTEGER` — per-message purge timestamp (null = never)
   - `deleted_at_ms INTEGER` — soft-delete timestamp (null = live)
   Plus one index on `(keep_until_ms, deleted_at_ms)` scoped to live rows for the hygiene sweep.
2. **Haiku-tier signal/noise classifier** — `classifySignalNoise(msg, messageId, threadId)` in `lib/graph/signal-noise.ts`. Output `{ priority_class: 'signal'|'noise'|'spam', noise_subclass: 'transactional'|'marketing'|'automated'|'update'|null, reason }` Zod-validated. Reads `classification_corrections` where `classifier = 'signal_noise'` (up to 10) as few-shot learning signal.
3. **Prompt builder + context loader** — `lib/graph/signal-noise-prompt.ts` mirrors `notifier-prompt.ts` pattern. Loads: message body + subject + from_address; `contacts.relationship_type` + `contacts.always_keep_noise`; recent corrections. Body truncated to 2000 chars like the notifier.
4. **Per-message keep_until computation** (spec §9.1). On persist:
   - `signal` → `keep_until_ms = NULL`
   - `noise` + `transactional` → `sent_at + 180d`
   - `noise` + other subclass → `sent_at + 30d`
   - `spam` → `sent_at + 7d`
   - `contact.always_keep_noise = true` **overrides to NULL** (spec §9.1 final bullet). Thread-level `keep_pinned` override is not enforced here — no UI to set it yet, but the hygiene sweep honours it (see §9 below).
5. **Thread-level `keep_until_ms` MAX aggregation** (discipline #56). After writing `messages.keep_until_ms`, recompute `threads.keep_until_ms = MAX(messages.keep_until_ms on thread)` — and if the thread has any message with `keep_until_ms IS NULL` (= signal), the thread's `keep_until_ms` becomes `NULL` too. One signal message rescues the thread.
6. **Thread-level `priority_class` last-write-wins** — the classifier updates `threads.priority_class` to match the latest message's classification. Router's `handleSpam` already writes this column; signal/noise overwrites with its own verdict. On disagreement, signal/noise wins because it runs from its own slot in `allSettled` and both calls are idempotent in the spam-agreement case. (Router's 7-day spam `keep_until_ms` on the thread stays — MAX aggregation reconciles.)
7. **Wire into `sync.ts` in parallel** (discipline #52). Extend the existing `Promise.allSettled([router, notifier])` to 3-way `[router, notifier, signalNoise]`; extend the `which` label in the error logger to include `"signal_noise"`. Non-fatal — classifier failure cannot block message insert.
8. **Auto-delete cron handler** — `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` registers `inbox_hygiene_purge` task_type (already in `SCHEDULED_TASK_TYPES` from A6). Handler (spec §9.3):
   1. Soft-delete: set `messages.deleted_at_ms = now` where `keep_until_ms IS NOT NULL AND keep_until_ms < now AND deleted_at_ms IS NULL AND thread.keep_pinned = false`.
   2. Hard-delete: `DELETE FROM messages WHERE deleted_at_ms IS NOT NULL AND deleted_at_ms < now - 14d`. (No R2 cleanup in UI-4 — attachments R2 sweep lands with the trash-bin UI session.)
   3. Log one `inbox_hygiene_purged` `activity_log` row with `{ soft_deleted, hard_deleted }` counts.
   4. Self-perpetuate: enqueue the next `inbox_hygiene_purge` row at **next 23:00 Australia/Melbourne**.
9. **Bootstrap helper** — `ensureInboxHygieneEnqueued()` in the handler module. Idempotent; no-ops if a pending/running `inbox_hygiene_purge` row already exists. Exported so a later session (likely SW wizard completion or UI-1 integration follow-up) can call it once on Graph connection. UI-4 does NOT wire the bootstrap into instrumentation.ts or any route — leave unwired, flag in handoff.
10. **Gate on `inbox_sync_enabled`.** Handler skip-returns when off. Classifier skips when `inbox_sync_enabled || llm_calls_enabled` off (both must be on; matches UI-2/UI-3).
11. **Handler registry wire-in** — add `INBOX_HYGIENE_HANDLERS` to `lib/scheduled-tasks/handlers/index.ts`.
12. **Flesh out prompt stub** — update `lib/ai/prompts/unified-inbox.md` § `inbox-classify-signal-noise` from "stub" → "done" with implementation details (mirror UI-2/UI-3 style).
13. **Tests** — two test files:
    - `tests/graph-signal-noise.test.ts`: Zod parse (5 — happy path + noise requires subclass + spam forbids subclass + signal forbids subclass + invalid enum), prompt builder with varied context (3 — no corrections / with corrections / always_keep_noise flag present in prompt), persistence (5 — keep_until math for each of 4 subclass/class combos + always_keep_noise override to NULL), thread MAX aggregation (2 — mixed noise + signal message rescues, all-noise thread uses MAX of messages), kill-switch skip (1). Target ~16 meaningful tests.
    - `tests/inbox-hygiene-purge.test.ts`: soft-delete only when keep_until passed + thread not pinned + not already deleted (3), hard-delete after 14d in trash (1), keep_pinned thread never soft-deletes (1), activity log emitted with correct counts (1), self-re-enqueue at next 23:00 Melbourne (1), kill-switch skip (1), bootstrap idempotency — no-op when row present (1). Target ~9 meaningful tests.

## Out of scope — do NOT build

- **Trash-bin UI + restore-from-trash.** Separate UI session. UI-4 only soft-deletes + eventually hard-deletes.
- **Keep-sender 3-pin promotion** (spec §9.4). Needs thread-detail pin UI; lands with UI-8/UI-11. UI-4 **reads** `contacts.always_keep_noise` as an override but does not flip it.
- **Engagement-signal keep_until reset** (spec §9.2). Needs front-end read/reply/pin event plumbing. Later UI session will call a `recomputeThreadKeepUntil(threadId, baselineMs)` helper; for UI-4, `recomputeThreadKeepUntil()` is exported but only called from the classifier path.
- **Setup wizard step 5 bulk-purge** (spec §9.5). Later wizard-content session.
- **R2 attachment cleanup on hard-delete.** Lands with trash-bin UI / full compose surface session. UI-4's hard-delete removes rows only.
- **Morning digest (8am)** — UI-13 territory.
- **Correction-writing UI** (re-route / move-to-noise chip). UI-4 reads corrections, does not write them.
- **`thread.priority_class` override UI.** Not built. The column stays the latest-message inherit target, no per-thread override UI yet.

## Preconditions — verify before touching any code (G1)

1. `lib/graph/router.ts` + `router-prompt.ts` exist (UI-2).
2. `lib/graph/notifier.ts` + `notifier-prompt.ts` exist (UI-3).
3. `lib/graph/sync.ts` has the `Promise.allSettled([router, notifier])` block (UI-3).
4. `lib/db/schema/messages.ts` has `priority_class` + `noise_subclass` columns with enums `PRIORITY_CLASSES` + `NOISE_SUBCLASSES`.
5. `lib/db/schema/messages.ts` does NOT have `keep_until_ms` or `deleted_at_ms` on `messages` (UI-4 adds both). It DOES have `threads.keep_until_ms` + `threads.keep_pinned` (already from A6).
6. `lib/db/schema/classification-corrections.ts` exists; `classifier` enum includes `'signal_noise'` (UI-2).
7. `lib/db/schema/contacts.ts` has `always_keep_noise` + `relationship_type` columns (UI-2).
8. `lib/ai/models.ts` has job slug `"inbox-classify-signal-noise"` mapped to `"haiku"`.
9. `lib/ai/prompts/unified-inbox.md` has stub for `inbox-classify-signal-noise`.
10. `lib/ai/prompts/INDEX.md` already lists the slug.
11. `lib/db/schema/scheduled-tasks.ts` `SCHEDULED_TASK_TYPES` already includes `"inbox_hygiene_purge"` (A6).
12. `lib/db/schema/activity-log.ts` `ACTIVITY_LOG_KINDS` already includes `"inbox_hygiene_purged"` (A6).
13. `lib/scheduled-tasks/handlers/index.ts` exports a `HANDLER_REGISTRY` that spreads feature-specific handler maps (QB, invoicing, SaaS, graph-sub-renew). UI-4 adds one more spread.
14. Kill switches `inbox_sync_enabled` + `llm_calls_enabled` exist in `lib/kill-switches.ts`.
15. `logActivity()` + `enqueueTask()` helpers available.
16. `modelFor()` helper in `lib/ai/models.ts`.
17. `formatTimestamp()` or equivalent `Australia/Melbourne`-aware tz helper available for 23:00-local re-enqueue (A6 shipped `formatTimestamp(date, tz)`; the 23:00-next helper may need to be added locally to the handler — OK to inline a small UTC-offset-aware next-23:00 calculator since tz isn't DST-free in Melbourne).
18. No existing `lib/graph/signal-noise.ts` / `signal-noise-prompt.ts` / `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` (UI-4 creates them).

Halt + reroute if any 1–17 missing. Item 18 must be absent; if present, investigate rather than overwrite.

## File whitelist — what UI-4 may touch

**Create:**
- `lib/db/migrations/0034_ui4_signal_noise_keep_until.sql` (+ `meta/_journal.json` entry)
- `lib/graph/signal-noise.ts`
- `lib/graph/signal-noise-prompt.ts`
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts`
- `tests/graph-signal-noise.test.ts`
- `tests/inbox-hygiene-purge.test.ts`

**Edit:**
- `lib/db/schema/messages.ts` — add `keep_until_ms` + `deleted_at_ms` columns to `messages` (NOT threads — threads already has its own `keep_until_ms`)
- `lib/graph/sync.ts` — extend parallel dispatch to 3-way, extend `which` label
- `lib/graph/index.ts` — barrel export for `signal-noise` + `signal-noise-prompt`
- `lib/scheduled-tasks/handlers/index.ts` — spread `INBOX_HYGIENE_HANDLERS`
- `lib/ai/prompts/unified-inbox.md` — populate `inbox-classify-signal-noise` section
- `SESSION_TRACKER.md` — G12 Next Action → UI-5
- `sessions/CLOSURE_LOG.md` — prepend session summary

**Must not touch:**
- `lib/graph/router.ts` / `router-prompt.ts` / `notifier.ts` / `notifier-prompt.ts` (reference only — do NOT refactor the existing SPAM_KEEP_DAYS literal in router.ts; UI-3 precedent accepted structural constants in spec-language)
- `contacts.ts` / `threads` definition inside messages.ts (already has keep_until_ms + keep_pinned)
- `lib/settings.ts` — per UI-3 precedent, spec-language retention windows (180/30/7) + the 23:00 hour + 14-day trash retention stay as structural constants in-file. Flag as PATCHES_OWED candidate if a future reconciliation wants them converted.
- Anything under `app/lite/` (no UI in UI-4)
- `instrumentation.ts` — bootstrap helper stays unwired until a later session threads it through wizard completion.

## Settings keys consumed

None added. All retention / cadence values are spec-language structural constants, matching the precedent UI-3 set for `SPAM_KEEP_DAYS`. Values used as named `const` at module top:
- `KEEP_DAYS_NOISE_TRANSACTIONAL = 180`
- `KEEP_DAYS_NOISE_DEFAULT = 30`
- `KEEP_DAYS_SPAM = 7`
- `TRASH_RETENTION_DAYS = 14`
- `PURGE_HOUR_LOCAL = 23`
- `PURGE_TZ = "Australia/Melbourne"`

Flag in handoff: if Phase 3.5 reconciliation later decides retention/cadence values should be settings-driven, add rows to `docs/settings-registry.md` + the seed migration and refactor both router + signal/noise together. Out of scope for UI-4.

## Kill switches

- `inbox_sync_enabled` — classifier + handler both skip when off.
- `llm_calls_enabled` — classifier skips when off (handler does not call LLM; not gated on this).
No new kill switch in UI-4.

## LLM job

- `inbox-classify-signal-noise` → Haiku via `modelFor()`. Slug already registered (A6).

## Activity log kinds

- `inbox_hygiene_purged` — one row per handler run. Meta: `{ soft_deleted, hard_deleted, run_started_ms, run_ended_ms }`.
- No new kind for the classifier itself — classification is inferred from `messages.priority_class` + `messages.noise_subclass` and does not need a dedicated log kind (router uses `inbox_routed`, notifier uses `inbox_notification_fired`, signal/noise piggybacks on `inbox_routed` being the per-message verdict — but **do not** add a second log row per inbound; the spec gives no kind for signal/noise per-message and the sweep roll-up is sufficient). Confirm no new kind needed; if the reviewer disagrees, add `inbox_classified_signal_noise` but that's a secondary choice.

## Scheduled task types

- `inbox_hygiene_purge` — already registered in `SCHEDULED_TASK_TYPES`. Handler added this session.

## Fallback behaviour

LLM or Zod parse failure → default to `priority_class: 'signal'` with `reason: 'fallback — LLM/parse error'` per spec discipline #63 ("Noise classifier errs conservative — when uncertain between signal and noise, classify as signal"). Conservative side: false signal in Focus is an annoyance; false noise in trash is a broken relationship. Matches UI-3's asymmetric fallback discipline from the opposite direction. `noise_subclass = null` on fallback (not applicable for signal classification).

## Completion contract (G7)

- Typecheck clean (`npx tsc --noEmit` 0 errors).
- `npm test` green, all new tests registered.
- `npm run build` clean.
- Lint clean except the pre-existing `lite/no-direct-anthropic-import` pattern at `router.ts:14` + `notifier.ts:20` — UI-4's `signal-noise.ts` will mirror this Anthropic direct-import pattern and inherit the same pre-existing lint finding. Not a regression.
- Migration applied + present in `meta/_journal.json`.
- `messages.keep_until_ms` + `messages.deleted_at_ms` columns verified present.
- Kill-switch off (both classifier + handler) → no LLM call, no writes, no exceptions.
- `ensureInboxHygieneEnqueued()` exported and flagged unwired in handoff.

## Rollback strategy

**Feature-flag-gated + migration reversible.** Kill switch `inbox_sync_enabled` must be ON for classifier to fire; same for the hygiene handler. Both ship disabled. Rollback steps:
1. Leave switches off → classifier + cron both no-op.
2. Migration is additive (two nullable columns + one index). Revert via `git revert` + hand-drop the columns (destructive — declare explicitly in handoff).

## Memory alignment gates (G10.5 reviewer will check)

- **`feedback_technical_decisions_claude_calls`** — all implementation choices (keep_until math placement, thread-level MAX aggregation strategy, classifier fallback direction, structural-constants-vs-settings, bootstrap helper unwired, no second log kind for classification) silently locked. No technical questions to Andy.
- **`project_context_safety_conventions`** — prompt contract documented in `lib/ai/prompts/unified-inbox.md`. Schema file self-contained with spec reference. Migration journal-tracked. Bootstrap helper carries a leading doc-comment explaining it is intentionally unwired.
- **`project_llm_model_registry`** — call `modelFor("inbox-classify-signal-noise")`. Never a raw model ID.
- **`feedback_dont_undershoot_llm_capability`** — Haiku reasons about signal vs noise from described context (relationship_type + always_keep_noise + corrections + body shape) without labelled training data. Spec says Haiku; trust it.
- **`project_context_safety_conventions` (6th rule, AUTONOMY_PROTOCOL verification gate):** the brief self-declares the classifier does NOT read router output, because the classifiers run in parallel per discipline #52 — the spec's mention of router output as a signal is satisfied by the shared correction-table learning loop, not live cross-classifier input.

## What UI-5 inherits

- Extended 3-way parallel dispatch in `sync.ts` — next session (reply drafter, Opus) either extends to 4-way or hangs off a scheduled task triggered on thread insert.
- `messages.keep_until_ms` + `messages.deleted_at_ms` columns + thread-level `keep_until_ms` MAX aggregation pattern — drafter likely won't touch these directly, but any engagement-signal work in wave E will call `recomputeThreadKeepUntil(threadId, baselineMs)` exported from `signal-noise.ts`.
- `ensureInboxHygieneEnqueued()` bootstrap helper — needs wiring by a later session (SW graph-api-admin completion handler looks right).
- Fallback convention: each classifier picks the conservative side of its own asymmetry (router → new_lead, notifier → silent, signal/noise → signal).

## PATCHES_OWED additions (provisional)

1. `docs/specs/unified-inbox.md` §5.1 messages — explicitly list `keep_until_ms` (nullable) + `deleted_at_ms` (nullable) columns on messages. Currently inferred from §9.1 + §9.3 prose. Non-blocking.
2. `docs/settings-registry.md` — if reconciliation wants retention/cadence as settings keys, add the five constants UI-4 locks as in-file structural.
3. `instrumentation.ts` / SW graph-api-admin wizard completion — wire `ensureInboxHygieneEnqueued()` so hygiene starts firing once Graph sync is live.

---

## G0 kickoff ritual

1. Read this brief.
2. Read the last 2 handoff notes: `sessions/ui-3-handoff.md`, `sessions/ui-2-handoff.md`.
3. Read spec §§5.1, 5.2, 7.3, 9.1–9.3, 11.3, 11.4, 16 (#52, #54, #56, #58, #63).
4. Load skills: `drizzle-orm`, `typescript-validation`.
5. Verify preconditions 1–18 above.
6. Build order:
   1. Schema migration + messages.ts edits (verify typecheck before moving on).
   2. Prompt builder + classifier (mirror notifier).
   3. keep_until calc + thread MAX helper (export `recomputeThreadKeepUntil`).
   4. sync.ts 3-way wire-in.
   5. Hygiene handler + bootstrap helper + handler registry spread.
   6. Prompt file populate.
   7. Tests (classifier file first, then handler file).
   8. Typecheck + test + build + lint; handoff; tracker flip.
