# SP-1 — Sales Pipeline CRM spine — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sp-1-brief.md`
**Model:** Opus (`/deep`) — INFRA session; schema + helper foundation for every revenue spec downstream.
**Type:** INFRA
**Rollback:** migration `0011_sp1_crm_spine.sql` is reversible (DROP TABLE companies/contacts/deals/webhook_events + restore prior activity_log shape). No callers yet depend on `createDealFromLead` — helper is write-only-new. Revert = `git revert` + delete dev.db rows touching the four new tables.

## What shipped

- **`lib/db/schema/companies.ts`** — canonical CRM entity. Enums: `COMPANY_SHAPES` (3-tuple F1.b — `solo_founder | founder_led_team | multi_stakeholder_company`), `COMPANY_SIZE_BANDS`, `COMPANY_BILLING_MODES` (`stripe | manual`), `TRIAL_SHOOT_STATUSES` (6-tuple). Columns: id, name, name_normalised, domain, industry, size_band, billing_mode (default `stripe`), do_not_contact, notes, trial_shoot_*, shape, first_seen_at_ms, created_at_ms, updated_at_ms. Indexes on name_normalised / domain / billing_mode.
- **`lib/db/schema/contacts.ts`** — humans under a company. `CONTACT_EMAIL_STATUSES` 5-tuple. FK to companies with `onDelete: cascade`. Dedupe-ready `email_normalised` + `phone_normalised` columns, indexed. `stripe_customer_id` unique per SaaS §11.2.
- **`lib/db/schema/deals.ts`** — opportunities. `DEAL_STAGES` locked 8-tuple (`lead → contacted → conversation → trial_shoot → quoted → negotiating → won → lost`), `DEAL_WON_OUTCOMES` 3-tuple (`retainer | saas | project` — `project` per Quote Builder §5.6), `DEAL_LOSS_REASONS` 7-tuple, `DEAL_SUBSCRIPTION_STATES` 7-tuple per QB §5.6, `DEAL_BILLING_CADENCES` 3-tuple. Full subscription lifecycle columns owned here per BUILD_PLAN directive (keeps SP-5/SaaS wave free of schema churn).
- **`lib/db/schema/webhook-events.ts`** — idempotency ledger for Stripe + Resend. `WEBHOOK_PROVIDERS` + `WEBHOOK_RESULTS` enums. Composite unique (provider, event_id).
- **`lib/db/schema/activity-log.ts`** — edited to add FK refs (company_id cascade, contact_id set-null, deal_id cascade). Table-recreate migration pattern used in `0011_sp1_crm_spine.sql`.
- **`lib/db/schema/index.ts`** — re-exports all four new tables.
- **`lib/db/migrations/0011_sp1_crm_spine.sql`** — hand-authored migration (drizzle-kit's auto-generator tried to recreate 0005–0010 because those earlier migrations were hand-written without paired snapshots; keeping 0011's auto-generated snapshot captures current full schema for future diffs). Creates four new tables + rebuilds activity_log via `__new_activity_log` swap to wire FKs + restores indexes.
- **`lib/crm/normalise.ts`** — `normaliseEmail` (trim+lowercase), `normalisePhone` (digits only — international E.164 canonicalisation intentionally **out of scope**), `normaliseCompanyName` (squeeze whitespace + strip punctuation), `normaliseDomain` (strip scheme+www+path).
- **`lib/crm/create-deal-from-lead.ts`** — main helper. Resolves/creates company (by normalised name + optional domain disambiguation), then contact (email primary, phone fallback), then creates a new deal + `stage_change` activity_log row — all inside a single `database.transaction(tx => {...})`. Non-destructive merge never blanks a populated field. Source-driven stage overrides: `intro_funnel_contact_submitted` + `intro_funnel_paid` land in `trial_shoot`. Returns `{company, contact, deal, companyReused, contactReused}`.
- **`lib/crm/index.ts`** — barrel for helper + normalisers.
- **`tests/crm/schema.test.ts`** — 14 tests: every enum shape locked, normalisation unit tests.
- **`tests/crm/create-deal-from-lead.test.ts`** — 13 tests: happy path, contact dedupe (email match, phone fallback, new contact when both differ within same company), non-destructive merge, source-driven stage override, explicit stage override, company dedupe by normalised name+domain, validation errors (blank name), activity_log FK wiring (orphan rejected, cascade-delete on company).
- **`tests/activity-log.test.ts`** — edited to create a parent company row before inserting activity_log (FKs now enforced; pre-SP-1 the test used a fabricated `company_id`).

## Decisions

