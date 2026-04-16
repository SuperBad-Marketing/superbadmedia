# `ui-3` — Notification triage classifier (Haiku) + push vs silent gate — Brief

**Wave:** 10 opens with ui-3 (Unified Inbox 3 of 13 — classifier slice)
**Type:** FEATURE
**Size:** small
**Model tier:** `/normal` (Sonnet) — same classification pattern as UI-2, no architecture decisions
**Spec:** `docs/specs/unified-inbox.md` §§5.1 (`notifications` table), 5.2 (`contacts.notification_weight`), 7.2 (Q10 notification triage), 10.1–10.4 (notification handling), 11 (cross-spec flags), 16 disciplines #52 + #54
**Precedent:** `sessions/ui-2-handoff.md` — UI-2 established the UI-classifier pattern (prompt builder + Zod parse + non-fatal try/catch wire-in at `sync.ts`)

---

## Scope — what lands in this session

1. **`notifications` table** — migration + Drizzle schema per spec §5.1. Shared across inbox + future system notifications (SaaS payment failures, Content Engine milestones, Daily Cockpit anomalies).
2. **Haiku-tier notifier classifier** — `classifyNotificationPriority(msg, threadId)` in `lib/graph/notifier.ts`. Output `{ priority: 'urgent' | 'push' | 'silent', reason }` Zod-validated. Reads `classification_corrections` where `classifier = 'notifier'` as few-shot learning signal.
3. **Prompt builder + context loader** — `lib/graph/notifier-prompt.ts` mirrors `router-prompt.ts` pattern. Loads: message body + subject; thread context (contact relationship_type, is client/active-retainer/open-ticket/waiting-on-Andy flags derivable from thread + contact + deal state); `contacts.notification_weight`; recent classification_corrections for notifier (up to 10).
4. **Push vs silent gate** — write a `notifications` row per classification:
   - `priority` = classifier output
   - `fired_transport = 'none'` for **all** UI-3 results (silent → none per spec; push/urgent → transport not yet built, later UI session wires web_push/pwa_push — leave the placeholder)
   - `reason` = classifier reason
   - `message_id`, `user_id`, `fired_at_ms` set
