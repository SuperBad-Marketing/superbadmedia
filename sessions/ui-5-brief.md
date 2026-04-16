# `ui-5` — Thread draft generation (Opus) + cached-draft retrieval — Brief

**Wave:** 10 (Unified Inbox 5 of 13 — Opus-tier drafter slice)
**Type:** FEATURE
**Size:** medium
**Model tier:** `/deep` (Opus) — drafter itself is Opus per spec §7.4 ("Opus, not Haiku — this is customer-facing text, quality matters"). Session work is straightforward scheduled-task handler + prompt assembly + invalidation plumbing, but the handoff includes an Opus prompt calibration check which benefits from Opus review.
**Spec:** `docs/specs/unified-inbox.md` §§5.1 (`threads.cached_draft_*` columns — already on schema from A6), 7.4 (Q8 reply drafter), 11 (cross-spec flags), 16 disciplines #52, #54, #63, §16 bullet "LLM model registry" citing `inbox.draft_reply`
**Precedent:** `sessions/ui-2-handoff.md` + `sessions/ui-3-handoff.md` + `sessions/ui-4-handoff.md` — three-classifier pipeline shipped; UI-5 is the first **generation** surface in the inbox (not classification). Pattern lens: shares prompt-builder + Zod-validation + kill-switch-gating idiom; differs in trigger (scheduled task, not inline in `sync.ts`), tier (Opus, not Haiku), output (free text, not enum).

---

## Scope — what lands in this session

1. **Register LLM job `inbox-draft-reply`** — add to `lib/ai/models.ts` MODELS map (tier `"opus"`), add row to `lib/ai/prompts/INDEX.md`, and flesh out a new `## inbox-draft-reply` section in `lib/ai/prompts/unified-inbox.md` with Intent/Tier/Input/Output/Effects. **NOTE**: UI-4 handoff incorrectly claimed this slug was already registered — verify absence at G1 precondition check. If present (unlikely), investigate before overwriting.
2. **Opus-tier draft generator** — `lib/graph/draft-reply.ts` exports `generateCachedDraft(threadId)`:
   - Reads the thread + its latest inbound message.
   - Assembles the spec §7.4 input: thread history (all messages) + Brand DNA profile (system context) + contact relationship signals + CCE output stub (see §3 below — CCE-1 ships in Wave 16) + recent Andy-sent few-shot examples (N=5 to 10, filtered by relationship_type + channel).
   - Calls Opus via `modelFor("inbox-draft-reply")`.
   - Zod-validates output shape `{ draft_body: string, low_confidence_flags: Array<{ span: string, reason: string }> }`.
   - Writes to `threads.cached_draft_body` + sets `has_cached_draft = true`, `cached_draft_stale = false`, `cached_draft_generated_at_ms = now`.
   - Logs `inbox_draft_generated` activity (already in `ACTIVITY_LOG_KINDS` per A6).
   - Fallback on LLM/parse failure: does NOT write a draft (leave `has_cached_draft` at prior value); logs the failure via `reportIssue()`. **Not** a silent skip — a missing draft is safer than a bad one.
3. **Prompt builder + context loader** — `lib/graph/draft-reply-prompt.ts`:
   - `buildDraftReplyPrompt(ctx)` — composes system + user prompts per spec §7.4.
   - `loadDraftReplyContext(threadId)` — reads thread + messages + Brand DNA + few-shot recent Andy-sent messages. Truncates individual message bodies to 2000 chars (matching classifier precedent), caps thread history at 20 messages most recent, caps few-shot examples at 10.
   - **CCE-stub**: CCE-1 (`assembleContext(contactId)`) ships in Wave 16 — not built yet. Pattern: attempt `await import("@/lib/client-context").then(m => m.assembleContext?.(contactId))` inside a try/catch; on any failure (module missing, function missing, throw) fall through to a minimal inline context derived from `contacts.relationship_type` + recent `activity_log` rows for the contact (last 10). Exported as `loadClientContextOrStub(contactId)` helper for testability.
   - Body-composition must NOT include user-addressed framing (per two-perpetual-contexts discipline — Brand DNA is system context only, never user prompt). Explicit code comment + a linter-friendly section boundary.
