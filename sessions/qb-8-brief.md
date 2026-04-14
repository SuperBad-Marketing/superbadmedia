# `qb-8` — Early-cancel flow skeleton (data shape only) — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0. Read only this file at session start.**

---

## 1. Identity

- **Session id:** `qb-8`
- **Wave:** 6 — Quote Builder
- **Type:** `FEATURE` (data shape only — no UI)
- **Model tier:** `/quick` or `/normal` (Sonnet) — narrow scope, no
  state-machine risk; no public surfaces; no LLM calls.
- **Sonnet-safe:** `yes`
- **Estimated context:** `small`

## 2. Spec references

- `docs/specs/quote-builder.md` §Q21 — commitment enforcement +
  retention; three retainer options; three SaaS options.
- `docs/specs/quote-builder.md` §6.2.1 (lines ~427–450) —
  `subscription_state` enum (already shipped), activity-log kinds
  `subscription_early_cancel_paid_remainder` and
  `subscription_early_cancel_buyout_50pct` (already shipped in
  `activity-log.ts`).
- `docs/specs/quote-builder.md` §8.3 (lines ~811–820) — on-success
  state writes (`cancelled_paid_remainder`, `cancelled_buyout`).

## 2a. Visual references

- **None.** Client Portal wave owns all surfaces. This session ships
  data shape + pure helpers only. No HTML/CSS touched.

**Intentional divergences:** n/a.

## 3. Acceptance criteria (verbatim — from spec §Q21 + §8.3)

```
§Q21 — Retainer early cancel (3 options):
  1. "let's chat" intercept — no charge, no state change
  2. pay remainder — Stripe charge for remaining committed cycles,
     set subscription_state='cancelled_paid_remainder'
  3. 50% buyout — Stripe charge for 50% of remaining,
     set subscription_state='cancelled_buyout'
  All three: log the matching activity kind.

§8.3 — On-success side effects:
  - Stripe subscription cancelled immediately (not at period end)
  - deals.subscription_state flips to the matching terminal state
  - activity_log entry written
  - Confirmation screen redirect (owned by Client Portal wave)

Data shape only — actual charges + subscription cancel + confirmation
redirect land in the Client Portal wave. QB-8 ships:
  (a) `pending_early_exit` helper that atomically flips
      deals.subscription_state=active → pending_early_exit in prep
      for the confirmation click.
  (b) Finalise helpers for paid_remainder + buyout_50pct that flip
      pending_early_exit → the matching terminal state, stamp
      activity-log, and return a pure "what-needs-to-happen" result
      the Client Portal wave can consume.
  (c) Pure remainder-calculation helper:
      computeEarlyCancelRemainder({ committed_until_date_ms,
      billing_cadence, monthly_cents }) → { full_cents, buyout_cents }.
      No Stripe calls — just arithmetic over billing cycles.
```

## 4. Skill whitelist

- `systematic-debugging` — subscription state transitions are
  error-prone.
- `code-review` — helpers should be pure where possible, transaction-
  atomic where not.

## 5. File whitelist

- `lib/subscription/early-cancel.ts` — NEW — pure helpers +
  state-flip helpers. Owns `pending_early_exit → cancelled_*`
  transitions.
- `lib/subscription/remainder.ts` — NEW — pure arithmetic for
  full-remainder and 50% buyout cents. No DB.
- `lib/db/schema/deals.ts` — **no change expected.** Enum already
  includes all needed states (confirmed in QB-7 brief §10 + QB-subs
  handoff). Grep before touching.
- `tests/qb8-early-cancel.test.ts` — NEW — covers state transitions
  + happy/edge paths for all three retainer options.
- `tests/qb8-remainder.test.ts` — NEW — pure arithmetic tests.
- `sessions/qb-8-handoff.md` — NEW.
- `sessions/qb-e2e-brief.md` — NEW (per G11.b) — Playwright E2E
  suite brief for the deal → quote → accept → pay critical flow.

## 6. Settings keys touched

