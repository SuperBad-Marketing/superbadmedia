# `ui-12` — History import wizard + 12-month backfill + progress tracking — Brief

> **Pre-compiled at UI-11 G11.b close-out per AUTONOMY_PROTOCOL.md §G11.b.**
> Read this brief. Do **not** read all 21 specs. If any precondition in §7 is missing, stop (G1).

**Wave:** 10 (Unified Inbox 12 of 13)
**Type:** FEATURE — data import pipeline + wizard UI + progress tracking
**Size:** medium — Graph API paginated history fetch, background `inbox_history_import_backfill` scheduled task, setup wizard step with live progress bar, post-import contact routing review, optional noise cleanup
**Model tier:** Sonnet — standard data-pipeline + wizard build, no gesture/mobile/architectural complexity
**Spec:** `docs/specs/unified-inbox.md` §11 (Q11 — history import), §13 Steps 3–5 (Setup wizard steps for history import + contact routing + noise cleanup)
**Precedent:**
- `sessions/ui-11-handoff.md` — Mobile inbox; offline cache architecture; thread/actions server action pattern.
- `sessions/ui-10-handoff.md` — Ticket overlay; server action module pattern.
- `sessions/sw-1-handoff.md` — Setup wizard shell (`<WizardShell>`) and step library architecture.
- `sessions/a6-handoff.md` — Scheduled tasks + worker infrastructure.

---

## 1. Identity

- **Session id:** `ui-12`
- **Wave:** 10 — Unified Inbox (12 of 13)
- **Type:** FEATURE
- **Model tier:** Sonnet
- **Sonnet-safe:** yes — paginated Graph API fetch, scheduled-task handler, wizard step UI with progress bar, contact routing review surface. No multi-component recomposition or gesture complexity.
- **Estimated context:** medium — reads SW-1 handoff (wizard shell), A6 handoff (scheduled tasks), spec §11 + §13 steps 3–5. Budget G5 (70%) carefully.

## 2. Spec references (summarised — don't reread unless ambiguity arises)

- **Q11:** 12-month window imported on setup. Older history on-demand backfill per thread. Background sync job with progress.
- **§13 Step 3:** Progress bar with live counts ("Imported 487 of ~6,200 messages…"). Continues in background if Andy moves on — non-blocking. Completion summary with signal/noise/spam breakdown.
- **§13 Step 4:** Post-import contact routing review. Claude auto-created contacts for routed messages. Summary + expandable list for re-routing. Corrections log.
- **§13 Step 5:** Noise-folder initial cleanup (optional). Auto-purge noise older than 30d, or keep.
- **Schema:** `messages.import_source` enum (`live | backfill_12mo | backfill_on_demand`). Existing from A6 schema.
- **Settings key:** `inbox.history_import_months` (default likely 12).
- **Cron:** `inbox_history_import_backfill` — on-demand, gated by `inbox_sync_enabled`.

## 3. Acceptance criteria

```
History import runs as a background scheduled task after M365 OAuth
completes. Fetches last 12 months of email via Graph API paginated
requests (50 per page), classifies each message (signal/noise/spam via
existing 3-way classifier pipeline), creates contacts for unmatched
senders, and stores in the messages/threads tables with
import_source='backfill_12mo'.

Setup wizard step shows a live progress bar ("Imported X of ~Y
messages…") that polls the scheduled task's progress. Non-blocking —
Andy can navigate away and the import continues.

On completion: summary screen with signal/noise/spam counts and a
"Ready to review?" prompt.

Post-import contact routing review: summary of auto-created contacts
grouped by type (leads, suppliers, personal). Expandable list for
re-routing individual contacts. Corrections logged.

Optional noise cleanup: offer to soft-delete noise older than 30d
(14-day recovery). Skip keeps them.
```

## 4. Files in play

**Create:**
- `lib/graph/history-import.ts` — Graph API paginated history fetch. `importHistoryBatch(client, { monthsBack, cursor, batchSize })` → `{ messages, nextCursor, estimatedTotal }`. Marks `import_source = 'backfill_12mo'`.
- `lib/scheduled-tasks/handlers/inbox-history-import.ts` — handler for `inbox_history_import_backfill`. Paginates through history, runs classifier pipeline per message, tracks progress in task metadata.
- `app/lite/setup/inbox-history/page.tsx` (or wizard step component) — setup wizard step with live progress polling, completion summary, contact routing review, noise cleanup.
- `tests/inbox-history-import.test.ts` — handler tests with mocked Graph client.