- **Subscription columns live on `deals`, not a separate `subscriptions` table.** BUILD_PLAN's SP-1 row prescribed this explicitly — keeps the SaaS wave free of schema work and mirrors Quote Builder §5.6's conceptual model where "deal at won_outcome=saas" *is* the subscription. Alternative (separate table with FK) deferred until a second billing-subject entity emerges.
- **Migration hand-written, snapshot auto-generated.** drizzle-kit tried to redo every table from migration 0005 forward (the 0005–0010 migrations were hand-written without paired snapshots; drizzle diffed against snapshot 0004). Hand-authoring 0011's SQL while keeping its auto-generated snapshot is the canonical escape hatch — the snapshot now accurately captures full schema for future diffs, and the SQL only describes the SP-1 delta.
- **Phone normalisation stays digit-only.** International-vs-domestic canonicalisation (`+61 400 123 456` ≡ `0400 123 456`) would require ISO-country-aware E.164 parsing; out of scope for SP-1 per spec §10.4 which only mandates "digits only for dedupe". Test updated to use canonical format on both calls rather than widening the helper.
- **Activity-log FK cascade semantics.** Deleting a company → cascade to its activity_log rows + deals (deals FK is also cascade to companies). Contact delete → activity_log row's `contact_id` goes null (log entry preserved; SP-5 may surface "orphaned" log entries per spec §12). Deal delete → activity_log cascades (log is per-deal journal, loses meaning without the deal).
- **`createDealFromLead` scope-checks contact dedupe *within* the resolved company.** Never cross-company — two different companies can legitimately have the same contact email (consultant shared across clients). Matches spec §10.4 verbatim.
- **Source-stage override table deliberately small.** Only `intro_funnel_contact_submitted` + `intro_funnel_paid` land in `trial_shoot`. Every other source defaults to `lead` and must advance via the normal stage-change path — protects the pipeline funnel metrics.

## Files touched

| File | Change |
| --- | --- |
| `lib/db/schema/companies.ts` | NEW |
| `lib/db/schema/contacts.ts` | NEW |
| `lib/db/schema/deals.ts` | NEW |
| `lib/db/schema/webhook-events.ts` | NEW |
| `lib/db/schema/activity-log.ts` | FK refs added (company cascade, contact set-null, deal cascade) |
| `lib/db/schema/index.ts` | Re-export new tables |
| `lib/db/migrations/0011_sp1_crm_spine.sql` | NEW (hand-authored) |
| `lib/db/migrations/meta/0011_snapshot.json` | NEW (drizzle-kit auto) |
| `lib/db/migrations/meta/_journal.json` | Entry for 0011 |
| `lib/crm/normalise.ts` | NEW |
| `lib/crm/create-deal-from-lead.ts` | NEW |
| `lib/crm/index.ts` | NEW |
| `tests/crm/schema.test.ts` | NEW (14 tests) |
| `tests/crm/create-deal-from-lead.test.ts` | NEW (13 tests) |
| `tests/activity-log.test.ts` | Insert parent company before activity_log (FKs now enforced) |
| `sessions/sp-1-brief.md` | NEW (pre-compiled at session start) |
| `sessions/sp-1-handoff.md` | NEW (this file) |
| `sessions/sp-2-brief.md` | NEW |
| `SESSION_TRACKER.md` | Next Action → SP-2 |

No settings keys touched. No new routes. No new env vars.

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — **398/398 green** (371 prior + 27 new across `tests/crm/`; 1 pre-existing test updated to seed parent company before activity_log insert)
- Migration applied cleanly against fresh hermetic DB in both test suites.
- No UI work this session — no browser check required (INFRA session per AUTONOMY §G10).

## G0–G12 walkthrough

- **G0 kickoff** — SW-13 + SW-12 handoffs read; BUILD_PLAN §Wave 5 SP-1 + `docs/specs/sales-pipeline.md` §4/§10/§12/§13 + `docs/specs/saas-subscription-billing.md` §11.2 + `docs/specs/quote-builder.md` §5.6 read; Opus tier per tracker.
- **G1 preflight** — Phase 4 migrations table, `activity_log.kind` enum final-state file, drizzle-kit present, SQLite up.
- **G2 scope discipline** — exactly the SP-1 whitelist; no stray Quote Builder or SaaS table work.
- **G3 context budget** — schema + helper + tests fit one session comfortably.
- **G4 literal-grep** — no autonomy thresholds introduced. Source-stage override table is a spec-locked dispatch, not a tunable threshold.
- **G5 motion** — no UI touched.
- **G6 rollback** — migration reversible; documented above.
- **G7 artefacts** — every file in the table present.
- **G8 typecheck + tests** — clean (398/398).
- **G9 E2E** — no new E2E; helper has no UI surface.
- **G10 manual browser** — N/A (INFRA).
- **G11 handoff** — this file.
- **G11.b** — SP-2 brief pre-compiled.
- **G12** — tracker updated; commit next.

## PATCHES_OWED status

- **Closed this session:** none.
- **Opened this session:** none.
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure`
  - `sw7b_graph_oauth_callback_hardening`
  - `sw10b_meta_ads_oauth_callback_hardening`
  - `sw11b_google_ads_oauth_callback_hardening`

## Open threads for SP-2

- **SP-2 is stage-transition service + activity_log writer.** Consumes the `DEAL_STAGES` enum + `createDealFromLead` already shipped; introduces `transitionDealStage(dealId, toStage, {by, meta})` with legal-transition matrix + activity_log side-effect. All schema already landed — SP-2 is pure helper work.
- **Source-stage override map.** If SP-2 (or later) needs to add sources, extend `SOURCE_STAGE_OVERRIDES` in `create-deal-from-lead.ts` — currently only the two intro-funnel sources.
- **Subscription columns are inert until SP-5.** No helper reads `subscription_state` / `billing_cadence` yet — SP-5 (SaaS billing wave) wires them to Stripe webhook events via `webhook_events`.
- **Webhook events table is empty + unreferenced.** First consumer is Stripe webhook handler (SaaS wave) and Resend events (Outreach wave). Left here because it belongs with the CRM spine semantically and is trivially cheap to materialise now.
