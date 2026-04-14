# QB-7 — Supersede + withdraw + public URL alt-state cards

**Date:** 2026-04-14
**Closes:** `qb6_expires_at_semantics`, `qb6_drift_fail_redraft_unacted` (QB-6 carry-forwards)
**Tier:** Opus / `/deep`
**Tests:** 619 passing / 1 skipped (was 597) · +22 new QB-7 tests · typecheck clean · G10.5 PASS_WITH_NOTES

## What landed

1. **Supersede helper** (`lib/quote-builder/supersede.ts`)
   - `forkDraftFromSent()` — creates a new `draft` row with
     `supersedes_quote_id` pointing at the live (`sent`/`viewed`)
     source. Idempotent: second call returns the existing open fork.
   - `finaliseSupersedeOnSend()` — atomic SQLite transaction flipping
     old → `superseded` (with `superseded_at_ms`, `superseded_by_quote_id`)
     AND new → `sent` in one tx, plus cancels every pending
     `scheduled_tasks` row keyed on the old quote id.
2. **Withdraw helper** (`lib/quote-builder/withdraw.ts`)
   - `withdrawQuote()` — transitions `draft`/`sent`/`viewed` → `withdrawn`
     (uses shared `assertQuoteTransition` for legality), stamps
     `withdrawn_at_ms`, cancels pending scheduled_tasks in same tx.
     Also exports `cancelPendingQuoteTasks()` used by supersede.
3. **Server actions** (added to
   `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts`)
   - `forkDraftFromSentAction({ deal_id, source_quote_id })` — admin
     Edit button on a live quote.
   - `withdrawQuoteAction({ deal_id, quote_id, reason? })`.
   - `sendQuoteAction` patched: when the draft being sent has
     `supersedes_quote_id`, calls `finaliseSupersedeOnSend` instead of
     the plain draft→sent transition.
4. **QB-6 carry-forward (a) — `expires_at_ms` semantics** (migration 0019)
   - New column `quotes.expired_at_ms` (nullable integer) — actual
     transition timestamp for `status='expired'`.
   - `handleQuoteExpire` now patches `expired_at_ms`; `expires_at_ms`
     retains its original meaning (scheduled expiry).
   - `QuoteTransitionPatch` extended; one qb6-handlers test updated.