4. **Invalidation hook — new inbound** — extend `classifySignalNoise()` persistence path (UI-4) OR add a post-`Promise.allSettled` step in `sync.ts` to flip `cached_draft_stale = true` on the thread when an inbound is persisted. Brief picks: add in `sync.ts` AFTER the 3-way `Promise.allSettled` block, gated on `direction === 'inbound'`, and only flips the flag — does NOT trigger regen here. Next open regenerates (spec §7.4).
5. **Invalidation hook — outbound send** — placeholder: spec says outbound send also invalidates. Outbound send surface is UI-6+ territory; for UI-5, export a helper `invalidateCachedDraft(threadId, reason)` that UI-6 will call. Do NOT wire into any outbound path in this session.
6. **Scheduled-task trigger** — spec §7.4: "fires as a scheduled task when a client-facing thread receives a new inbound." Implementation:
   - Add handler `inbox-draft-generate` → calls `generateCachedDraft(threadId)` with `thread_id` from `task.meta`.
   - **Does NOT use the existing `inbox_draft_reply` task type** — that name is reserved for the draft-send-email path later. Register a new task type `inbox_draft_generate` in `lib/db/schema/scheduled-tasks.ts` `SCHEDULED_TASK_TYPES`.
   - Enqueue trigger: inside `sync.ts` 3-way `Promise.allSettled` block, AFTER signal/noise completes, IF `direction === 'inbound'` AND the thread is **client-facing** (has a `contact_id` pointing at a contact with `relationship_type IN ('client', 'past_client', 'lead')`). Enqueue runs at `now + 60s` to debounce rapid multi-message arrivals (second inbound inside 60s supersedes by idempotency key; oldest-runnable-wins).
   - Idempotency key: `inbox_draft_generate:{threadId}:{signalNoiseRunMs}` — debounce uses the same-millisecond floor, so tight bursts collapse to one enqueue.
7. **Handler registry wire-in** — add `INBOX_DRAFT_HANDLERS` to `lib/scheduled-tasks/handlers/index.ts` (spread into `HANDLER_REGISTRY`), mirroring UI-4's `INBOX_HYGIENE_HANDLERS` precedent.
8. **Gate on kill switches** — `inbox_sync_enabled` AND `llm_calls_enabled` must both be on for:
   - the enqueue step in `sync.ts` (skip enqueue when either off),
   - the handler entry in `generateCachedDraft()` (skip + no write when either off).
9. **No-auto-send enforcement** — the generator writes to `cached_draft_body` only; it NEVER calls `sendEmail()` or any outbound primitive. Spec §7.4 + §11.4 safe-to-send gate make this policy, not capability. Document in code comment.
10. **Tests** — two test files (~18 meaningful tests total):
    - `tests/graph-draft-reply.test.ts` (~12):
      - Zod parse (4 — happy path + missing draft_body + malformed low_confidence_flags + empty flags array OK)
      - Prompt builder (4 — includes thread history + includes Brand DNA + includes few-shot examples + CCE stub fallback when module missing)
      - Persistence (3 — writes cached_draft_body + flips has_cached_draft + clears cached_draft_stale; fallback leaves columns untouched on LLM fail)
      - Kill-switch skip (1)
    - `tests/inbox-draft-generate.test.ts` (~6):
      - Handler invokes generateCachedDraft with the task's threadId (1)
      - Enqueue path fires only for client-facing threads (2 — client thread enqueues; non_client thread does not)
      - Invalidation flips stale flag on new inbound (1)
      - Idempotency key debounces (1)
      - Kill-switch skip in handler entry (1)

## Out of scope — do NOT build

