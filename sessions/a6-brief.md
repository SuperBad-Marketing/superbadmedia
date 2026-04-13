# A6 — activity_log + scheduled_tasks + formatTimestamp + LLM model registry + external_call_log + messages/threads schema — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** A6
- **Wave:** 1 — Foundation A
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** large — split via G3 70% checkpoint if needed.

## 2. Spec references

- `BUILD_PLAN.md` Wave 1 §A6 — owner block.
- `FOUNDATIONS.md` §11.1 (`logActivity()`), §11.3 (`formatTimestamp()` + timezone), §11.6 (LLM model registry — "name the job, not the model"), §11.2 (`messages` / `threads` source-of-truth note).
- `docs/specs/cost-usage-observatory.md` §4.2 (registered jobs inventory) — informs the `lib/ai/models.ts` job-name list (A6 declares the registry; Observatory in Wave 21 reads it).
- `docs/specs/unified-inbox.md` §schema — informs `messages` + `threads` columns. Producer slice ships in A6; UI ships in Wave 9.
- Memory `project_llm_model_registry` — name the job, not the model; model IDs never leak into feature code.
- AUTONOMY_PROTOCOL.md §G4 — registry path is autonomy-sensitive (model IDs are config, not literals).
- `sessions/a5-handoff.md` (when written) — must be read at G0 for the seeded settings keys + glossary types.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md A6)

```
A6 — activity_log + scheduled_tasks + formatTimestamp + LLM model registry +
     external_call_log + messages/threads schema
- Builds: `activity_log` table + `logActivity()` helper (§11.1) with
  consolidated 166-value `kind` enum (from Phase 3.5 Batch A step 2a).
  `scheduled_tasks` table + background worker (§11-tier primitive per
  PATCHES_OWED row 29) with 31-value `task_type` enum.
  `formatTimestamp(date, tz)` utility + timezone column on `user` (§11.3).
  LLM model registry at `lib/ai/models.ts` (§11.6) — job names → model IDs.
  `external_call_log` table (source of truth for Observatory).
  `messages` + `threads` tables (producer-slice of Unified Inbox lands here
  because 4+ specs consume the schema before UI full stack ships).
- Owns: `activity_log`, `scheduled_tasks`, `external_call_log`, `messages`,
  `threads`, `logActivity()`, `scheduled_tasks` worker, `formatTimestamp()`,
  `lib/ai/models.ts`.
- Consumes: A1, A5.
- Settings keys: none.
- Rollback: migration reversible.
```

## 4. Skill whitelist

- `drizzle-orm` — five new tables + enums + a worker query loop.
- `claude-api` — informs `lib/ai/models.ts` shape (job-name → `claude-{tier}-4-6` mapping) and prompt-cache wiring expectations downstream specs will lean on.

## 5. File whitelist (G2 scope discipline)