**Edit:**
- `lib/scheduled-tasks/task-types.ts` — wire `inbox_history_import_backfill` handler.
- `lib/scheduled-tasks/worker.ts` — register handler.
- Possibly `lib/graph/sync.ts` — if shared helpers need extraction.

**Must not touch:**
- `lib/offline/inbox-cache.ts` (browser-only, unrelated).
- `app/lite/inbox/_components/*` (mobile/desktop inbox UI frozen).
- All server action modules from prior sessions.

## 5. Tests to write

- `tests/inbox-history-import.test.ts` — ~4 tests. Mock Graph client returns paginated responses; handler processes batch and stores messages with correct `import_source`; handler respects `inbox_sync_enabled` kill switch; progress metadata updated after each batch.

## 6. Voice surfaces

- **Progress bar:** "Imported 487 of ~6,200 messages…"
- **Completion summary:** "Imported 6,231 messages. 4,112 signal, 1,847 noise, 272 spam auto-archived. Ready to review?"
- **Contact routing:** "I matched 134 messages to existing contacts. Created 27 new leads, 43 suppliers, 18 personal contacts. Want to review any before we go live?"
- **Noise cleanup:** "About 2,100 imported messages are noise older than 30 days. Auto-purge them now to start fresh, or keep them for reference?"

## 7. Preconditions to verify at G1

- [ ] `inbox_history_import_backfill` exists in `ScheduledTaskType` enum.
- [ ] `messages.import_source` column exists with correct enum values.
- [ ] `inbox.history_import_months` settings key is seeded.
- [ ] `inbox_sync_enabled` kill switch exists.
- [ ] Setup wizard shell (`<WizardShell>`) is functional (SW-1).
- [ ] 3-way classifier pipeline (UI-2/3/4) is callable from the import handler.
- [ ] Graph API client available (`lib/graph/client.ts` or equivalent).

## 8. Kill switches + rollback

- Gated by `inbox_sync_enabled` (existing).
- Rollback: scheduled task is on-demand — stop enqueuing. Imported messages can be identified by `import_source = 'backfill_12mo'` and bulk-deleted if needed. Git-revertable.

## 9. Gates that apply

- G0 — read this brief + UI-11/UI-10 handoffs + SW-1 handoff.
- G1 — verify §7 preconditions.
- G2 — files-in-play match §4 whitelist.
- G5 — context budget: do not roll in daily digest (UI-13) or mobile search.
- G7 — 0 TS errors, full suite green, clean build, lint unchanged.
- G8 — `npx tsc --noEmit` + `npm test` + `npm run build` + `npm run lint`.
- G10 — manual browser verify: trigger history import, watch progress bar, verify completion summary, review contact routing, test noise cleanup.
- G10.5 — external reviewer against this brief + spec §11 + §13 steps 3–5.
- G11 — handoff note; UI-13 brief pre-compile.
- G12 — tracker flip + CLOSURE_LOG + PATCHES_OWED + commit.

## 10. Notes for the next-session brief writer (UI-13)

UI-13 is the **Daily 08:00 digest email + voice** — the final Wave 10 session. Check BUILD_PLAN.md for the canonical scope. The digest reads from the inbox data (threads, messages, classifications) and sends a morning email. No mobile integration needed.

## 11. Memory-alignment checklist for the build session

- `feedback_technical_decisions_claude_calls` — lock Graph pagination strategy, batch size, classifier integration pattern silently.
- `feedback_setup_is_hand_held` — wizard step is step-by-step with clear progress and a non-blocking escape hatch.
- `feedback_no_content_authoring` — voice copy inline, short, in-voice.
- `feedback_no_lite_on_client_facing` — admin-only setup surface.
- `project_settings_table_v1_architecture` — `inbox.history_import_months` in settings, not code constant.
- `project_context_safety_conventions` — import handler reads Graph, writes to SQLite; no browser code.
