# SP-6 — Won/Lost flows + loss-reason modal — Handoff

**Closed:** 2026-04-14
**Spec:** `docs/specs/sales-pipeline.md` §§ 3.3, 3.5, 5.5, 6.1, 7.2
**Brief:** none (scope read direct from spec + BUILD_PLAN Wave 5 row)

## What shipped

- **`components/ui/destructive-confirm-modal.tsx`** — generic confirm
  primitive per spec §7.2. Two modes (`simple` and `type-to-confirm`);
  confirm button stays disabled until the typed phrase matches (trimmed,
  case-sensitive). Controlled open; resets typed phrase on close.
- **`components/lite/sales-pipeline/won-confirm-modal.tsx`** — Won
  finalisation. `won_outcome` radio picker (retainer / saas / project).
  Mode branches on `Company.billing_mode`: `manual` → simple confirm;
  `stripe` → type-the-company-name (§3.3 safety valve against fat-finger
  Wons on webhook-driven companies).
- **`components/lite/sales-pipeline/loss-reason-modal.tsx`** — Lost
  finalisation. Closed list of 7 reasons; notes optional on six, required
  on `other` with a visible `(required)` hint and disabled confirm until
  notes are non-blank.
- **`lib/crm/finalise-deal.ts`** — `finaliseDealAsWon()` and
  `finaliseDealAsLost()`. Each writes the finalisation fields and calls
  `transitionDealStage` inside one SQLite transaction; either the whole
  finalisation lands or nothing does. Won path also clears stale
  `loss_reason` / `loss_notes` so a previously-Lost-then-rekindled deal
  doesn't carry loss metadata into Won. Lost path hard-rejects
  `loss_reason='other'` without notes before the transaction opens (the
  Server Action also guards, but keeping the invariant in the helper
  means direct callers can't bypass it).
- **`app/lite/admin/pipeline/actions.ts`** — two new Server Actions
  (`finaliseWonAction`, `finaliseLostAction`), each with an admin
  re-check + `revalidatePath('/lite/admin/pipeline')`.
  `transitionDealAction` still routes all non-Won/Lost drops; its
  Won/Lost rejection message updated ("Use the Won/Lost finalisation
  action").
- **`components/lite/sales-pipeline/pipeline-board.tsx`** — Won/Lost
  drops no longer toast-blocked. A drop opens the matching modal with
  `finalise` state carrying the card; `canDrop` no longer excludes
  won/lost. Optimistic update happens after the action resolves
  `{ok:true}` — the card doesn't move mid-modal.
- **`PipelineCardDeal.billing_mode`** field added; page query now
  selects `companies.billing_mode` into the card payload.
- Tests: `tests/crm/finalise-deal.test.ts` — 9 cases covering
  atomicity, meta propagation, stale-loss-field clearing on Won, all
  three outcomes, null-notes for non-`other`, `'other'` guard
  (both null and whitespace-only), illegal-transition rejection, and a
  rollback assertion (illegal-transition failure leaves the deal
  untouched — no half-written loss_reason/loss_notes).

## Decisions

- **Outcome picker lives inside the Won modal** (per your call). One
  surface, one click-through; the outcome is part of what's being
  confirmed.
- **`finaliseDealAsWon` clears stale loss fields.** Prevents a
  rekindle → Won deal from carrying stale loss metadata. The reverse
  isn't done for Lost because a Lost deal never legally had
  `won_outcome` set (validator would have caught it).
- **`'other'` notes guard lives in the helper, not just the modal.**
  The modal enforces it for the UI, but a direct programmatic caller
  (script, future webhook) hitting `finaliseDealAsLost` with a bad
  payload still fails fast instead of writing a `loss_reason='other',
  loss_notes=null` row that breaks `validateDeal()` invariants later.
- **Stripe-billed Won uses `type-to-confirm`.** Matches spec §3.3.
  Manual override is a real escape hatch (e.g. fixing a missed webhook),
  but the friction is warranted — Stripe-billed Wons should be
  webhook-driven once SP-7 lands.
- **No drag-out-of-Won flow.** `LEGAL_TRANSITIONS.won = []` — Won is
  terminal. Spec §5.5 mentions drag-out-of-Won with type-to-confirm,
  but that requires a matrix change + a reversal story we haven't
  decided. Deferred to SP-7 / Client Management (whichever lands a
  confirmed reversal story first).

## Preconditions verified

- `companies.billing_mode` (SP-1 schema). ✓
- `deals.{won_outcome, loss_reason, loss_notes}` (SP-1). ✓
- `transitionDealStage` accepts an external transaction via `dbArg` (SP-2). ✓
- `components/ui/{dialog, radio-group, input, label, textarea, button}` primitives. ✓

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — **479/479 green** (+9 SP-6 tests).
- G4 literal-grep — no autonomy thresholds introduced. Closed enum
  values (7 loss reasons, 3 outcomes, 2 billing modes) are schema, not
  tunables. No new settings keys.
- **Manual browser — verified 2026-04-14.**
  - Carlton Cafe Group (manual, negotiating) → Won → simple confirm,
    retainer default. ✓
  - Preston Plumbing (stripe, quoted) → Won → type-to-confirm gate on
    company name. ✓
  - Brunswick Brew Co (conversation) → Lost → "Other" → Confirm
    disabled until notes typed. ✓
  - Fitzroy Florist (`trial_shoot_status='booked'`) stepper + plan
    save — clears SP-5's owed pass. ✓
  - Noted flake: dnd-kit drag occasionally refuses after a prior
    successful drag (Northcote Dental card). Reloading resolves.
    Not tracked as a bug — pre-existing dnd-kit quirk.

## Not shipped (out of scope)

- Drag-out-of-Won flow (see Decisions).
- Stripe webhook → Won auto-transition — SP-7.
- `won_at_ms` column / "Won this week" cockpit tile — Cockpit spec.
- `SheetWithSound` primitive (§7.2) — still owed; SP-5 note stands.
- Visual celebration on Won drop (Tier 2 motion, spec §9) — SP-9.

## PATCHES_OWED

None opened or closed.

## Next session

**Wave 5 SP-7** — Stripe webhook handlers (`checkout.session.completed`,
`payment_intent.succeeded`) + idempotent `stripe_processed_events` table.
Per `BUILD_PLAN.md` Wave 5. Pre-session should also clear the manual
browser verification owed above (SP-5 + SP-6) before cutting code.
