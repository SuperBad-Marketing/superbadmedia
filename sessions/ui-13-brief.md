# `ui-13` — Daily 08:00 digest email + voice — Session Brief

> **Pre-compiled at UI-12 G11.b close-out per AUTONOMY_PROTOCOL.md §G11.b.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session (amended 2026-04-17).
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `ui-13`
- **Wave:** 10 — Unified Inbox (13 of 13 — **final Wave 10 session**)
- **Type:** FEATURE
- **Model tier:** Sonnet — standard email-generation + scheduled-task handler, no mobile/gesture/architectural complexity
- **Sonnet-safe:** yes — single scheduled-task handler, email template, voice copy. No multi-component recomposition.
- **Estimated context:** small — reads UI-12 + UI-11 handoffs, spec §10.3 excerpt, notifications schema, sendEmail adapter.
- **G0.5 input budget estimate:** ~12k tokens (brief + 2 handoffs + small spec excerpt + no mockups).

## 2. Spec excerpts (amended 2026-04-17)

### Excerpt 1 — Morning digest trigger + content

Source: `docs/specs/unified-inbox.md` §10.3

```
### 10.3 Morning digest

**Trigger:** scheduled task `inbox_morning_digest` at 8am Andy-local. If zero silenced messages in the last 24hr, no send (don't train dismissal).

**Content:** grouped by category, counts only for pure noise, one-line previews for non-noise silenced threads (unusual but possible — e.g. an auto-classified-silent signal thread Andy might want to know about).

**Channel:** email to `andy@` via Resend (not Graph — this is a system email, `email-nodejs` skill's transactional classification).

**Copy:** voice treatment owed to content mini-session. Sprinkle-bank surface.
```

### Excerpt 2 — Notification tiers (silent = digest queue)

Source: `docs/specs/unified-inbox.md` §10.2

```
- **Silent:** no transport fires; accumulates in morning digest queue.
```

`fired_transport = "none"` on the `notifications` row means "silent by design; morning digest reads these." See `lib/db/schema/notifications.ts`.

### Excerpt 3 — Cron table entry

Source: `BUILD_PLAN.md` §C

```
| `inbox_daily_digest` | 08:00 Mel daily | UI-13 | email | `inbox_digest_enabled` |
```

Note: `inbox_morning_digest` is the existing `SCHEDULED_TASK_TYPES` enum value. `inbox_daily_digest` is the BUILD_PLAN cron-table name — same concept, use the existing enum value.

### Excerpt 4 — History import completion reference (UI-12 inheritance)

Source: `sessions/ui-12-handoff.md` "What the next session inherits"

```
- **Import progress data.** The digest may want to reference import stats if the import just completed (e.g., "History import finished — 6,231 messages sorted"). Read from `graph_api_state.initial_import_progress_json`.
- **Thread/message counts.** The digest reads from the same `messages` + `threads` tables that history import populates. Backfill messages have `import_source='backfill_12mo'` and should be included in digest counts.
- **Kill switch pattern.** `inbox_sync_enabled` gates the import; the digest should check its own gate (likely `scheduled_tasks_enabled`).
```

**Audit footer (full spec paths for traceability; not read at G0):**

- `docs/specs/unified-inbox.md` §10.2–§10.3 — notification tiers + morning digest definition
- `docs/specs/unified-inbox.md` §12 — content mini-session surfaces (digest subject + body voice)
- `docs/specs/unified-inbox.md` §13 Step 9 — setup wizard done copy references digest
- `BUILD_PLAN.md` §C — cron table entry for `inbox_daily_digest`

## 2a. Visual references (required for `UI` type)

Not applicable — this is a `FEATURE` session (backend scheduled-task handler + email template). No admin-interior or client-facing UI route is created.

## 3. Acceptance criteria (verbatim)

```
Daily 08:00 digest email fires via Resend at 8am Andy-local when at
least one silent notification exists in the last 24 hours. Email
groups silenced messages by category (noise counts, one-line previews
for non-noise silenced threads). No send on zero-silent days (don't
train dismissal). Voice-treated subject + body. Kill-switch gated.
Self-perpetuating task chain (each successful run enqueues the next
day's run).
```

## 4. Skill whitelist

- `superbad-brand-voice` — voice treatment for digest subject + body copy
- `spec-driven-development` — standard Phase 5 execution

## 5. File whitelist (G2 scope discipline)

- `lib/graph/digest.ts` — new — core digest logic (query silent notifications, build email content, send)
- `lib/scheduled-tasks/handlers/inbox-digest.ts` — new — `inbox_morning_digest` handler + self-re-enqueue
- `lib/graph/index.ts` — edit — barrel export for digest module
- `lib/kill-switches.ts` — edit — add `inbox_digest_enabled` kill switch (default OFF)
- `lib/db/migrations/0039_ui13_digest_settings.sql` — new — seed digest settings keys
- `lib/db/migrations/meta/_journal.json` — edit — add entry idx 39
- `lib/settings.ts` — edit — add digest settings keys to typed registry
- `docs/content/unified-inbox/digest-email.md` — new — canonical voice-treated email copy (subject + body template)
- `tests/inbox-digest.test.ts` — new — handler + logic tests
- `tests/settings.test.ts` — edit — update count assertions
- `lib/db/schema/activity-log.ts` — edit — add `inbox_digest_sent` kind

