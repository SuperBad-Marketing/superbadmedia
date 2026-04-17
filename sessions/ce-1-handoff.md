# `ce-1` — Content Engine data model + schema + helpers — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (1 of 13 — **Wave 12 opener**)
**Model tier:** Opus (started on Opus; tracker recommended Sonnet)

---

## What was built

The **complete Content Engine data model** — 8 new tables, 5 settings keys, 3 kill switches, and schema barrel exports. Opens Wave 12.

**Files created:**

- `lib/db/schema/content-topics.ts` — `content_topics` table. Keyword-researched topic queue with rankability scoring, SERP snapshots, outlines. Status lifecycle: `queued` → `generating` → `generated` (or `vetoed` / `skipped`). Includes Hiring Pipeline claimable columns (§14.0): `claimed_by`, `claimed_at_ms`, `claim_budget_cap_aud`, `claim_released_at_ms`, `claim_released_reason`.
- `lib/db/schema/blog-posts.ts` — `blog_posts` table. Two-pass generated posts (Haiku outline → Opus draft). Full SEO package: title, slug, body (markdown), meta, OG image, JSON-LD, internal links, snippet target.
- `lib/db/schema/blog-post-feedback.ts` — `blog_post_feedback` table. Rejection chat thread per blog post. User/assistant role pattern.
- `lib/db/schema/social-drafts.ts` — `social_drafts` table. Per-post per-platform social drafts. Supports single/carousel/video formats. Visual asset URLs (R2) + carousel slide data.
- `lib/db/schema/newsletter-subscribers.ts` — `newsletter_subscribers` table. Per-company subscriber list with consent source tracking (Spam Act). Automated hygiene: bounce counts, inactive removal, unsubscribe timestamps.
- `lib/db/schema/newsletter-sends.ts` — `newsletter_sends` table. Newsletter send records. Hybrid format (single/digest). Open/click tracking.
- `lib/db/schema/ranking-snapshots.ts` — `ranking_snapshots` table. Weekly SerpAPI + optional GSC ranking data per published post.
- `lib/db/schema/content-engine-config.ts` — `content_engine_config` table. Per-company config: seed keywords, newsletter send window, GSC OAuth token (vault-encrypted), embeddable form token. One row per company (unique constraint).
- `lib/db/migrations/0042_ce1_content_engine.sql` — Migration creating all 8 tables + 19 indexes + 5 settings rows.
- `tests/content-engine/ce1-schema.test.ts` — 22 tests: round-trips for all 8 tables, FK cascade verification (company delete cascades to all CE tables), Hiring Pipeline claimable columns, config uniqueness constraint, 11 enum value spec-alignment checks.

**Files edited:**

- `lib/db/schema/index.ts` — Added 8 new barrel exports.
- `lib/kill-switches.ts` — Added 3 kill switches: `content_automations_enabled` (gates keyword research, draft generation, fan-out, ranking snapshots), `content_newsletter_enabled` (gates newsletter sending), `content_outreach_enabled` (gates content-to-outreach matching). All default OFF.
- `lib/settings.ts` — Added 5 Content Engine keys to typed registry (123 total).
- `lib/db/migrations/meta/_journal.json` — Added entry idx 42.
- `docs/settings-registry.md` — Added Content Engine section (5 keys), updated totals to 97.
- `tests/settings.test.ts` — Updated count assertions from 118 to 123.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Claimable columns on `content_topics`, not a separate `content_items` table.** The spec §14.0 names `content_items` columns but no such table exists in §11.1. Topics ARE the content backlog items — the claim columns sit on topics directly.
2. **`ctr` stored as text on `ranking_snapshots`.** CTR is a decimal percentage that could have varying precision from different sources (SerpAPI vs GSC). Text avoids float precision issues.
3. **`gsc_refresh_token` as plain text column.** The spec says "encrypted" and the vault exists (B2), but encryption happens at the application layer via `vault.encrypt()`/`vault.decrypt()` — the column type is still text.
4. **Three separate kill switches for Content Engine.** Newsletter sending and outreach matching are independently disableable from the core automation pipeline. Matches the BUILD_PLAN cron table's kill-switch assignments.

## Verification (G0–G12)

- **G0** — OS-3 and OS-2 handoffs read. Spec `content-engine.md` read in full. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `companies` table exists, `settings` table exists, `activity_log` kinds already registered (A6), `scheduled_tasks` types already registered (A6).
- **G2** — Files match CE-1 scope (data model + schema + settings + kill switches).
- **G3** — No motion work. Schema-only session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. All settings seeded via migration.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — Migration 0042 is additive (CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE). Rollback: migration-reversible.
- **G7** — 0 TS errors, 154 test files / 1148 passed + 1 skipped (+22 new), clean production build, lint 0 errors (58 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1148 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 0 errors, 58 warnings.
- **G9** — No UI changes. Schema-only session.
- **G10** — No browser-verifiable surfaces. All table operations exercised by unit tests.
- **G10.5** — N/A (data model session, no UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_1_settings_registry_doc_drift`** — `docs/settings-registry.md` totals section shows 97 keys but `lib/settings.ts` has 123 (the doc hasn't been updated for UI-10, UI-12, UI-13, OS-2 additions). Not blocking — the typed registry in `lib/settings.ts` is the runtime source of truth.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`migration-reversible`. Migration 0042 uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE`. Reverting the new files + edits removes:
- 8 schema files (lib/db/schema/content-*.ts, blog-*.ts, social-*.ts, newsletter-*.ts, ranking-*.ts)
- 3 kill switch entries (code-only, harmless if orphaned)
- 5 settings registry entries in lib/settings.ts
- 5 settings rows in DB (INSERT OR IGNORE, harmless if orphaned)

## What the next session (CE-2) inherits

CE-2 is the keyword research pipeline + rankability scoring. It inherits:

- **All 8 Content Engine tables** ready with indexes and FK cascades.
- **Settings keys seeded** — all 5 content settings in DB and typed registry.
- **Kill switches registered** — `content_automations_enabled` (gates CE-2's research cron), `content_newsletter_enabled`, `content_outreach_enabled`.
- **Activity log kinds already registered** — 15 Content Engine kinds from A6 consolidation.
- **Scheduled task types already registered** — 6 Content Engine types from A6 consolidation.
- **SerpAPI integration** not yet built — CE-2 needs to create `lib/content-engine/research.ts` with SerpAPI calls.
- **No prompt files yet** — CE-2 creates `lib/ai/prompts/content-engine/score-keyword-rankability.ts` and `generate-topic-outline.ts`.
