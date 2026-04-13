# A6 — activity_log + scheduled_tasks + formatTimestamp + LLM model registry + external_call_log + messages/threads schema — Handoff

**Date:** 2026-04-14
**Wave:** 1 — Foundation A
**Model:** `/normal` (Sonnet, per brief)
**Brief:** `sessions/a6-brief.md`
**Rollback:** **migration reversible** — `drizzle-kit drop` against `0002_a6_activity_scheduled_inbox.sql`, then `git revert`.

---

## What got built

- **`activity_log` table** (`lib/db/schema/activity-log.ts`) + `ACTIVITY_LOG_KINDS` const array — **217 consolidated kinds** across 20 spec blocks, lifted verbatim from `docs/specs/sales-pipeline.md` §4.1. Indexes on `(company_id, created_at_ms)`, `(contact_id, created_at_ms)`, `(deal_id, created_at_ms)`, `(kind, created_at_ms)`.
- **`logActivity()`** helper at `lib/activity-log.ts` — typed against `ActivityLogKind`, insert-returning, autofills `created_at_ms` + `id` (UUID).
- **`scheduled_tasks` table** (`lib/db/schema/scheduled-tasks.ts`) + `SCHEDULED_TASK_TYPES` const array — **37 consolidated task types** across 10 spec blocks, lifted from `docs/specs/quote-builder.md` §5.4. Plus sibling `worker_heartbeats` table (per §5.5). `status` defaults to `pending`, `attempts` to `0`, `idempotency_key` is UNIQUE.
- **`enqueueTask()`** at `lib/scheduled-tasks/enqueue.ts` — idempotency-key-aware (`onConflictDoNothing`), returns `null` on duplicate.
- **`tick()` + `startWorker()`** at `lib/scheduled-tasks/worker.ts` — gated on `killSwitches.scheduled_tasks_enabled`. When on: reclaims stale `running` rows >15 min, claims pending-and-due rows in batches of 50, dispatches via `HandlerMap<ScheduledTaskType, TaskHandler>`, retries with exponential backoff (5 min × 6^attempts), marks `failed` at ≥3 attempts. When off: writes heartbeat only, processes zero. `startWorker()` schedules `tick` via `setInterval` at 60s default.
- **`external_call_log` table** (`lib/db/schema/external-call-log.ts`) — Cost Observatory's primary ledger per `docs/specs/cost-usage-observatory.md` §4.1. `actor_type` union + `units` (JSON) + `estimated_cost_aud` (REAL) + three composite indexes.
- **`threads` + `messages` tables** (`lib/db/schema/messages.ts`) — Unified Inbox producer-slice per §5.1. Full column shape including routing/priority/engagement/import-source metadata; `messages.thread_id` FK cascades on thread delete. Downstream tables (`message_attachments`, `notifications`, `classification_corrections`, `graph_api_state`) deferred to the Wave 9 Unified Inbox UI slice.
- **`formatTimestamp(date, tz, options?)`** at `lib/format-timestamp.ts` — 5 formats (`datetime` / `date` / `time` / `relative` / `iso`), default tz `Australia/Melbourne`, honours arbitrary IANA tz. UTC epoch-ms storage; display-only formatter per FOUNDATIONS §11.3.
- **LLM model registry** at `lib/ai/models.ts` — `MODELS` maps every `lib/ai/prompts/INDEX.md` slug (53 entries) to a tier (`opus` / `sonnet` / `haiku`). `modelFor(slug)` resolves to the current model ID; swapping the whole platform off a tier is a one-line edit. `MODEL_IDS` pinned to Claude 4.6 family (`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`).
- **Drizzle migration** `lib/db/migrations/0002_a6_activity_scheduled_inbox.sql` + journal entry (`idx: 2`, tag `0002_a6_activity_scheduled_inbox`, snapshot `0002_snapshot.json`). Generated via `npx drizzle-kit generate`, then renumbered 0001→0002 per brief (A5 convention: 0000 = journal schema, 0001 = seed, A6 starts journal at 0002).

## Key decisions locked (silently per `feedback_technical_decisions_claude_calls`)

