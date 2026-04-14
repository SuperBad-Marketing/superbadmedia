# QB-1 — Quote Builder schema + scheduled_tasks handler slot (handoff)

**Closed:** 2026-04-14
**Wave:** 6 (Quote Builder — critical flow: Quote Accept)
**Brief:** `sessions/qb-1-brief.md` · `BUILD_PLAN.md` Wave 6 QB-1.

## What shipped

- **4 new tables** via migration `0016_qb1_quote_builder_schema.sql`:
  - `quotes` — full §5.1 column set (deal + company FK, token, quote_number, 7-state `status`, 3-value `structure`, GST-inc cents columns, commitment/supersede chain, proof-of-acceptance, Stripe + PDF caches). Indexed on deal_id, company_id, status, expires_at_ms.
  - `catalogue_items` — name, category, unit (`hour|day|project|month|piece`), `base_price_cents_inc_gst`, optional tier_rank.
  - `quote_templates` — reusable skeletons with `default_sections_json` + `default_line_items_json`.
  - `sequences` — atomic counter store (`name PK`, `current_value`), shared primitive for later `invoice_number` use.
- **Companies patch** — added `gst_applicable` (boolean, default true) + `abn` (text, nullable) per §5.6.
- **`lib/quote-builder/sequences.ts#allocateQuoteNumber()`** — atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` allocator keyed per calendar year, emits `SB-YYYY-NNNN` format (zero-padded to 4). Year-scoped counters isolate rollover.
- **`lib/quote-builder/transitions.ts`** — `LEGAL_TRANSITIONS` matrix + `assertQuoteTransition()` guard + `IllegalQuoteTransitionError` + `isTerminal()` / `QUOTE_TERMINAL_STATUSES` helpers. Every `quotes.status` mutation in later sessions must route through this.
- **`lib/scheduled-tasks/handlers/`** — `quote-builder.ts` registers the 6 QB-owned stubs (`quote_expire`, `quote_reminder_3d`, `manual_invoice_generate`, `manual_invoice_send`, `subscription_pause_resume_reminder`, `subscription_pause_resume`); each throws `NotImplementedError("QB-6: handler not implemented")`. `index.ts` exports a merged `HANDLER_REGISTRY` ready to feed the A6 worker — downstream feature areas add their blocks by spreading in their own `*_HANDLERS` export.
- **Settings keys seeded** — `quote.default_expiry_days` (14) + `quote.setup_fee_monthly_saas` (0). Registry count 84 → 86. Added to `lib/settings.ts` registry with `integer` schemas; `tests/settings.test.ts` count assertions bumped.
- **15 new tests** — QB-1 schema smoke (4 tables land, companies columns with defaults, settings seed, UNIQUE on quote_number), sequences allocator (monotonic, per-year isolation, no duplicates across 20 concurrent calls), transitions (every §5.1 legal pair, illegal rejected, terminal closure, error carries from+to), handler registry (6 task types registered + all stubs throw `NotImplementedError`). **529/529 green** (was 514 at SP-9 close), typecheck clean, G4 clean.

## Files touched

New:
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
- `sessions/qb-1-brief.md`

Edited:
- `lib/db/schema/companies.ts` (+ `gst_applicable`, `abn`)
- `lib/db/schema/index.ts` (barrel exports: sequences, catalogue-items, quote-templates, quotes)
- `lib/db/migrations/meta/_journal.json` (+ idx 16 entry for 0016)
- `lib/settings.ts` (+ 2 QB keys in registry)
- `docs/settings-registry.md` (+ Quote Builder block; totals bump 84 → 86)
- `tests/settings.test.ts` (two count-assertion bumps + label)

## Verification (G0–G12)

- **G0** kickoff: `sessions/sp-9-handoff.md` + `sessions/sp-8-handoff.md` + `docs/specs/quote-builder.md` §§5, 8 + `AUTONOMY_PROTOCOL.md` §1 read at session start.
- **G1** preflight: confirmed `SCHEDULED_TASK_TYPES` already includes 6 QB entries, `ACTIVITY_LOG_KINDS` already includes 17 QB kinds, `deals.*` subscription columns already present (SP-1), `worker_heartbeats` already defined. No missing preconditions; no repo-vs-handoff drift.
- **G2** scope: touched only files on the brief whitelist; no ambient refactors.
- **G4** settings-literal grep: two new tunables (`quote.default_expiry_days`, `quote.setup_fee_monthly_saas`) routed through the registry; `QUOTE_NUMBER_PAD` (4), `buyout_percentage` default (50), and `MAX_ATTEMPTS`-equivalents remained as spec-canonical constants (format/enum concerns, not tunables).
- **G6** rollback: **migration reversible** — down-path documented in the migration header; four table drops + two column drops + two settings deletes. Tables ship empty.
- **G7** artefact verification: every file listed above confirmed on disk.
- **G8** typecheck + tests: `npx tsc --noEmit` zero errors; `npm test` 529/529 green.
- **G11** handoff: this file.

## Key decisions locked

- **Year-scoped quote number sequences.** `sequences.name = "quote_number:{year}"` — rolls over cleanly on 1 Jan; invoice numbers will reuse the same `sequences` table with key `invoice_number:{year}`.
- **`sequences` as a shared primitive, not a Quote-Builder-private helper.** Lives in `lib/db/schema/` with a generic name so BI-1's invoice allocator is a one-file addition, not a rewrite.
- **Handler registry as a registry of registries.** `lib/scheduled-tasks/handlers/index.ts` is the single map the worker consumes; each feature area owns its own `*_HANDLERS` export and is spread in. Lets downstream sessions ship their block as a pure addition.
- **Journal-tracked migration with statement breakpoints.** 0016 goes into `meta/_journal.json` (unlike seed-only 0013–0015) because it contains DDL. Drizzle migrator requires `--> statement-breakpoint` between statements — added throughout.
- **Self-FK on `quotes.supersedes_quote_id` / `superseded_by_quote_id`.** Declared as plain `text` in Drizzle (forward self-reference limitation) + raw `REFERENCES quotes(id) ON DELETE SET NULL` in the SQL migration to keep referential integrity without hitting the ORM's circular-reference problem.

## Not done (by design, tracked)

- **Worker + real handlers** (`NotImplementedError` stubs today) — QB-6 fills them in.
- **UI / two-pane editor** — QB-2.
- **PDF / Puppeteer dependency** — QB-3 is the landing slot per BUILD_PLAN; QB-1 added no new npm deps.
- **Stripe Payment Intent / Subscription wiring** — QB-5.
- **Prompts** (`lib/quote-builder/prompts/*`) — QB-2 onward; `checkBrandVoiceDrift()` wiring lives at `B3` runtime.
- **Cross-spec flag receipts on Pipeline / Client Management / etc.** — not a QB-1 concern; §11 spec flags close as their consumer sessions land.

## Open threads for next session (QB-2)

- **QB-2 is a two-pane editor + live preview + catalogue picker + template CRUD** — "large" context. Confirm brief at session start from `BUILD_PLAN.md` Wave 6 QB-2.
- **`sp7_if_stripe_metadata_contract` + `sp7_qb_stripe_metadata_contract`** stay open in `PATCHES_OWED.md`; both gate on QB-5 (Stripe Checkout Session creation stamps `metadata.deal_id` + `metadata.product_type`). QB-2 does not touch them — noted so the grep at QB-5 preflight catches the owed work.
- **Catalogue content mini-session** (§12.1) still owed — actual categories, seeded items, tier-rank taxonomy. QB-1 shipped structure only; content slot is a deferred brand-voice-loaded mini-session, not a QB-2 dependency (editor works against whatever the catalogue contains).
- **Manual browser verification for SP-5 + SP-6 + SP-9** still owed (per SP-9 handoff) — not regressed by QB-1.

## Rollback

**Migration reversible.** See header of `lib/db/migrations/0016_qb1_quote_builder_schema.sql` for the explicit down-path.