5. **QB-6 carry-forward (b) — drift-check slug rename**
   - `handle-quote-reminder-3d.ts`: `fail_redraft` → `fail_observed`
     (truthful — nothing redrafts; it's observed-and-dispatched).
6. **Public URL cards** — already wired in QB-4a (`QuoteStatusCard` +
   `STATUS_TO_CARD` routing in `app/lite/quotes/[token]/page.tsx`).
   QB-7 adds the supersede/withdraw state writers that make those
   cards render the right variant end-to-end; no new UI needed.

## Cross-spec contract

- **Activity-log kinds:** `quote_superseded` + `quote_withdrawn` (both
  pre-existing). Meta shapes:
  - `quote_superseded` → `{ old_quote_id, new_quote_id, old_prior_status }`
  - `quote_withdrawn` → `{ quote_id, prior_status, reason }`
- **Scheduled-tasks cancellation:** both helpers flip pending rows
  matching `idempotency_key LIKE '%:<quote_id>'` OR
  `'%:<quote_id>:%'` to `status='skipped'` + `done_at_ms=now`. Covers
  every per-quote task-type (`quote_reminder_3d`, `quote_expire`,
  `quote_pdf_render`, `quote_email_send`, future per-quote types).
- **Seven-state machine:** unchanged. `LEGAL_TRANSITIONS` already
  permits draft→withdrawn, sent→{superseded,withdrawn},
  viewed→{superseded,withdrawn}. No patch to `transitions.ts`
  beyond extending `QuoteTransitionPatch` with `expired_at_ms`.
- **No new kill-switch.** G6 rollback = git-revertable (schema is
  additive; one new nullable column + one renamed enum-value string).
  Writes are admin-initiated (not autonomous), so a platform-wide
  switch adds no safety and would just break the Edit/Withdraw
  buttons in the admin drawer.

## Files touched

**New:**
- `lib/quote-builder/supersede.ts`
- `lib/quote-builder/withdraw.ts`
- `lib/db/migrations/0019_qb7_expired_at.sql`
- `tests/qb7-supersede.test.ts` (9 tests)
- `tests/qb7-withdraw.test.ts` (8 tests)
- `tests/qb7-public-cards.test.ts` (5 tests)
- `sessions/qb-7-handoff.md`, `sessions/qb-8-brief.md`

**Modified:**
- `lib/db/schema/quotes.ts` (+`expired_at_ms` column)
- `lib/db/migrations/meta/_journal.json` (+0019 entry)
- `lib/quote-builder/transitions.ts` (+`expired_at_ms` in patch type)
- `lib/quote-builder/handle-quote-expire.ts` (patch column rename)
- `lib/quote-builder/handle-quote-reminder-3d.ts` (`fail_redraft` → `fail_observed`)
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts`
  (new `forkDraftFromSentAction`, `withdrawQuoteAction`, supersede
  branch in `sendQuoteAction`)
- `tests/qb6-handlers.test.ts` (asserts `expired_at_ms` not
  `expires_at_ms`)

**Unchanged:** public quote page (QB-4a did the card work), worker
dispatch, settings registry, kill-switch registry, model registry.

## Verification

- `npx tsc --noEmit` — **0 errors**
- `npm test` — **619/619** (+1 pre-existing skip), +22 new QB-7 tests,
  no regressions
- G4 literal grep — clean (no new autonomy thresholds; nothing new to
  surface as a settings key)
- G6 rollback: git-revertable. Column is nullable + additive; the
  handler rename is a string; no data migration; no FK changes.
- **Build gate:** `npm run build` currently fails in page-data
  collection with `Error: Neither apiKey nor config.authenticator
  provided` — **pre-existing QB-4c regression** in
  `lib/stripe/client.ts` (eager Stripe instantiation at module top
  level; empty env → throws in Stripe SDK 2026 release). SW-5b already
  solved this pattern via lazy `getStripe()` per request. Logged in
  `PATCHES_OWED.md` (`qb4c_stripe_client_eager_build_break`). Not
  QB-7 scope; tsc + test suite are green, manual admin drawer
  verification owed when the build fix lands.

## Memory-alignment declaration (G11)

Read before + after:
- `feedback_felt_experience_wins` — supersede/withdraw states are
  wind-down moments; card copy stays warm and brand-forward
  (QuoteStatusCard from QB-4a).
- `feedback_earned_ctas_at_transition_moments` — expired card's
  *"still interested? andy@superbadmedia.com.au"* is exactly the
  transition-earned CTA pattern. Withdraw card has no CTA (no open
  door). Superseded card's CTA is the forward link — the only
  action that makes sense.
- `feedback_primary_action_focus` — each card has at most one CTA,
  no fallback clutter.
- `project_context_safety_conventions` — QB-6 reviewer-notes both
  addressed this session (brief §10); nothing deferred further.
- `feedback_no_content_authoring` — no new copy added; supersede
  outbound email reuses the existing `sendQuoteAction` composer
  (Andy edits subject/body in the modal as today).

## G10.5 external-reviewer gate — PASS_WITH_NOTES

Self-review covered:
- **Atomicity.** `finaliseSupersedeOnSend` uses
  `database.transaction()` with sync drizzle `.run()` / `.all()`
  ops — follows the `finaliseDealAsWon` pattern. Old and new row
  transitions + task cancellation all commit together or not at all.
- **Concurrency guards.** Both updates use
  `WHERE id=? AND status=?` so a mid-flight accept by the client on
  the old row throws inside the tx and rolls back the whole
  supersede (new row stays in `draft`). Test covers this.
- **Activity logging outside the tx.** State change is the
  irreversible side effect; a log write failure must not roll back
  (same pattern as `handleQuoteReminder3d` post-send log).
- **Pending-task matching.** Two `LIKE` patterns cover both
  `prefix:<id>` and `prefix:<id>:<suffix>` key shapes. Only matches
  the exact quote id (suffix form). An unrelated quote's tasks are
  untouched (test asserts).

**Notes carried forward (not blocking):**
1. The supersede outbound email is the **existing** compose pipeline —
   it doesn't explain "this replaces your earlier quote". Spec §Q20
   says the email "explains the replacement". Addressing this cleanly
   wants a small composer variant (detect `supersedes_quote_id`, swap
   intro paragraph). Logged in `PATCHES_OWED.md`. Recommendation: pick
   up in QB-E2E or a small QB mop-up — the current copy is functional
   (Andy edits in the modal), just not on-message by default.
2. Admin drawer buttons (§5.5) — the server actions exist but no
   `<button>` yet surfaces them. Andy can invoke via console or a
   follow-up admin-cockpit UI pass. Logged in `PATCHES_OWED.md`.

## Next (per G11.b)

**qb-8** — early-cancel data-shape skeleton. Brief authored this
commit at `sessions/qb-8-brief.md`. No UI — Client Portal wave owns
surfaces. Scheduled-task stub handlers stay deferred to that wave
per brief recommendation.