- **Outbound send surface.** UI-6 / UI-7 territory (compose + send).
- **Refine-chat sidecar** (§7.4 "refine-chat"). UI-11 territory — needs thread-detail UI to host the sidecar.
- **Low_confidence_flags UI rendering.** Data lands on the draft; the detail surface renders them later. UI-5 persists but does not display.
- **Draft invalidation on outbound send** — wire deferred to UI-6. `invalidateCachedDraft()` exported but unused in UI-5.
- **`cached_draft_low_confidence_flags` column on threads.** Spec §7.4 output has them but §5.1 doesn't name the column. Two options: (a) add a JSON column, or (b) stash them inside `cached_draft_body` as a structured JSON envelope. Decision: **write draft_body as plain text to `cached_draft_body` and the flags as a separate new nullable JSON column `cached_draft_low_confidence_flags`.** Migration 0035 — see §Schema below. Candidate PATCHES_OWED entry for spec §5.1 column list reconciliation.
- **Andy's in-progress edit preservation on stale-flip.** Spec §16 discipline #60 says edits must not be clobbered; UI-5 only flips `cached_draft_stale = true` — it does NOT overwrite `cached_draft_body`. The "new draft" is generated on next open (UI-11), not on invalidation. UI-5 satisfies discipline #60 by the minimal-stale-flag approach.
- **Cost/usage logging via Observatory.** `modelFor()` + the Anthropic call already route through the observability wrapper (per A5 ESLint rule `lite/no-direct-anthropic-import`). UI-5 does not add a second log path.
- **Morning digest / read-time rendering.** UI-13 territory.

## Preconditions — verify before touching any code (G1)

1. `lib/graph/router.ts` + `notifier.ts` + `signal-noise.ts` exist (UI-2 + UI-3 + UI-4).
2. `lib/graph/sync.ts` has the 3-way `Promise.allSettled([router, notifier, signalNoise])` block (UI-4).
3. `lib/db/schema/messages.ts` has `threads.has_cached_draft` + `cached_draft_body` + `cached_draft_generated_at_ms` + `cached_draft_stale` columns (A6).
4. `lib/db/schema/brand-dna.ts` has `brand_dna_profiles` table (BDA-1) with readable columns for system-context assembly.
5. `lib/db/schema/scheduled-tasks.ts` `SCHEDULED_TASK_TYPES` does **NOT** already include `"inbox_draft_generate"` (UI-5 adds it). It DOES include `"inbox_draft_reply"` (A6, reserved for the later send path — do not repurpose).
6. `lib/db/schema/activity-log.ts` `ACTIVITY_LOG_KINDS` includes `inbox_draft_generated` (A6).
7. `lib/ai/models.ts` MODELS map does **NOT** include `"inbox-draft-reply"` (UI-5 adds with tier `"opus"`). **Note:** UI-4 handoff incorrectly claimed this was already registered — verify and correct.
8. `lib/ai/prompts/INDEX.md` does NOT yet list `inbox-draft-reply`. UI-5 adds.
9. `lib/ai/prompts/unified-inbox.md` has three populated classifier entries (UI-2/3/4) and no `inbox-draft-reply` section yet.
10. `lib/kill-switches.ts` exposes `inbox_sync_enabled` + `llm_calls_enabled`.
11. `logActivity()` + `enqueueTask()` + `modelFor()` helpers available.
12. `lib/support/reportIssue()` (B1) available for fallback-path logging.
13. `contacts.relationship_type` column exists with values including `'client' | 'past_client' | 'lead' | 'non_client'` (UI-2).
14. CCE-1 is **not yet built** (Wave 16). `lib/client-context/` does not exist. UI-5 must stub — do NOT build CCE-1 in this session; stub the import boundary.
15. No existing `lib/graph/draft-reply.ts` / `draft-reply-prompt.ts`. UI-5 creates them.
16. No existing `lib/scheduled-tasks/handlers/inbox-draft-generate.ts`. UI-5 creates.

Halt + reroute if any 1–14 are missing or wrong. Items 15–16 must be absent; if present, investigate rather than overwrite.

## File whitelist — what UI-5 may touch

**Create:**
- `lib/db/migrations/0035_ui5_cached_draft_flags.sql` (+ `meta/_journal.json` entry) — adds `threads.cached_draft_low_confidence_flags` nullable JSON column
- `lib/graph/draft-reply.ts`
- `lib/graph/draft-reply-prompt.ts`
- `lib/scheduled-tasks/handlers/inbox-draft-generate.ts`
- `tests/graph-draft-reply.test.ts`
- `tests/inbox-draft-generate.test.ts`