1. **`activity_log.kind` consolidated source was NOT missing** — A5's handoff (PATCHES_OWED row `a5_activity_log_enum_source_missing`) was inaccurate. Phase 3.5 step 2a produced the consolidation directly inside `docs/specs/sales-pipeline.md` §4.1 (the owner file for `activity_log`). 217 values total across 20 spec blocks. A6 lifted verbatim. The A5 PATCHES_OWED row is now resolved — clarification filed here.
2. **`task_type` enum is 37 values, not 31** — brief was stale. Current reality (per `docs/specs/quote-builder.md` §5.4): Quote Builder 6 + Branded Invoicing 1 + Client Context 2 + Content Engine 6 + Client Management 2 + Daily Cockpit 1 + Unified Inbox 5 + SaaS 3 + Observatory 5 + Finance 6 = **37**. Seeded as locked — the brief's "31" was a count from before Phase 3.5 step 2a's final mop-up adds.
3. **`activity_log` + `messages` FKs to `companies` / `contacts` / `deals` land as plain `text` (not FK-constrained) in A6.** Those tables ship in a later Sales Pipeline wave; enforcing the FK now would require building them here too, which the A6 whitelist forbids. PATCHES_OWED row logs the deferred FK wiring.
4. **`*_at` columns are `integer` epoch-ms (not Drizzle's `timestamp` mode), named with `_ms` suffix.** Consistent with A5's `user.created_at_ms` + `user.first_signed_in_at_ms`. Avoids coercion surprises between SQLite-text/Drizzle-Date round-tripping and keeps `formatTimestamp(ms, tz)` the single display path per FOUNDATIONS §11.3.
5. **`scheduled_tasks` worker parameters (`STALE_RUNNING_MS = 15min`, `MAX_ATTEMPTS = 3`, `BASE_BACKOFF_MS = 5min`, `BATCH_SIZE = 50`) live as named constants in `lib/scheduled-tasks/worker.ts`, not in `settings`.** Brief explicitly states "Settings keys: none" + "Seeds (new): none". These are spec-locked primitives (quote-builder.md §8.2), analogous to A4's motion tokens. PATCHES_OWED row notes a potential Wave 23 Settings Audit migration if Andy ever wants runtime tuning, but v1.0 ships them as code.
6. **Seed-file numbering unchanged.** A5's `0001_seed_settings.sql` is still `0001_*` — it's untracked by the Drizzle journal (`runSeeds()` reads `meta/_journal.json` and only applies files whose filename is NOT a journal tag). A6's schema migration is `0002_*` (journal tag). No collision, no rename needed.
7. **Howler / node-cron / bullmq all avoided.** Worker is a plain `setInterval` over a DB poll — simplest thing that could work for single-process SQLite. bullmq + Redis belongs to a hypothetical v2 multi-worker deploy; not needed for SuperBad's single-Vercel-instance model.
8. **Job slugs match `lib/ai/prompts/INDEX.md` exactly.** 53 slugs, each mapped to a tier. `tests/llm-models.test.ts` regex-extracts slugs from INDEX.md at test time and asserts each is present in `MODELS` — the test is the contract.

## Artefacts produced (G7 verification)

Files created:
- `lib/db/schema/activity-log.ts` (+ `ACTIVITY_LOG_KINDS` export, 217 values)
- `lib/db/schema/scheduled-tasks.ts` (+ `SCHEDULED_TASK_TYPES` × 37, `SCHEDULED_TASK_STATUSES`, `worker_heartbeats` table)
- `lib/db/schema/external-call-log.ts` (+ `EXTERNAL_CALL_ACTOR_TYPES`)
- `lib/db/schema/messages.ts` (threads + messages + shared enum consts `MESSAGE_CHANNELS` / `PRIORITY_CLASSES` / etc.)
- `lib/activity-log.ts` (`logActivity()`)
- `lib/format-timestamp.ts` (`formatTimestamp()` + `DEFAULT_TIMEZONE`)
- `lib/ai/models.ts` (`MODELS`, `MODEL_IDS`, `modelFor()`, `modelTierFor()`)
- `lib/scheduled-tasks/enqueue.ts` (`enqueueTask()`)
- `lib/scheduled-tasks/worker.ts` (`tick()`, `startWorker()`, `HandlerMap`)
- `lib/db/migrations/0002_a6_activity_scheduled_inbox.sql`
- `lib/db/migrations/meta/0002_snapshot.json`
- `tests/activity-log.test.ts` (3 tests)
- `tests/scheduled-tasks.test.ts` (7 tests)
- `tests/format-timestamp.test.ts` (8 tests)
- `tests/llm-models.test.ts` (5 tests)
- `tests/messages-schema.test.ts` (3 tests)

Files edited:
- `lib/db/schema/index.ts` (barrel re-exports all 4 new schema files)
- `lib/db/migrations/meta/_journal.json` (idx 1 → idx 2, tag 0001→0002)

Tables created: `activity_log`, `scheduled_tasks`, `worker_heartbeats`, `external_call_log`, `threads`, `messages`.
Migrations: `0002_a6_activity_scheduled_inbox.sql` (schema-only, no seed data).
Settings rows added: none (per brief).
Dependencies added: none (no new npm installs).

## Verification gates

- **G4 literal-grep:** only autonomy-sensitive literals in session diff are the worker parameters at the top of `lib/scheduled-tasks/worker.ts` (`15 * 60 * 1000`, `3`, `5 * 60 * 1000`, `50`, `60_000`). These are spec-locked (quote-builder.md §8.2) and live as named constants in the owner file — consistent with A4's motion tokens and A5's permissions module. PATCHES_OWED row logged for the Wave 23 Settings Audit pass.
- **G5 motion:** no UI changes.
- **G6 rollback:** migration reversible (declared).
- **G7 artefacts:** all 16 files + 1 migration + 1 journal edit verified via `ls` / `Grep`.
- **G8 typecheck + tests:** `npx tsc --noEmit` → zero errors. `npm test` → **68 / 68 green** (42 pre-existing + 26 new). `npm run build` → clean. `npm run lint` → clean.
- **G9 E2E:** not applicable (no critical-flow touch).
- **G10 browser:** not applicable (no UI surface).

## PATCHES_OWED rows

New rows A6 is logging:

1. **`a5_activity_log_enum_source_missing` — RESOLVED, not open.** A5's claim was inaccurate; the consolidated enum lives in `docs/specs/sales-pipeline.md` §4.1 as it has since Phase 3.5 step 2a. A6 lifted from that source. This row can be closed in `PATCHES_OWED.md`.
2. **FKs on `activity_log` + `messages` + `threads` deferred.** `company_id` / `contact_id` / `deal_id` columns ship as plain `text`. Wire `.references()` constraints in the Sales Pipeline wave (SP-1 or equivalent) that creates the `companies` / `contacts` / `deals` tables. No-op at v1.0 because the columns are logically correct already — we're only losing declarative FK enforcement.
3. **`activity_log.kind` consolidated count is 217, not the 166 the brief predicted.** A7 and every subsequent wave's G1 precondition that says "activity_log.kind has X values" should assert against the actual `ACTIVITY_LOG_KINDS.length` constant, not a hardcoded count.
4. **`task_type` enum consolidated count is 37, not 31.** Same note.
5. **`sales-pipeline.md` §4.1 and `quote-builder.md` §5.4 are OUT OF DATE vs schema reality as of Phase 3.5 step 11.** Spec review pass owed to reconcile: the specs still claim the Phase 3.5 step 2a counts; step 11 stages 1–4 added ~10 more `kind` values and ~3 more `task_type` values that are present in A6's schema. Non-blocking.
6. **`scheduled_tasks` worker runtime parameters (15min stale / 3 attempts / 5min×6^n backoff / 50 batch / 60s tick) live as named constants in `lib/scheduled-tasks/worker.ts`.** If Wave 23 Settings Audit wants Andy-runtime-tunable knobs, migrate to `settings` with keys `scheduled_tasks.stale_running_minutes` / `.max_attempts` / `.base_backoff_minutes` / `.batch_size` / `.tick_interval_seconds`.

## Open threads for A7

- **Email-classification `activity_log.kind` values** — `email_sent`, `email_received`, `email_bounced`, `email_complained` are all present. A7 probably wants `drift_check_failed` + magic-link send/redeem kinds; those are **NOT** in the current enum. A7 will need to patch `ACTIVITY_LOG_KINDS` + regenerate the migration (or lean on `portal_*` / `draft_*` existing kinds and defer magic-link-specific values to A8).
- **`lib/ai/models.ts` slug for the drift grader.** None of the INDEX.md slugs is an explicit drift-grader. The nearest in-scope candidate is adding `drift-check-grader` with tier `haiku` to `MODELS` (and to `lib/ai/prompts/INDEX.md`) in A7. Noted in A7 brief §10 precondition already.
- **Migration numbering** — A6 used `0002_*.sql`. A7's schema additions start at `0003_*.sql`. A7's brief currently says `0002_*` — that's drift; fixed inline below.
- **`user.timezone` column** — confirmed present (A5 landed it). A7's `isWithinQuietWindow()` reads from it directly.
- **`external_call_log` column shape** — A7 logs Resend + drift + Stripe calls here. Schema: `job` (text), `actor_type`, `actor_id`, `shared_cohort_id`, `units` (JSON), `estimated_cost_aud` (REAL), `prompt_version_hash`, `converted_from_candidate_id`, `created_at_ms`.
- **`lib/ai/models.ts` consumption pattern** — import `modelFor('slug')` at the call site; never hardcode a tier or model ID. The `no-direct-anthropic-import` ESLint rule enforces.

## Brief for A8

Per G11.b rolling cadence: **A7's closing handoff writes A8's brief.** A6 only writes A7's drift-correction (below). A8's full brief stays as `sessions/a8-brief.md` from the Phase 4 mop-up; A7 will drift-correct as needed.

## A7 brief drift corrections (applied in this session)

Applied inline to `sessions/a7-brief.md`:

- File whitelist: `lib/db/migrations/0002_*.sql` → `lib/db/migrations/0003_*.sql` (A6 consumed 0002).
- Added precondition: "`lib/ai/models.ts` export `modelFor(slug)` helper — verify: `Grep 'export function modelFor' lib/ai/models.ts`".
- Noted: A7 may need to patch `ACTIVITY_LOG_KINDS` with drift/magic-link-specific values if the call sites need them; if so, regenerate migration (new file `0003_a7_*.sql`) against the extended enum.
