# `SP-1` — Sales Pipeline CRM spine (schema + `createDealFromLead`) — Session Brief

> Pre-compiled on-demand at session kickoff per tracker direction (cross-wave transition).
> Sources: `BUILD_PLAN.md` §Wave 5 row SP-1, `docs/specs/sales-pipeline.md` §§ 4 + 10 + 12 + 13, `docs/specs/saas-subscription-billing.md` §11.2, `docs/specs/quote-builder.md` §5.6.

---

## 1. Identity

- **Session id:** `SP-1`
- **Wave:** `5 — Sales Pipeline`
- **Type:** `INFRA`
- **Model tier:** `/deep` (Opus) — foundational schema + helper ownership for every revenue spec downstream
- **Sonnet-safe:** `no`
- **Estimated context:** `large`

## 2. Spec references

- `docs/specs/sales-pipeline.md` §4.1 — `companies`, `contacts`, `deals`, `activity_log`, `webhook_events` canonical definitions
- `docs/specs/sales-pipeline.md` §4.2 — `validateDeal()` invariants (test-level coverage only this session; callable helper ships in SP-2)
- `docs/specs/sales-pipeline.md` §10.4 — `createDealFromLead()` signature + contact dedupe rule
- `docs/specs/sales-pipeline.md` §12 — build-time disciplines (append-only activity log; `transitionDealStage()` is the only stage mutator — scaffolded in SP-2, not here)
- `docs/specs/saas-subscription-billing.md` §11.2 — deal subscription columns origin note (`billing_cadence` values: `monthly | annual_monthly | annual_upfront`)
- `docs/specs/quote-builder.md` §5.6 — `subscription_state` enum canonical values (7); `pause_used_this_commitment`, `stripe_subscription_id`, `stripe_customer_id` shapes

## 3. Acceptance criteria (spec-rooted subset)

SP-1 is the schema + helper slice of the full Sales Pipeline ship-gate (§13). This session's subset:

```
9. All three activity feeds (Deal / Contact / Company) query correctly from the single `activity_log` table.
— (and data-model rows supporting) —
2/3/4. Stripe + Resend webhook paths (SP-7/SP-8 consumers) can write to `webhook_events` + `deals` rows.
5/6.   Loss reason + billing mode + shape enums are defensively typed at DB layer.
10.    `validateDeal()` rejects every illegal combination (helper in SP-2; this session's tests pin enum/shape expectations).
```

Out-of-scope for SP-1: UI (SP-3/4/9), stage transitions (SP-2), webhook handlers (SP-7/8), Trial Shoot sub-machine (SP-5). Each lands in its own session per BUILD_PLAN.

## 4. Skill whitelist

- `drizzle-orm` — schema authoring, migration generation, `$inferSelect`/`$inferInsert` typing
- `typescript-validation` — Zod-backed helper input contracts where the helper writes to the DB

## 5. File whitelist (G2)

- `lib/db/schema/companies.ts` — new
- `lib/db/schema/contacts.ts` — new
- `lib/db/schema/deals.ts` — new
- `lib/db/schema/webhook-events.ts` — new
- `lib/db/schema/activity-log.ts` — edit (add `.references()` on `company_id`/`contact_id`/`deal_id` now that tables exist; enum unchanged — already at consolidated state)
- `lib/db/schema/index.ts` — edit (export new schemas)
- `lib/db/migrations/0011_sp1_crm_spine.sql` — new (generated via `drizzle-kit generate`)
- `lib/db/migrations/meta/_journal.json` + new snapshot — new (drizzle-kit output)
- `lib/crm/create-deal-from-lead.ts` — new (helper)
- `lib/crm/normalise.ts` — new (email/phone normalisation)
- `lib/crm/index.ts` — new (barrel)
- `tests/crm/create-deal-from-lead.test.ts` — new
- `tests/crm/schema.test.ts` — new (enum coverage + activity_log FK wiring smoke)

## 6. Settings keys touched

- **Reads:** none (schema session; no autonomy thresholds read at this layer)
- **Seeds (new keys):** none — staleness thresholds + `pipeline.snooze_default_days` are owned by SP-2/SP-4, not here

## 7. Preconditions (G1)