- **Reads:** none new.
- **Seeds (new keys):** none. Buyout percentage lives on
  `quotes.buyout_percentage` per-quote (default 50) — spec says "no
  discounts, ever" and the 50% is a Q21 invariant, not a tunable.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `DEAL_SUBSCRIPTION_STATES` enum has `pending_early_exit`,
  `cancelled_paid_remainder`, `cancelled_buyout`, `cancelled_post_term`,
  `ended_gracefully` — `grep -n "pending_early_exit\|cancelled_paid_remainder\|cancelled_buyout" lib/db/schema/deals.ts`
- [ ] `buyout_percentage` column on quotes — already confirmed QB-1
  schema (`grep "buyout_percentage" lib/db/schema/quotes.ts`).
- [ ] Activity-log kinds `subscription_early_cancel_paid_remainder`
  and `subscription_early_cancel_buyout_50pct` — `grep "subscription_early_cancel" lib/db/schema/activity-log.ts`
- [ ] No existing `lib/subscription/` directory — this session opens
  it (`ls lib/subscription/ 2>/dev/null`).

## 8. Rollback strategy (G6)

`git-revertable`. No schema migration. No enum extension (already
landed). No env vars. No kill-switch. Pure helpers + state-flip
helpers behind no public call sites — Client Portal wave is the only
consumer and ships later.

## 9. Definition of done

- [ ] Pure `computeEarlyCancelRemainder()` with explicit unit tests
  for monthly / annual_monthly / annual_upfront cadences.
- [ ] `beginEarlyCancelIntent(dealId)` — atomic
  `active → pending_early_exit` transition with concurrency guard.
- [ ] `finaliseEarlyCancelPaidRemainder(dealId)` and
  `finaliseEarlyCancelBuyout(dealId)` — atomic
  `pending_early_exit → cancelled_*`, stamp activity log, cancel
  any pending per-deal scheduled_tasks (shape only — no Stripe).
- [ ] `abandonEarlyCancelIntent(dealId)` — `pending_early_exit → active`
  for the "let's chat" / back-out path.
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green (target ~635+)
- [ ] G4 literal grep — any numeric literals in remainder math must
  be explicit constants or sourced from the deal row.
- [ ] G10.5 external-reviewer gate — PASS or PASS_WITH_NOTES
- [ ] Memory-alignment declaration in handoff
- [ ] G0 → G12 clean handoff + qb-e2e brief authored in same commit
  (G11.b)

## 10. Cross-spec / carry-forward

**From QB-7 (pass-through, not blockers):**
1. Supersede outbound email variant — logged in `PATCHES_OWED.md`.
   Not a QB-8 concern.
2. Admin drawer buttons for Edit/Withdraw — logged in
   `PATCHES_OWED.md`. Not a QB-8 concern.
3. `qb4c_stripe_client_eager_build_break` — pre-existing build
   failure in `lib/stripe/client.ts`. Also not a QB-8 concern, but
   if it blocks `npm run build` in this session too, acknowledge in
   handoff and move on (tsc + tests are the hard gates).

**Kill-switch inventory at session start:** no new switches needed.

## 11. Notes for qb-e2e brief writer (G11 extension)

QB-E2E = Playwright E2E suite for the critical flow:
**deal → quote → accept → pay**. After QB-8:
- Full data shape exists end to end (QB-1→QB-8). Early-cancel is
  data-only at this point — E2E can assert it's reachable but
  shouldn't try to drive it through UI (Client Portal owns surfaces).
- Build-time Stripe instantiation issue (from QB-4c, logged in
  PATCHES_OWED) MUST be fixed before QB-E2E can run — Playwright
  runs against a built app. Flag it as a blocker in the E2E brief §7
  preconditions.
- Suite must cover: seed deal → create draft quote → send quote →
  load public URL (with view-tracking assert) → accept (manual-billed
  path, simpler than Stripe) → deal flipped to won → first-cycle
  `manual_invoice_generate` enqueue is correctly gated OFF
  (`invoicing_manual_cycle_enqueue_enabled=false`, BI-1 owns flip).
- Stripe-billed accept path is optional for QB-E2E; BI-E2E + SB-E2E
  (later waves) have more Stripe-dense coverage. If E2E budget is
  tight, QB-E2E sticks to manual-billed and leaves Stripe-accept for
  BI-E2E.
