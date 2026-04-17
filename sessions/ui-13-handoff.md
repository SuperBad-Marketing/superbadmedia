# `ui-13` — Daily 08:00 digest email + voice — Handoff

**Closed:** 2026-04-17
**Wave:** 10 — Unified Inbox (13 of 13 — **final Wave 10 session**)
**Model tier:** Sonnet

---

## What was built

The **morning digest email** — at 08:00 Melbourne daily, Lite sends Andy a voice-treated email summarising everything the inbox handled silently overnight.

**Files created:**

- `lib/graph/digest.ts` — core digest logic. `buildDigestContent(nowMs)` queries `notifications` where `fired_transport = "none"` within the configurable silent window (`inbox.digest_silent_window_hours`, default 24h), joins to `messages` + `threads` for subject/sender data, groups by category (noise → counts only, non-noise → one-line previews), checks for recent history-import completion via `getImportProgress`/`getGraphStateForImport`. Returns null when zero silenced and `inbox.digest_no_send_on_zero` is true (default). `sendDigestEmail(content)` sends via Resend with `classification: "transactional"` to `ADMIN_EMAIL` env var.
- `lib/scheduled-tasks/handlers/inbox-digest.ts` — `inbox_morning_digest` handler. Gated by `inbox_digest_enabled` kill switch. On fire: builds content, sends if non-null, logs `inbox_digest_sent` activity, self-perpetuates by enqueuing the next day's run via `ensureInboxDigestEnqueued()`. DST-safe `next8amMelbourneMs()` using the same `Intl.DateTimeFormat` `formatToParts` pattern as `next23MelbourneMs()` from the hygiene purge handler. Configurable hour via `inbox.digest_hour` setting.
- `lib/db/migrations/0039_ui13_digest_settings.sql` — seeds 3 settings keys: `inbox.digest_hour=8`, `inbox.digest_silent_window_hours=24`, `inbox.digest_no_send_on_zero=true`.
- `docs/content/unified-inbox/digest-email.md` — canonical voice-treated email copy reference (subject lines, body opener, section headers, footer, voice notes).
- `tests/inbox-digest.test.ts` — 9 tests. Zero-silent null return; zero-silent send when disabled; Resend transactional classification; ADMIN_EMAIL skip; kill-switch exit; self-perpetuation on null content; future timestamp; configurable hour; idempotency key.

**Files edited:**

- `lib/db/schema/activity-log.ts` — added `inbox_digest_sent` kind.
- `lib/kill-switches.ts` — added `inbox_digest_enabled` (default OFF).
- `lib/settings.ts` — added 3 digest keys to typed registry.
- `lib/scheduled-tasks/handlers/index.ts` — registered `INBOX_DIGEST_HANDLERS`.
- `lib/graph/index.ts` — added comment explaining why `digest.ts` is NOT barrel-exported (transitive Resend SDK import breaks build via Graph API callback route).
- `lib/db/migrations/meta/_journal.json` — added entry idx 39.
- `tests/settings.test.ts` — updated count assertions from 101 to 104.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **digest.ts NOT barrel-exported from lib/graph/index.ts.** Adding `digest.ts` to the barrel pulls `sendEmail` → Resend SDK transitively into `/api/oauth/graph-api/callback`, which breaks the production build. The handler imports `digest.ts` directly; the barrel gets a comment explaining the exclusion.
2. **`ADMIN_EMAIL` env var for recipient.** The digest goes to Andy, not to a client. Avoids hard-coding an email address. Skips gracefully if unset.
3. **Noise subclass grouping.** Noise messages group by their `noise_subclass` (transactional, marketing, automated, update) for meaningful counts. Non-noise silenced messages (unusual but possible per spec) get one-line subject+sender previews.
4. **DST-safe scheduling via `Intl.DateTimeFormat`.** Same pattern as the hygiene purge handler — no timezone library dependency.
5. **Configurable hour via settings.** `inbox.digest_hour` defaults to 8 but can be changed without a deploy. The `nextMelbourneHourMs` utility is generic.
6. **Import completion note via `updatedAtMs`.** `ImportProgress` doesn't have a `completedAtMs` field; `updatedAtMs` reflects when status flipped to `complete`.

## Verification (G0–G12)

