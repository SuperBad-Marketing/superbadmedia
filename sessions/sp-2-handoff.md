# SP-2 — Deal state model + transitions — Handoff

**Closed:** 2026-04-14
**Type:** FEATURE (small)
**Model tier:** Sonnet

## What shipped

- `lib/crm/validate-deal.ts` — pure `validateDeal()` per spec §4.2. Won requires `won_outcome`; lost requires `loss_reason`; lost+other requires `loss_notes`. No DB.
- `lib/crm/transition-deal-stage.ts` — `LEGAL_TRANSITIONS` matrix (§3.2 forward auto-edges + §3.3 manual overrides collapsed into one map) + `transitionDealStage(dealId, toStage, { by, meta?, nowMs? }, dbArg?)` helper. Loads deal, rejects unknown / identity / illegal / finalisation-incomplete, then updates stage + `last_stage_change_at_ms` + `updated_at_ms` + clears `next_action_overridden_at_ms`, and writes `activity_log.kind="stage_change"` with `meta={from_stage, to_stage, by, ...extra}` inside the same `database.transaction(tx)`.
- `lib/crm/index.ts` — re-exports both helpers + types + the matrix.

## Matrix decisions (spec §3.2/§3.3, brief §2)

- `won` terminal (`[]`) — re-open deferred to SP-3+ as an explicit helper.
- `lost` terminal **except** `lost → lead` (rekindle per brief).
- Backward manual edges allowed per §3.3: `quoted → conversation`, `contacted → lead`, etc.
- Forward auto-edges from §3.2 all legal.
- No stage is legal-to-itself.

## Files touched

- NEW `lib/crm/validate-deal.ts`
- NEW `lib/crm/transition-deal-stage.ts`
- NEW `tests/crm/validate-deal.test.ts` (7 tests)
- NEW `tests/crm/transition-deal-stage.test.ts` (18 tests: matrix shape, happy paths, rejections, full legal-edge round-trip, full illegal-edge coverage)
- EDIT `lib/crm/index.ts` (add exports)

No schema change, no migration, no settings keys, no new routes, no env vars. File whitelist adhered to.

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — **423/423 green** (398 → 423, +25 new).
- E2E not required (no UI surface, non-critical path per AUTONOMY §G12).

## Open threads for SP-3

- **Re-open helper (`reopenDeal(dealId, ...)`).** Out of scope for SP-2. SP-3 Kanban UI won't expose it; SP-6 Won/Lost flows is the natural home. Log: won/lost currently terminal in `LEGAL_TRANSITIONS`; re-opener must bypass the matrix with an audit row, not widen the matrix.
- **Kanban drag-to-transition.** Call `transitionDealStage` from a Server Action; surface `{ ok: false, error }` to client for bounce-back animation per brief §5.
- **Stripe/Resend webhook consumers** (SP-7/SP-8) pass `by: "webhook:stripe"` / `"webhook:resend"` and thread `event_id` into `meta` — pattern already demonstrated in test `#2`.

## PATCHES_OWED

None opened. None closed.

## Next session

**Wave 5 SP-3 — Kanban board** (8 columns, drag-to-transition wired to `transitionDealStage`, Tier 1 motion). Large UI session; pre-compile brief before kickoff.