5. **Populate `messages.notification_priority`** — column already exists on `messages` (landed A6). UI-3 just writes it alongside the notifications row.
6. **Wire into `sync.ts` in parallel with the router** (discipline #52). Refactor the existing `if (direction === "inbound")` block from a single router call to `Promise.allSettled([routerPromise, notifierPromise])`. Both remain non-fatal — a classifier failure cannot block message insert.
7. **Activity log** — on classification, log `inbox_notification_fired` (new kind, already in `ACTIVITY_LOG_KINDS` per A6 consolidation — verify). `meta` includes priority + reason + message_id + thread_id.
8. **Flesh out prompt stub** — update `lib/ai/prompts/unified-inbox.md` § `inbox-classify-notification-priority` from "stub" → "partial" with implementation details (mirror UI-2's router entry).
9. **Tests** — mirror UI-2's test file structure: Zod parse (3–5 tests), prompt builder with varied context (2–3), notifications table insert/priority enum (2), kill-switch gate (1), fallback behaviour (1). Target ~10 meaningful tests.

## Out of scope — do NOT build

- **Web Push / PWA Push transports.** Spec §§10.1–10.2 describe these; spec §17 puts them in wave E alongside the full dispatcher + morning digest. Later UI session.
- **Morning digest (08:00).** UI-13 owns this — it reads from `notifications` where `priority = 'silent'`.
- **Correction loop UI chip** ("Notify me next time from this contact?" / dismiss-without-open down-correction). Thread-detail UI concern — lands with UI-8/UI-11. UI-3 only **reads** existing corrections; it does not write them.
- **Notification dispatcher primitive** (§10.4). That's a Foundations patch + a shared module introduced later; UI-3 writes notifications rows directly (matches the UI-2 inline pattern), a future session extracts the dispatcher.
- **System-notification callsites** (SaaS payment failures, etc.). Those call the future dispatcher; UI-3 is inbox-only.

## Preconditions — verify before touching any code (G1)

1. `lib/graph/router.ts` exists (UI-2) — pattern reference.
2. `lib/graph/router-prompt.ts` exists (UI-2) — pattern reference for context loader + Zod schema.
3. `lib/graph/sync.ts` has the `if (direction === "inbound")` router call block.
4. `lib/db/schema/classification-corrections.ts` exists (UI-2). `classifier` enum includes `'notifier'`.
5. `lib/db/schema/messages.ts` has `notification_priority` column with `NOTIFICATION_PRIORITIES = ['urgent','push','silent']`.
6. `lib/db/schema/contacts.ts` has `notification_weight` column (UI-2).
7. `lib/ai/models.ts` has job slug `"inbox-classify-notification-priority"` mapped to `"haiku"`.
8. `lib/ai/prompts/unified-inbox.md` has stub for `inbox-classify-notification-priority`.
9. Kill switches `inbox_sync_enabled` + `llm_calls_enabled` exist in `lib/kill-switches.ts`.
10. `logActivity()` helper available in `lib/activity-log.ts`.
11. `ACTIVITY_LOG_KINDS` already includes `inbox_notification_fired` (spec §11.3 said "~18 values" added; A6 consolidated). If missing, add it.
12. `modelFor()` helper in `lib/ai/models.ts`.
13. No existing `lib/graph/notifier.ts` / `lib/graph/notifier-prompt.ts` files (UI-3 creates them).
14. No existing `notifications` table / `lib/db/schema/notifications.ts` (UI-3 creates).

Halt + reroute if any 1–12 missing. Items 13–14 must be absent; if present, investigate rather than overwrite.

## File whitelist — what UI-3 may touch

**Create:**
- `lib/db/schema/notifications.ts`
- `lib/db/migrations/0033_ui3_notifications.sql` (+ `meta/_journal.json` entry)
- `lib/graph/notifier.ts`
- `lib/graph/notifier-prompt.ts`
- `tests/graph-notifier.test.ts`

**Edit:**
- `lib/db/schema/index.ts` — re-export notifications
- `lib/graph/sync.ts` — parallel router + notifier wire-in
- `lib/graph/index.ts` — barrel export for notifier module
- `lib/ai/prompts/unified-inbox.md` — populate `inbox-classify-notification-priority` section
- `SESSION_TRACKER.md` — G12 Next Action → UI-4
- `sessions/CLOSURE_LOG.md` — prepend session summary
- (If item 11 above: `lib/activity-log.ts` or wherever `ACTIVITY_LOG_KINDS` lives)

**Must not touch:**
- `lib/graph/router.ts` / `router-prompt.ts` (reference only)
- `contacts.ts` schema (UI-2 owns)
- `messages.ts` schema (A6 + UI-2 own — `notification_priority` already exists)
- Anything under `app/lite/` (no UI in UI-3)

## Settings keys consumed

None. UI-3 is pure classification — no tunable thresholds. Priority tiers are structural enums (urgent/push/silent per spec, not configurable).

## Kill switches

- `inbox_sync_enabled` — notifier skips when off (same as router).
- `llm_calls_enabled` — notifier skips when off.
Both already exist; no new kill switch in UI-3.

## LLM job

- `inbox-classify-notification-priority` → Haiku via `modelFor()`. Slug already registered in `lib/ai/models.ts` (A6).

## Activity log kinds

- `inbox_notification_fired` — one log row per classified inbound. Meta: `{ priority, reason, message_id, thread_id }`.

## Scheduled task types

None added.

## Fallback behaviour

LLM or Zod parse failure → default to `priority: 'silent'` with `reason: 'fallback — LLM/parse error'`. Spec discipline #63 equivalent: noise classifier errs conservative. For the **notifier**, the safe failure is **silent** (missed signal recoverable from digest; spurious urgent push trains dismissal + erodes trust). Diverges from router's `new_lead` fallback intentionally — different failure symmetry.

## Completion contract (G7)

- Typecheck clean (`npx tsc --noEmit` 0 errors).
- `npm test` green, new tests registered.
- `npm run build` clean.
- Migration applied + present in `meta/_journal.json`.
- Manual trace: insert a dummy inbound `messages` row in a test harness and confirm notifier writes both the `notifications` row and `messages.notification_priority` with `inbox_sync_enabled + llm_calls_enabled` ON (dev sim OK).
- Kill-switch off → no LLM call, no notifications row, no messages update, no throw.

## Rollback strategy

**Feature-flag-gated.** `inbox_sync_enabled` + `llm_calls_enabled` both must be ON for notifier to fire. Both ship disabled. Rollback = leave switches off. Migration is additive (new table only). Revert = `git revert` + drop `notifications` table (destructive — declare explicitly in handoff).

## Memory alignment gates (G10.5 reviewer will check)

- **`feedback_technical_decisions_claude_calls`** — silent-lock all implementation choices (fallback direction, context-signal list, parallel-wiring approach). No technical questions to Andy.
- **`project_context_safety_conventions`** — prompt contract documented in `lib/ai/prompts/unified-inbox.md`. Schema file self-contained with spec reference. Migration journal-tracked.
- **`project_llm_model_registry`** — call `modelFor("inbox-classify-notification-priority")`. Never a raw model ID.
- **`feedback_dont_undershoot_llm_capability`** — Haiku reasons about urgency from the described context (relationship_type + active retainer + open ticket + waiting-on-Andy signals) without needing labelled training data. Spec says Haiku; trust it.

## What UI-4 inherits

- Parallel-call block in `sync.ts` (UI-4 extends it to 3-way: router + notifier + signal/noise).
- `notifications` table + schema (UI-4's signal/noise path doesn't write here directly but may log corrections).
- `classification_corrections` consumer pattern (UI-4's classifier reads same table with `classifier = 'signal_noise'`).
- Fallback convention: each classifier picks the conservative side of its own asymmetry.

---

## G0 kickoff ritual

1. Read this brief.
2. Read the last 2 handoff notes: `sessions/ui-2-handoff.md`, `sessions/ui-1-handoff.md`.
3. Read spec §§5.1, 5.2, 7.2, 10, 11, 16 (#52, #54, #63).
4. Load skills: `drizzle-orm`, `typescript-validation`.
5. Verify preconditions 1–14 above.
6. Start with schema + migration, then prompt builder + classifier, then sync.ts wire-in, then tests.