- **G0** — brief read (`sessions/ui-13-brief.md`). UI-12/UI-11 handoffs read.
- **G1** — 10 preconditions verified. Two path divergences from brief: `logActivity` at `lib/activity-log.ts` (not `lib/db/schema/activity-log.ts`), `formatTimestamp` at `lib/format-timestamp.ts` (not `lib/timestamps.ts`). Both functional.
- **G2** — files match brief §5 whitelist plus `lib/scheduled-tasks/handlers/index.ts` (necessary handler registration wiring).
- **G3** — no motion in this session (backend email handler).
- **G4** — no numeric/string literals in autonomy-sensitive paths. All configurable values read from settings: `inbox.digest_hour`, `inbox.digest_silent_window_hours`, `inbox.digest_no_send_on_zero`.
- **G5** — context budget held. Small session as estimated.
- **G6** — feature-flag-gated. Kill switch `inbox_digest_enabled` (default OFF). Migration 0039 is additive (INSERT OR IGNORE).
- **G7** — 0 TS errors, 144 test files / 1050 passed + 1 skipped (+9 new), clean production build, lint at 35 errors (baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1050 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 35 errors (baseline).
- **G9** — no desktop regression (backend only, no UI route).
- **G10** — not applicable (no UI surface).
- **G10.5** — fidelity gate (non-UI session): acceptance-criterion keywords verified in diff (silent notifications query, category grouping, no-send-on-zero, self-perpetuating, kill-switch-gated, voice-treated, import completion). No file-whitelist violations. No memory-alignment violations.
- **G11** — this file.
- **G12** — tracker flip + CLOSURE_LOG + PATCHES_OWED + commit.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all 6 implementation choices silently locked.
- **`feedback_no_content_authoring`** — voice copy is inline, short, dry. No Loom, no manual screenshots.
- **`feedback_no_lite_on_client_facing`** — admin-only email; subject line says "SuperBad Lite" in the footer area only (internal tool reference), not in any client-visible surface.
- **`project_settings_table_v1_architecture`** — all 3 configurable values in settings table, not code constants.
- **`project_context_safety_conventions`** — `lib/graph/digest.ts` is server-only; no browser imports.

## PATCHES_OWED (raised this session)

- **`ui_13_digest_bootstrap_wiring`** — the digest task needs an initial enqueue somewhere (likely Graph API setup wizard completion, matching `ensureInboxHygieneEnqueued()`). `ensureInboxDigestEnqueued()` is exported and ready. Wire it or log as a later wizard-integration session.
- **`ui_13_admin_email_env_var`** — `ADMIN_EMAIL` needs to be added to `.env.example` and the env validator in `lib/env.ts`.
- **`ui_13_digest_barrel_export_excluded`** — `lib/graph/index.ts` intentionally does NOT barrel-export `digest.ts`. Any future consumer must import directly from `@/lib/graph/digest`. The root cause is the Resend SDK transitive import breaking the build via `/api/oauth/graph-api/callback`. A longer-term fix would be to split the graph barrel into sub-barrels or lazy-import the email adapter.
- **`ui_13_preview_cap_to_settings`** — non-noise preview cap is hardcoded at 5 in `buildBodyHtml`. Candidate for `inbox.digest_preview_cap` settings key if Andy wants it configurable.

## Rollback strategy

`feature-flag-gated`. Kill switch `inbox_digest_enabled` (default OFF). Migration 0039 is additive (INSERT OR IGNORE settings rows). Reverting the new files + edits removes:
- Digest handler + logic + tests.
- 3 settings rows (harmless if orphaned).
- Activity log enum extension (additive, harmless if unused).

## What the next session (OS-1) inherits

UI-13 is the final Wave 10 session. **Wave 10 — Unified Inbox is complete.** The next session is **OS-1** (Wave 11 — Onboarding + Segmentation).

OS-1 inherits nothing specific from the digest handler. General Wave 10 inheritance:
- **`ADMIN_EMAIL` env var** — the digest handler introduced this. OS-1 or a foundation patch session should add it to `.env.example` + env validator.
- **`ensureInboxDigestEnqueued()`** and `ensureInboxHygieneEnqueued()` — both need bootstrap wiring from the Graph API setup wizard completion. The wizard build session should call both on completion.
- **Handler registry pattern** — `lib/scheduled-tasks/handlers/index.ts` is the single dispatch map. New handlers register by exporting a `*_HANDLERS` map and spreading it into the registry.
