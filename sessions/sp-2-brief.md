# SP-2 — Deal state model + transitions — Brief

**Wave:** 5 (Sales Pipeline)
**Type:** FEATURE (small)
**Model tier:** Sonnet (`/effort` default). Pure helper work on top of SP-1 schema; no UI, no migration, no cross-spec reach.

## Scope (BUILD_PLAN row SP-2)

8-stage state model + `validateDeal()` + `transitionDealStage()` helpers.

## Spec references

- `docs/specs/sales-pipeline.md` §4 (stage state machine — legal transitions matrix)
- `docs/specs/sales-pipeline.md` §10 (activity_log semantics — `stage_change` meta shape)
- `docs/specs/sales-pipeline.md` §13 (won/lost finalisation: `won_outcome` required at `won`, `loss_reason` required at `lost`)

## Acceptance criteria

1. **`transitionDealStage(dealId, toStage, {by, meta?}, dbArg?)`** — loads current deal, validates the transition against the legal-transition matrix (spec §4), updates `stage` + `last_stage_change_at_ms`, writes a `stage_change` activity_log row in the same transaction. Returns the updated `DealRow`.
2. **Legal-transition matrix** — keyed off the 8-tuple from `DEAL_STAGES` (already shipped). Backwards transitions allowed only where §4 permits (e.g. `quoted → conversation` is legal; `won → anything` is not; `lost → lead` is allowed for rekindle per §4). Codify as `const LEGAL_TRANSITIONS: Record<DealStage, ReadonlyArray<DealStage>>`.
3. **`validateDeal(deal)`** — pure function, no DB. Asserts finalisation requirements: at `won` → `won_outcome` must be set; at `lost` → `loss_reason` must be set. Returns `{ ok: true } | { ok: false, errors: string[] }`.
4. **Rejection path** — illegal transitions throw `Error` with `from`/`to` in the message. `won` → `lost` (or vice versa) is illegal post-finalisation; must go through an explicit re-open helper (out of scope for SP-2 — log as open thread for SP-3+).
5. **Unit tests** — transition matrix coverage (every legal edge passes, every illegal edge rejects), activity_log row written with correct meta `{from_stage, to_stage, by}`, `validateDeal` catches missing `won_outcome` / `loss_reason`.

## File whitelist

- `lib/crm/transition-deal-stage.ts` (NEW)
- `lib/crm/validate-deal.ts` (NEW)
- `lib/crm/index.ts` (add exports)
- `tests/crm/transition-deal-stage.test.ts` (NEW)
- `tests/crm/validate-deal.test.ts` (NEW)

Do NOT touch: `lib/db/schema/deals.ts` (schema locked in SP-1). No migration.

## Preconditions (G1)

- `DEAL_STAGES`, `DEAL_WON_OUTCOMES`, `DEAL_LOSS_REASONS` already exported from `lib/db/schema/deals.ts` ✓ (SP-1)
- `createDealFromLead` + activity_log FK wiring green ✓ (SP-1)
- Spec §4 has the legal-transition matrix in a lockable form — verify before implementing.

## Definition of Done

- Typecheck clean, full `npm test` green.
- Two helpers exported via `lib/crm/index.ts`.
- No schema or migration churn.
- Handoff + tracker updated.

## Notes for SP-3 brief writer

- SP-3 is the Kanban UI — drag-to-transition will call `transitionDealStage` directly from a Server Action. Spec §4 also mentions "forbidden drops show a subtle bounce-back rather than an error toast" — the UI handles the reject path visually, but the helper must still throw crisply so the Server Action can surface `{ ok: false }` to the client.
- Re-open from `won`/`lost` is explicitly deferred — log as an open thread when SP-2 closes.