## 6. Settings keys touched

- **Reads:** `inbox.history_import_months` (to mention import completion in digest if relevant)
- **Seeds (new keys):**
  - `inbox.digest_hour` — `8` — hour (0–23) in Andy's timezone to fire the digest
  - `inbox.digest_silent_window_hours` — `24` — how many hours back to look for silent notifications
  - `inbox.digest_no_send_on_zero` — `true` — suppress send when zero silenced messages

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] `notifications` table defined — verify: `grep "notifications" lib/db/schema/notifications.ts`
- [ ] `fired_transport` column with `"none"` enum — verify: `grep "none" lib/db/schema/notifications.ts`
- [ ] `inbox_morning_digest` in SCHEDULED_TASK_TYPES — verify: `grep "inbox_morning_digest" lib/db/schema/scheduled-tasks.ts`
- [ ] `sendEmail` exported — verify: `grep "export.*sendEmail" lib/channels/email/send.ts`
- [ ] `enqueueTask` exported — verify: `grep "export.*enqueueTask" lib/scheduled-tasks/enqueue.ts`
- [ ] `logActivity` exported — verify: `grep "export.*logActivity" lib/db/schema/activity-log.ts`
- [ ] `formatTimestamp` exported — verify: `grep "export.*formatTimestamp" lib/timestamps.ts`
- [ ] `messages` table with `import_source` column — verify: `grep "import_source" lib/db/schema/messages.ts`
- [ ] `graph_api_state` table with `initial_import_progress_json` — verify: `grep "initial_import_progress_json" lib/db/schema/graph-api-state.ts`
- [ ] `getImportProgress` exported from `lib/graph/` — verify: `grep "getImportProgress" lib/graph/index.ts`

## 8. Rollback strategy (G6 — exactly one)

- [x] `feature-flag-gated` — kill-switch named `inbox_digest_enabled` in `lib/kill-switches.ts`; rollback = flip the flag. Migration 0039 is additive (INSERT OR IGNORE settings rows).

## 9. Definition of done

- [ ] `lib/graph/digest.ts` exists with `buildDigestContent()` + `sendDigestEmail()` exports.
- [ ] `lib/scheduled-tasks/handlers/inbox-digest.ts` exists with handler for `inbox_morning_digest` that self-re-enqueues for next day.
- [ ] Handler queries `notifications` where `fired_transport = "none"` AND `fired_at_ms` within the silent window.
- [ ] Groups silenced messages by category: pure-noise (counts only), non-noise silenced (one-line previews).
- [ ] No send on zero-silent days — handler exits without calling `sendEmail`.
- [ ] History import completion reference included if `initial_import_status` just flipped to `complete` within the digest window.
- [ ] Voice-treated subject + body copy per `superbad-brand-voice`.
- [ ] Self-perpetuating: each run enqueues `inbox_morning_digest` for `next8amMelbourneMs()`.
- [ ] `inbox_digest_enabled` kill switch added (default OFF).
- [ ] Migration 0039 seeds digest settings keys.
- [ ] `inbox_digest_sent` activity-log kind added.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.
- [ ] **G10.5 fidelity gate** — in-context fidelity grep (non-UI session): acceptance-criterion keywords present in diff, no file-whitelist violations, no memory-alignment violations.
- [ ] **Memory-alignment declaration** — handoff lists every applied memory.
- [ ] G-gates run end-to-end (G0 → G12) with a clean handoff written.

## 10. Notes for the next-session brief writer (G11 extension)

UI-13 is the **final Wave 10 session**. After this:

- **Wave 10 is complete.** The next action should be whatever BUILD_PLAN §D identifies as the Wave 11 opener (likely CM-1 or OS-1 depending on dependency resolution).
- The digest handler's `next8amMelbourneMs()` utility should follow the same DST-safe pattern as `next23MelbourneMs()` from UI-4's hygiene purge handler (`lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts`). Read that as a reference at G0.
- The digest email is sent via Resend (`classification: 'transactional'`), NOT via Graph API. Graph is for Andy-authored replies only.
- `inbox_morning_digest` is already in the `SCHEDULED_TASK_TYPES` enum (A6). No enum extension needed.
- Bootstrap wiring: the digest task needs an initial enqueue somewhere (likely the Graph API setup wizard completion, similar to how `ensureInboxHygieneEnqueued()` from UI-4 is called). Wire it or log as PATCHES_OWED.
