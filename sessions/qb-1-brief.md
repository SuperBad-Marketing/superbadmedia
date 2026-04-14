# QB-1 — brief

**Wave:** 6 (Quote Builder — critical flow: Quote Accept)
**Row:** `BUILD_PLAN.md` Wave 6 QB-1 — *`quotes`, `quote_templates`, `catalogue_items`, `quote_number` sequence; scheduled_tasks handler slot.*
**Type:** INFRA (small context)
**Spec:** `docs/specs/quote-builder.md` §5 (Data model) + §8 (scheduled-tasks primitive, handler-slot only — worker + handlers land in QB-6).

## Preconditions (G1)

- `lib/db/schema/scheduled-tasks.ts` — exists; `SCHEDULED_TASK_TYPES` already contains the 6 QB entries (owner spec = QB). ✓
- `lib/db/schema/deals.ts` — `won_outcome` already includes `project`; `subscription_state`, `committed_until_date_ms`, `pause_used_this_commitment`, `stripe_subscription_id`, `stripe_customer_id` already present. No deals patch owed. ✓
- `lib/db/schema/companies.ts` — missing `gst_applicable` + `abn`. **QB-1 adds both.**
- `lib/db/schema/activity-log.ts` — `ACTIVITY_LOG_KINDS` already contains the 17 QB-owned kinds from spec §5.7. No widening owed. ✓
- `lib/scheduled-tasks/worker.ts` — exists (from A6); consumes a `HandlerMap`. QB-1 creates the registry file the worker will later receive.
- `lib/settings.ts` — runtime in place; `portal.magic_link_ttl_hours` already seeded (168). ✓
- Latest migration: `0015_sp9_three_wons_egg_setting.sql`. QB-1 writes `0016`.

## Scope (G2 file whitelist)

New files:
- `lib/db/schema/quotes.ts`
- `lib/db/schema/catalogue-items.ts`
- `lib/db/schema/quote-templates.ts`
- `lib/db/schema/sequences.ts`
- `lib/db/migrations/0016_qb1_quote_builder_schema.sql`
- `lib/quote-builder/sequences.ts`
- `lib/quote-builder/transitions.ts`
- `lib/scheduled-tasks/handlers/quote-builder.ts`
- `lib/scheduled-tasks/handlers/index.ts`
- `tests/qb1-schema.test.ts`
- `tests/qb1-sequences.test.ts`
- `tests/qb1-transitions.test.ts`
- `tests/qb1-handlers.test.ts`

Edited:
- `lib/db/schema/companies.ts` (add `gst_applicable`, `abn`)
- `lib/db/schema/index.ts` (barrel exports)
- `docs/settings-registry.md` (+2 rows)
- `tests/settings.test.ts` (count bump)

Out of scope:
- Worker loop changes (already land from A6; QB-1 only supplies handler stubs).
- Actual handler logic (stubs throw `NotImplementedError` — filled by QB-6).
- UI, PDF, Stripe, prompts (QB-2..QB-8).
- Widening `SCHEDULED_TASK_TYPES`, `ACTIVITY_LOG_KINDS`, `deals.*` — already present.

## Settings keys added

- `quote.default_expiry_days` · integer · default `14` · per spec Q8 / §4.1
- `quote.setup_fee_monthly_saas` · integer · default `0` · consumed in QB-5 / SaaS; seeded here at the foundation slot

## Rollback (G6)

**Migration reversible.** `0016_qb1_quote_builder_schema.sql` ships alongside a documented down-path in the migration header (drop 4 new tables; drop 2 companies columns; delete 2 settings rows). No data shape required at v1.0 ship — tables are empty.

## Notes

- `quote_number` allocator backed by a `sequences` table (`name text pk, current_value integer`). Reusable by `invoice_number` later; isolates format concerns (`SB-YYYY-NNNN`) to `lib/quote-builder/sequences.ts` so schema stays generic.
- Transitions in `lib/quote-builder/transitions.ts` enforce the spec §5.1 matrix; a dedicated `transitionQuoteStatus()` is the only legal mutator; illegal transitions throw.
- Handler stubs register every QB-owned `task_type` in the map so the worker's dispatch path is unit-testable today; each stub throws `Error("QB-6: handler not implemented")`.

## Post-session

- Tracker Next Action → Wave 6 QB-2.
- Both `sp7_*` Stripe metadata contracts stay open (gated on QB-5's Checkout Session creation, not QB-1).