- [ ] `lib/db/schema/activity-log.ts` exists and exports `ACTIVITY_LOG_KINDS` — `Read` + grep `ACTIVITY_LOG_KINDS`
- [ ] `lib/db/schema/index.ts` exists and re-exports schema modules — `Read`
- [ ] `lib/db/migrate.ts` exists and uses `drizzleMigrate(db, { migrationsFolder })` — grep `drizzleMigrate`
- [ ] `drizzle.config.ts` points at `lib/db/schema/index.ts` — `Read`
- [ ] Migration journal at `lib/db/migrations/meta/_journal.json` with last entry `0010_sw3_verify_timeout` — `Read`
- [ ] `better-sqlite3` + `drizzle-orm` + `drizzle-kit` installed — grep `package.json`
- [ ] Vitest harness runs migrations before tests — grep `runMigrations` in test setup
- [ ] No prior `companies` / `contacts` / `deals` / `webhook_events` tables in any schema file — `grep -r "sqliteTable(.companies" lib/db/schema` returns nothing

## 8. Rollback strategy (G6)

- [x] `migration reversible` — `0011_sp1_crm_spine.sql` is an additive migration (new tables + `ALTER TABLE activity_log` for FK refs via table recreate). Down = drop new tables + restore `activity_log` without FK refs. SQLite FK changes require table rebuild; the down path uses the same pattern.

## 9. Definition of done

- [ ] `companies` table: all columns per spec §4.1 including `shape` enum, `billing_mode`, `trial_shoot_*`, `do_not_contact`, `first_seen_at_ms`, timestamps
- [ ] `contacts` table: including `stripe_customer_id` (unique), `email_status` enum, `is_primary`, cascade-delete on `company_id`
- [ ] `deals` table: including `stage` (8-state), `won_outcome` (`retainer|saas|project`), `loss_reason` (7-state), `subscription_state` (7-state), `pause_used_this_commitment`, `billing_cadence` (`monthly|annual_monthly|annual_upfront`), `stripe_subscription_id`, `stripe_customer_id`, `snoozed_until_ms`, `last_stage_change_at_ms`
- [ ] `webhook_events` table: provider enum (`stripe|resend`), event_type, payload JSON, result enum (`ok|error|skipped`)
- [ ] `activity_log` FK refs on `company_id` (cascade), `contact_id` (set null), `deal_id` (cascade) — verified by grep for `.references(` in `activity-log.ts`
- [ ] Migration 0011 generates via `npx drizzle-kit generate` and applies clean on fresh DB
- [ ] `createDealFromLead(companyInput, contactInput, source)` helper exists, returns `{ company, contact, deal }`, and:
  - dedupes contact by normalised email first, normalised phone second
  - dedupes company by normalised name + domain
  - merges supplied fields non-destructively (never overwrites populated values with `null`/`undefined`)
  - sets default stage to `lead` unless `source` overrides (e.g. `intro_funnel_contact_submitted` → `trial_shoot`)
  - writes an `activity_log` row with `kind = 'stage_change'` (initial) via a single transaction
- [ ] `normaliseEmail()` + `normalisePhone()` exported from `lib/crm/normalise.ts` — deterministic, lowercase-trim for email, digits-only for phone
- [ ] 8+ unit tests green, covering: happy path, email match reuses contact, phone-fallback match reuses contact, name+domain match reuses company, non-destructive merge preserves existing notes/role, source=`intro_funnel_contact_submitted` lands in `trial_shoot`, shape enum rejects invalid values, `activity_log` FK wiring holds (insert with invalid `company_id` rejects)
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] Handoff at `sessions/sp-1-handoff.md` per G11
- [ ] `SESSION_TRACKER.md` Next Action points at SP-2
- [ ] `sessions/sp-2-brief.md` written (next-wave rolling cadence per G11.b — at least the immediate-next brief)
- [ ] Commit: `[PHASE-5] Wave 5 SP-1 — CRM spine (companies/contacts/deals/webhook_events) + createDealFromLead`

## 10 Notes for the next-session brief writer (SP-2)

- SP-2 consumes: `deals.stage`, `deals.last_stage_change_at_ms`, `deals.next_action_overridden_at_ms`, `ACTIVITY_LOG_KINDS` (especially `stage_change`), `logActivity()` from A6.
- SP-2 owns: `validateDeal(partialDeal)`, `transitionDealStage(dealId, fromStage, toStage, source)`, the 8-stage transition legality table from spec §3.2.
- Settings keys SP-2 introduces: `pipeline.stale_thresholds.{stage}_days` (7 keys — one per non-terminal stage) + `pipeline.snooze_default_days`.
- Skill whitelist: `drizzle-orm`, `typescript-validation`.
- Rollback: `migration reversible` if any new column lands; otherwise `git-revertable`.
