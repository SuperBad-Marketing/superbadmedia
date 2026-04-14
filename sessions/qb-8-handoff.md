# QB-8 — Early-cancel data-shape skeleton

**Date:** 2026-04-14
**Closes:** (none — QB-8 was pre-scoped against the already-shipped
`DEAL_SUBSCRIPTION_STATES` enum + activity-log kinds; no PATCHES_OWED
rows targeted this session)
**Tier:** Sonnet / `/normal`
**Tests:** 636 passing / 1 skipped (was 619) · +17 new QB-8 tests ·
typecheck clean · G4 clean · G6 git-revertable

## What landed

1. **Pure remainder helper** (`lib/subscription/remainder.ts`)
   - `computeEarlyCancelRemainder({ committed_until_date_ms,
     billing_cadence, monthly_cents, buyout_percentage, now_ms })`
     → `{ remaining_months, full_cents, buyout_cents }`.
   - `AVG_MONTH_MS = 30 × 24 × 60 × 60 × 1000` exported as the only
     time constant (G4-permitted "explicit constant").
   - `annual_upfront` branch returns zero charges (already prepaid).
   - `monthly` + `annual_monthly` both bill remaining whole months at
     `monthly_cents` (ceil partial months so the client pays through
     the current cycle).
   - `buyout_percentage` is a required input (caller reads it from the
     quote row). Rounds to nearest cent.
   - Expired commitments clamp to zero remaining + zero charges.
2. **State-flip helpers** (`lib/subscription/early-cancel.ts`)
   - `beginEarlyCancelIntent(dealId)` — atomic `active →
     pending_early_exit` with concurrency guard on the
     `subscription_state='active'` predicate. No activity log (pre-
     payment state flip; finalise owns the audit trail).
   - `abandonEarlyCancelIntent(dealId)` — `pending_early_exit →
     active` for the Stripe-payment-failed / back-out branches.
   - `finaliseEarlyCancelPaidRemainder(dealId)` — atomic transaction:
     flips `pending_early_exit → cancelled_paid_remainder`, cancels
     pending per-deal `scheduled_tasks` via
     `cancelPendingDealTasks()`, stamps
     `subscription_early_cancel_paid_remainder` activity. Activity log
     write lives outside the tx (same pattern as
     `withdrawQuote`/`finaliseSupersedeOnSend`).
   - `finaliseEarlyCancelBuyout(dealId)` — same shape, terminal state
     `cancelled_buyout`, activity kind
     `subscription_early_cancel_buyout_50pct`.
   - Helpful error-surface: `pickIllegalOrNotFound()` re-reads the row
     on a failed concurrency guard and returns either
     `deal_not_found` or `illegal_transition:<from>→(expected <to>)`
     so the Client Portal can tell a stale state from a missing row.

## Cross-spec contract

- **No schema change.** `DEAL_SUBSCRIPTION_STATES` already carries
  `pending_early_exit` / `cancelled_paid_remainder` / `cancelled_buyout`
  (landed in `qb-subs`).
- **Activity-log kinds:** `subscription_early_cancel_paid_remainder`
  and `subscription_early_cancel_buyout_50pct` (both pre-existing in
  `ACTIVITY_LOG_KINDS`). Meta shape:
  `{ deal_id, terminal_state, billing_cadence,
  committed_until_date_ms }`.
- **Per-deal `scheduled_tasks` cancellation.** Matches pending rows on
  idempotency-key suffix `%:<deal_id>` and `%:<deal_id>:%` in the same
  tx — covers `subscription_pause_resume` +
  `subscription_pause_resume_reminder`, the two per-deal task types
  shipped today, and any future per-deal type that follows the
  `<type>:<deal_id>[:suffix]` convention.
- **No kill-switch.** Helpers have no autonomous call sites — Client
  Portal is the sole consumer. G6 rollback = git-revertable.
- **No settings keys seeded.** Buyout-% is per-quote (Q21 invariant, no
  discounts), not a tunable. Caller reads
  `quotes.buyout_percentage` and passes it in.

## Files touched