**Edit:**
- `lib/db/schema/messages.ts` — add `cached_draft_low_confidence_flags` JSON column to `threads` (NOT messages)
- `lib/db/schema/scheduled-tasks.ts` — add `"inbox_draft_generate"` to `SCHEDULED_TASK_TYPES`
- `lib/ai/models.ts` — add `"inbox-draft-reply": "opus"` to MODELS map (in the `unified-inbox (3)` grouping — promote comment to `unified-inbox (4)`)
- `lib/ai/prompts/INDEX.md` — add row for `inbox-draft-reply`
- `lib/ai/prompts/unified-inbox.md` — add `## inbox-draft-reply` section; update frontmatter `populated-by` to include UI-5 DONE; keep `status: populated`
- `lib/graph/sync.ts` — add debounced enqueue of `inbox_draft_generate` task AFTER the 3-way `Promise.allSettled` block, gated on `direction === 'inbound'` + client-facing contact + kill-switches
- `lib/graph/index.ts` — barrel exports for `draft-reply` + `draft-reply-prompt`
- `lib/scheduled-tasks/handlers/index.ts` — spread `INBOX_DRAFT_HANDLERS`
- `SESSION_TRACKER.md` — G12 Next Action → UI-6
- `sessions/CLOSURE_LOG.md` — prepend session summary