- `lib/db/schema/activity-log.ts` — `activity_log` table + 166-value `kind` enum (`new`).
- `lib/db/schema/scheduled-tasks.ts` — `scheduled_tasks` table + 31-value `task_type` enum (`new`).
- `lib/db/schema/external-call-log.ts` — `external_call_log` table (`new`).
- `lib/db/schema/messages.ts` — `messages` + `threads` tables (`new`).
- `lib/db/schema/user.ts` — **A5 already added `timezone` and `role`**; A6 does not re-add. Only edit if a column A6 genuinely owns needs appending.
- `lib/db/schema/index.ts` — extend barrel (`edit`).
- `lib/db/migrations/0002_*.sql` — schema migration for the new tables (A5 used 0000 for schema + 0001 for seed; A6's schema starts at 0002). Generate via `npx drizzle-kit generate --name=...`.
- `lib/activity-log.ts` — `logActivity({ userId, kind, payload, ... })` (`new`).
- `lib/format-timestamp.ts` — `formatTimestamp(date, tz)` helper (Australia/Melbourne default) (`new`).
- `lib/ai/models.ts` — registry: `MODELS = { 'brand-dna-portrait': 'claude-opus-4-6', 'drift-check': 'claude-haiku-4-5-20251001', ... }` keyed on every job slug from `lib/ai/prompts/INDEX.md` + Observatory §4.2 (`new`).
- `lib/scheduled-tasks/worker.ts` — single-process polling worker (gated behind `kill-switches.scheduled_tasks_enabled`) (`new`).
- `lib/scheduled-tasks/enqueue.ts` — `enqueueTask({ task_type, runAt, payload })` (`new`).
- `tests/activity-log.test.ts`, `tests/scheduled-tasks.test.ts`, `tests/format-timestamp.test.ts`, `tests/llm-models.test.ts`, `tests/messages-schema.test.ts` (`new`).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** `kill-switches.scheduled_tasks_enabled` (worker gate). No other settings reads.
- **Seeds (new):** none (BUILD_PLAN A6 explicitly: "Settings keys: none").

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] A5 closed cleanly — verify: `ls sessions/a5-handoff.md`.
- [ ] `lib/db/index.ts` exports a Drizzle client — verify: `Grep "export.*db" lib/db/index.ts`.
- [ ] `lib/db/schema/settings.ts` exists with `settings` table — verify: `Grep "settings" lib/db/schema/settings.ts`.
- [ ] `lib/db/schema/user.ts` exists with the seven preference columns **plus `timezone` and `role`** (landed in A5) — verify: `Grep "motion_preference\|sounds_enabled\|first_signed_in_at\|timezone\|role" lib/db/schema/user.ts`.
- [ ] `lib/kill-switches.ts` exports `scheduled_tasks_enabled` — verify: `Grep "scheduled_tasks_enabled" lib/kill-switches.ts`.
- [ ] `lib/types/glossary.ts` exports the 11 entity types — verify: `Grep "export type" lib/types/glossary.ts`.
- [ ] `docs/settings-registry.md` reflects 68 keys total post-A5 — verify: `Grep "Total: 68" docs/settings-registry.md`. (A5 corrected the earlier arithmetic error: pre-A5 registry was 61 keys, not 60.)
- [ ] **Consolidated 166-value `activity_log.kind` enum source file does NOT exist.** A5 confirmed via Phase 3.5 Batch A step 2a search — the consolidated artefact was never produced. A6 must either (a) consolidate the 166 values from `docs/specs/*.md` `## activity_log.kind` sections itself (expect a context-budget squeeze; split at G3 70% if needed), or (b) pause and surface as a product question. PATCHES_OWED row logged by A5 under `a5_activity_log_enum_source_missing`. Do NOT invent values.
- [ ] `lib/ai/prompts/INDEX.md` exists — verify: `ls lib/ai/prompts/INDEX.md` (the file the LLM model registry's job slugs are aligned to).
- [ ] `vitest.config.ts` 30s timeout intact (A3) — verify: `Grep "testTimeout" vitest.config.ts`.

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**migration reversible** — every new table + enum has its down-migration. Rollback = `drizzle-kit migrate:down` to A5's state. The scheduled-tasks worker stays disabled at boot (kill-switch default off); no autonomous side effects from this session even if shipped to prod immediately.

## 9. Definition of done

- [ ] `activity_log`, `scheduled_tasks`, `external_call_log`, `messages`, `threads` tables present in schema — verify: `Grep` per table.
- [ ] `kind` enum has exactly the consolidated value count (target 166 per BUILD_PLAN; if A5 escalated the source-file gap, the actual locked count is captured in this session's handoff with a note).
- [ ] `task_type` enum has exactly 31 values — verify: `Grep -c` against the enum file.
- [ ] `logActivity({ userId, kind, payload })` writes a row — verify: tests/activity-log.test.ts.
- [ ] `formatTimestamp(date, 'Australia/Melbourne')` returns the spec format — verify: tests/format-timestamp.test.ts.
- [ ] `lib/ai/models.ts` exports `MODELS` keyed by job slug; no model ID strings appear in `app/` or `components/` — verify: `Grep "claude-opus-4-6\|claude-sonnet-4-6\|claude-haiku" app/ components/` returns nothing.
- [ ] Background worker boots gated on the kill-switch — verify: tests/scheduled-tasks.test.ts.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.

## 10. Notes for the next-session brief writer (A7)

A6's closing handoff writes A7's brief (G11 extension). Capture:

- The final `kind` enum count (and the source from which it was assembled — Phase 3.5 Batch A step 2a output, or A6's own consolidation if the file was missing).
- LLM model registry slugs landed (so A7 can wire the drift-check call against the right slug, not a hardcoded model ID).
- `external_call_log` column shape (so A7's Resend + drift-check + Stripe call sites log against the correct columns).
- Whether `user.timezone` was added by A5 or A6 (so A7's `isWithinQuietWindow()` can read from the right place).
- Any classifications of `activity_log.kind` that A7 will write (`email_sent_*`, `drift_check_failed`, etc.) — confirm they exist in the enum or A7 will trip G1.