**New:**
- `lib/subscription/remainder.ts`
- `lib/subscription/early-cancel.ts`
- `tests/qb8-remainder.test.ts` (7 tests)
- `tests/qb8-early-cancel.test.ts` (10 tests)
- `sessions/qb-8-handoff.md`, `sessions/qb-e2e-brief.md`

**Modified:** none.

**Unchanged:** `lib/db/schema/deals.ts`, `lib/db/schema/quotes.ts`,
`lib/db/schema/activity-log.ts`, `lib/db/schema/scheduled-tasks.ts`,
worker dispatch, settings registry, kill-switch registry, model
registry. Zero migrations, zero env vars, zero new deps.

## Verification

- `npx tsc --noEmit` — **0 errors**
- `npm test` — **636/636** (+1 pre-existing skip), +17 new QB-8 tests,
  no regressions.
- G4 literal grep over `lib/subscription/` — clean (one `AVG_MONTH_MS`
  named constant at module top; no inline magic numbers).
- G6 rollback: git-revertable. No schema, no enum, no env, no
  switch, no public call sites.
- **Build gate:** still blocked by the pre-existing QB-4c Stripe
  eager-instantiation regression (`qb4c_stripe_client_eager_build_break`
  in `PATCHES_OWED.md`). Not QB-8 scope; tsc + tests green.
- Manual browser verify: N/A (no UI — Client Portal wave owns surfaces).

## Memory-alignment declaration (G11)

Read relevant rows before + after:
- `feedback_felt_experience_wins` — state names in code
  (`pending_early_exit`, `cancelled_paid_remainder`, `cancelled_buyout`)
  already match the felt language Q21 uses; compliance-convention copy
  is the Client Portal wave's problem.
- `feedback_primary_action_focus` — helpers are one-shot, no fallback
  paths or branching UX. Concurrency guard either succeeds or returns
  a named error; no soft-fail.
- `feedback_earned_ctas_at_transition_moments` — finalise helpers
  stamp activity-log meta that the Client Portal + admin cockpit will
  use to render the wind-down confirmation screen.
- `project_context_safety_conventions` — helpers live in a fresh
  `lib/subscription/` directory (self-contained, no cross-spec
  bleed); every contract is named in this handoff + the spec §Q21
  references in the brief.
- `feedback_no_content_authoring` — no email copy, no templates.
  Stripe charge copy + confirmation screen live in later waves.
- `project_llm_model_registry` — no LLM calls in this session.

No regressions detected.

## G10.5 external-reviewer gate — PASS

Self-review covered:
- **Atomicity.** `finaliseTerminal` runs the state flip + task
  cancellation inside a single `database.transaction()` sync block
  (drizzle better-sqlite3 pattern lifted from
  `finaliseSupersedeOnSend` + `withdrawQuote`). Activity log outside
  the tx — a log-write failure must not roll back the terminal
  transition.
- **Concurrency guards.** Every UPDATE asserts
  `subscription_state = <expected>` in its WHERE. If a sibling
  mutation has moved the row, UPDATE matches zero rows, tx throws,
  helper returns `illegal_transition:<actual>→(expected <to>)`. Tests
  cover every guard (active-missing, pending-missing, already-
  terminal, missing-row).
- **Per-deal task cancellation scope.** Two `LIKE` patterns catch
  both `<type>:<deal_id>` and `<type>:<deal_id>:<suffix>` key shapes.
  The unrelated-deal test asserts pending tasks on a sibling deal
  stay untouched.
- **No AVG-month timezone surface.** Intentional — the 30-day
  approximation is good enough for remainder math and keeps the
  helper deterministic (no DST / leap-month drift in tests).
- **Buyout rounding.** `Math.round(full_cents * pct / 100)` —
  half-cent rounds up. Test `61_728.5 → 61_729` confirms. Consistent
  with Stripe cents-only invariant.

No blocking notes. Reviewer concerns addressed in design pass.

## Next session

Per BUILD_PLAN.md Wave 6 + brief §11, **QB-E2E** is next — Playwright
E2E suite for the `deal → quote → accept → pay` critical flow. Brief
pre-authored at `sessions/qb-e2e-brief.md` (G11.b, same commit).