**Must not touch:**
- `lib/graph/router.ts` / `notifier.ts` / `signal-noise.ts` (reference only; 3-way parallel dispatch remains 3-way — drafter hangs off a scheduled task, NOT a 4th slot in `allSettled`)
- `lib/client-context/` — does NOT exist; do not scaffold CCE-1 in this session
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` (UI-4)
- `contacts.ts` / `brand-dna-profiles.ts` (read-only)
- Anything under `app/lite/` (no UI in UI-5)
- `instrumentation.ts` (UI-4's `ensureInboxHygieneEnqueued()` still unwired; UI-5 does not wire it)

## Schema change — 0035_ui5_cached_draft_flags

Single additive migration:
```sql
ALTER TABLE `threads` ADD COLUMN `cached_draft_low_confidence_flags` text;
```

JSON column via Drizzle `text({ mode: "json" })`. Nullable. Indexed? No — read only on thread-open. Journal idx 35. Revert: `ALTER TABLE threads DROP COLUMN cached_draft_low_confidence_flags` (declare destructive in handoff).

## Settings keys consumed

None added. One existing candidate to check: `settings.get('inbox.draft_debounce_ms')` — does NOT exist yet. UI-5 locks the debounce window as a named `const DRAFT_ENQUEUE_DEBOUNCE_MS = 60_000` per the structural-constant precedent from UI-3/UI-4. Flag as PATCHES_OWED if Phase 3.5 reconciliation wants it settings-driven.

Thread-history + few-shot caps similarly named constants:
- `MAX_THREAD_HISTORY_MESSAGES = 20`
- `MAX_FEW_SHOT_EXAMPLES = 10`
- `MESSAGE_BODY_TRUNCATE_CHARS = 2000` (mirrors classifier precedent)

## Kill switches

- `inbox_sync_enabled` — classifier + handler + enqueue all skip when off.
- `llm_calls_enabled` — handler skips when off. Enqueue still happens (so the task backlog reflects reality) but handler no-ops at fire time. Nuance justified inline: the enqueue timestamp is the audit signal; the handler is the gate.
- No new kill switch in UI-5.

## LLM job

- `inbox-draft-reply` → **Opus** via `modelFor()`. **New slug — UI-5 registers it.** Spec §16 model-registry bullet names this slug explicitly.

## Activity log kinds

- `inbox_draft_generated` — already registered in A6. UI-5 logs on successful generation. Meta: `{ thread_id, message_id (triggering inbound), low_confidence_flag_count, prompt_token_estimate, response_token_estimate, duration_ms }`.
- Failure path: no new log kind. Use `reportIssue()` (B1) with context `{ thread_id, feature: "inbox_draft_generate", error }`.

## Scheduled task types

- `inbox_draft_generate` — **NEW** this session. Add to `SCHEDULED_TASK_TYPES`. Handler: `lib/scheduled-tasks/handlers/inbox-draft-generate.ts`. Meta: `{ thread_id }`.
- `inbox_draft_reply` — **reserved for future send path** (A6 allocated it; do NOT repurpose in UI-5). Confirm via grep at G1: it exists in the enum but has no handler yet. That's intentional — UI-6/UI-7 wires it.

## Fallback behaviour

LLM or Zod parse failure → do NOT write a draft. Leave `cached_draft_body` at its prior value (most often NULL for a thread that's never been drafted). Flip `cached_draft_stale` back to `false` only if a prior non-stale draft existed — otherwise leave as-is. Log via `reportIssue()`. Rationale: a missing draft surfaces as "Generate draft" prompt in UI; a bad draft surfaces as a half-written email that looks authoritative. Same conservative-asymmetry discipline (#63) as UI-3/UI-4 — in each direction, pick the side where human review catches the error.

## Completion contract (G7)

- Typecheck clean (`npx tsc --noEmit` 0 errors).
- `npm test` green, both new test files registered (~18 new tests; total ≥ 934).
- `npm run build` clean.
- Lint: one new pre-existing `lite/no-direct-anthropic-import` at `draft-reply.ts` will be acceptable, matching the UI-2/UI-3/UI-4 precedent. Not a regression.
- Migration 0035 applied + `meta/_journal.json` entry.
- `threads.cached_draft_low_confidence_flags` column verified present.
- `inbox-draft-reply` slug registered in MODELS map + INDEX.md + unified-inbox.md.
- `inbox_draft_generate` task_type registered in `SCHEDULED_TASK_TYPES`.
- `INBOX_DRAFT_HANDLERS` spread into `HANDLER_REGISTRY`.
- Kill-switches off → no enqueue + no LLM call + no writes + no exceptions.

## Rollback strategy

**Feature-flag-gated + migration reversible.** Kill switches `inbox_sync_enabled` + `llm_calls_enabled` both default disabled. Rollback:
1. Leave switches off → enqueue + handler both no-op.
2. Migration is additive (one nullable column). Revert via `git revert` + `ALTER TABLE threads DROP COLUMN cached_draft_low_confidence_flags` (declare destructive in handoff).

## Memory alignment gates (G10.5 reviewer will check)

- **`feedback_technical_decisions_claude_calls`** — all implementation choices (CCE-stub fallback strategy, debounce window = 60s as structural constant, flags-as-separate-column vs JSON envelope, fallback leaves columns untouched, enqueue happens but handler gates on llm_calls_enabled) silently locked. No technical questions to Andy.
- **`project_two_perpetual_contexts`** — Brand DNA + CCE both assembled into prompt. Brand DNA as **system context**, never user prompt. CCE stub falls back to relationship_type + recent activity — a degraded but present version of the second perpetual context. Failure mode documented.
- **`project_llm_model_registry`** — call `modelFor("inbox-draft-reply")`. Never a raw model ID. The ESLint rule `lite/no-direct-anthropic-import` enforces at build time.
- **`feedback_dont_undershoot_llm_capability`** — Opus trusted with rich context to draft in Andy's voice from a handful of few-shot examples. No labelled training data. Spec says Opus; trust it.
- **`feedback_technical_decisions_claude_calls`** (second touch) — Zod schema accepts `low_confidence_flags` as `[]` on confident drafts; don't coerce to `null` or omit the field. Consumers of the column can treat `[]` and `null` equivalently but the schema is strict.
- **`project_context_safety_conventions`** (4th rule: prompts as files) — the new `inbox-draft-reply` section in `unified-inbox.md` documents the full prompt contract. The TS prompt builder quotes-from-file in a leading comment per the convention.
- **`project_autonomy_protocol_phase_4`** (AUTONOMY_PROTOCOL verification gate) — UI-5's scheduled-task handler is the first Opus-tier recurring LLM spend in the inbox. Observability already wires via `modelFor()` → anthropic wrapper; no new observability plumbing.

## What UI-6 inherits

- **`invalidateCachedDraft(threadId, reason)`** helper exported from `lib/graph/draft-reply.ts` — UI-6 calls on outbound send.
- **Cached draft persistence contract** — `cached_draft_body` + `cached_draft_stale` + `cached_draft_low_confidence_flags` all writable from the compose/send flow, but typically UI-6 only invalidates (clears body, flips stale to false because the thread has moved on, clears flags).
- **`inbox_draft_reply` task_type** — still reserved with no handler. UI-6/UI-7 wires the draft-send-email handler here.
- **Three-way parallel dispatch in `sync.ts`** — still 3-way. UI-5's enqueue runs AFTER the block, not inside it. UI-6 does not change the parallel count.
- **Fallback convention per classifier** — each classifier/generator picks the conservative side of its own axis: router → `new_lead`, notifier → `silent`, signal/noise → `signal`, drafter → **no-write**. UI-6 should apply the same discipline to its outbound send failures (queue-for-retry, never silently drop).

## PATCHES_OWED additions (provisional)

1. `docs/specs/unified-inbox.md` §5.1 threads — explicitly list `cached_draft_low_confidence_flags` (nullable JSON) column. Currently inferred from §7.4 output shape. Non-blocking.
2. `docs/settings-registry.md` — if Phase 3.5 reconciliation wants the 60s debounce / 20-message history cap / 10 few-shot cap / 2000-char truncation as settings, add keys + the seed migration. Out of scope for UI-5.
3. `instrumentation.ts` / SW graph-api-admin wizard — UI-4's `ensureInboxHygieneEnqueued()` still unwired. UI-5 does NOT add a bootstrap; same pending work.
4. UI-4 handoff-note correction: the UI-4 handoff claimed `inbox-draft-reply` was registered in A6. Not true. UI-5 registers it. Flag in UI-5 handoff that the UI-4 statement should be read "will be registered by UI-5" — no retroactive edit needed, but future readers of ui-4-handoff should be aware.
5. CCE-1 (Wave 16) must export `assembleContext(contactId)` returning the shape UI-5 consumes. UI-5's stub fallback defines the **minimum** contract: `{ relationship_type, recent_activity: Array<{ kind, when, summary }> }`. CCE-1's real implementation is richer but must remain a superset.

---

## G0 kickoff ritual

1. Read this brief.
2. Read the last 2 handoff notes: `sessions/ui-4-handoff.md`, `sessions/ui-3-handoff.md`.
3. Read spec §§5.1 (threads.cached_draft_* columns), 7.4 (reply drafter), 11.4 (safe-to-send gate), 16 (#52, #54, #60, #63).
4. Read `lib/graph/signal-noise.ts` (UI-4) for the classifier-persistence idiom — the drafter mirrors the **structure** (load context → build prompt → validate → persist → activity log) while diverging on the **trigger** (scheduled task, not inline).
5. Read `lib/ai/prompts/client-context-engine.md` — the existing Opus `client-context-draft-reply` prompt is the closest related prompt. UI-5's `inbox-draft-reply` is different (inbox-focused, reactive not manual) but should share compositional style.
6. Verify preconditions 1–16 above. Specifically grep for `inbox-draft-reply` across `lib/ai/` to confirm absence.
7. Load skills: `drizzle-orm`, `typescript-validation`, `spec-driven-development`.
8. Build order:
   1. Schema migration + journal entry (verify typecheck before moving on).
   2. Register `inbox-draft-reply` slug in MODELS map + INDEX.md + unified-inbox.md section.
   3. Register `inbox_draft_generate` task_type.
   4. Prompt builder + CCE stub fallback (`draft-reply-prompt.ts`).
   5. Generator + persistence + fallback path (`draft-reply.ts`).
   6. Handler file + registry spread.
   7. `sync.ts` enqueue step + invalidation-on-inbound flag flip.
   8. Tests (prompt/generator file first, then handler file).
   9. Typecheck + test + build + lint.
   10. Handoff; tracker flip; closure-log prepend; commit.
