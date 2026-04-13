# BDA-1 Handoff — Brand DNA data model + invite token

**Session:** BDA-1 | **Date:** 2026-04-13 | **Model:** Sonnet 4.6 (prescribed tier, no upshift needed)
**Wave:** 3 — Brand DNA Assessment (opening session)
**Type:** FEATURE
**Rollback:** migration reversible — all changes additive. Down-migration = drop `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` + remove new columns from `brand_dna_profiles` via ALTER DROP COLUMN (SQLite 3.35+).

---

## What was built

All BDA-1 acceptance criteria met.

### New files

| File | Purpose |
|---|---|
| `lib/db/schema/brand-dna-answers.ts` | Individual answer rows (profile_id, question_id, section, selected_option, tags_awarded JSON, answered_at_ms) |
| `lib/db/schema/brand-dna-blends.ts` | Company-level blend (company_id, source_profile_ids JSON, tags_json, prose_portrait, divergences_json) |
| `lib/db/schema/brand-dna-invites.ts` | Tokenised invite links (contact_id, token_hash, created_by, expires_at_ms, used_at_ms) |
| `lib/db/migrations/0007_bda1_brand_dna.sql` | Migration: 19 ALTER COLUMN statements on brand_dna_profiles + CREATE 3 new tables |
| `lib/brand-dna/issue-invite.ts` | `issueBrandDnaInvite(contactId, issuedByUserId, db?)` — wraps `issueMagicLink()` with `issued_for='brand_dna_invite'`; writes brand_dna_invites row; logs `brand_dna_invite_sent` |
| `lib/brand-dna/redeem-invite.ts` | `redeemBrandDnaInvite(rawToken, db?)` — validates invite, marks used, creates/attaches brand_dna_profiles row; logs `brand_dna_invite_redeemed` |
| `lib/brand-dna/index.ts` | Barrel export for brand-dna module |
| `tests/brand-dna-invite.test.ts` | 11 tests: issue (4) + redeem (7) covering happy path, used token, expired token, pre-existing profile attach |
| `sessions/bda-2-brief.md` | Wave 3 BDA-2 brief (G11.b rolling cadence) |

### Edited files

| File | Change |
|---|---|
| `lib/db/schema/brand-dna-profiles.ts` | Extended in-place: 18 new columns (subject_display_name, contact_id, company_id, version, is_current, is_superbad_self, track, shape, needs_regeneration, section_scores, signal_tags, prose_portrait, first_impression, reflection_text, section_insights, supplement_completed, current_section, completed_at_ms). Two new TypeScript enums: `BRAND_DNA_TRACKS`, `BRAND_DNA_SHAPES`. New contact index. |
| `lib/db/schema/index.ts` | Added barrel exports for brand-dna-answers, brand-dna-blends, brand-dna-invites |
| `lib/db/schema/activity-log.ts` | Added `brand_dna_invite_sent` + `brand_dna_invite_redeemed` to `ACTIVITY_LOG_KINDS` (now 225 total — adds to prior count of 223 from B3) |
| `lib/db/migrations/meta/_journal.json` | Added idx 7 entry (`0007_bda1_brand_dna`) |

---

## Key decisions

- **`brand_dna_invites` stores its own `token_hash`**: The underlying portal URL mechanism (`portal_magic_links`) is created by `issueMagicLink()` inside `issueBrandDnaInvite`. The `brand_dna_invites.token_hash` is the SHA-256 of the same raw token (re-derived from `rawToken` returned by `issueMagicLink`). This lets `redeemBrandDnaInvite` look up directly by hash without going through `portal_magic_links`. The two tables are consistent because they hash the same raw token.

- **`redeemBrandDnaInvite` does NOT call `redeemMagicLink()`**: Brand DNA redemption is a different flow from portal session establishment. `redeemMagicLink()` is for portal auth cookies; `redeemBrandDnaInvite` creates a profile and returns profile metadata. The `portal_magic_links` row is consumed only if the invite URL (`/lite/portal/r/<token>`) is hit directly — that route handler is built in BDA-2.

- **Existing `ACTIVITY_LOG_KINDS` had `invite_created` + `invite_used`** — these predate BDA-1 and are generic. The brief explicitly calls for `brand_dna_invite_sent` + `brand_dna_invite_redeemed` (more specific, consistent naming with other `*_sent`/`*_redeemed` pairs). Both sets exist; the generic ones are unused in BDA-1 code. PATCHES_OWED: retire `invite_created` and `invite_used` from the Brand DNA block in a Wave 22 SAP.

- **TTL for `brand_dna_invites.expires_at_ms` reads `portal.magic_link_ttl_hours`**: The spec says "~30 day expiry" but the brief says no new settings keys in BDA-1. Used the pre-existing `portal.magic_link_ttl_hours` setting (default 168h / 7 days) to avoid a literal. BDA-2 can add a `brand_dna.invite_ttl_hours` setting if Andy wants a separate TTL.

- **Migration starts with first SQL statement, no leading comments**: Drizzle's migrator splits by `--> statement-breakpoint` and executes each chunk. If the file starts with comments before the first breakpoint, Drizzle treats the comment block as an empty statement and throws `RangeError: The supplied SQL string contains no statements`. Fixed by starting the migration file directly with the first `ALTER TABLE` statement. This is a pattern all future migrations must follow.

- **`BRAND_DNA_GATE_BYPASS=true` required**: The Brand DNA Gate middleware redirects all admin users to `/lite/onboarding` until `brand_dna_profiles` has a `superbad_self + complete` row. Set `BRAND_DNA_GATE_BYPASS=true` in `.env.local` for all BDA-1 through BDA-3 development. Gate clears when BDA-3 completes Andy's profile.

---

## Artefacts produced (G7 verification)

- **Files created:** 9 new files (listed above)
- **Files edited:** 4 files (listed above)
- **Tables created:** `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites`
- **Tables altered:** `brand_dna_profiles` (18 new columns)
- **Migration written:** `lib/db/migrations/0007_bda1_brand_dna.sql` (journal idx 7)
- **Settings rows added:** none (BDA-1 reads existing `portal.magic_link_ttl_hours`)
- **Routes added:** none (BDA-1 is pure data model + infra)
- **Dependencies added:** none

---

## Verification gates

- **G1 preflight:** All 10 preconditions verified before build started ✓
- **G2 scope:** All files within whitelist. No out-of-whitelist edits. ✓
- **G4 settings-literal grep:** `portal.magic_link_ttl_hours` read via `settings.get()` — existing key, not a literal. No autonomy-sensitive numeric/string literals in production code. ✓
- **G5 motion:** BDA-1 is pure data model + invite infra. No UI surfaces, no state transitions. G5 N/A ✓
- **G6 rollback:** migration reversible — all changes additive (new tables + new columns with defaults). ✓
- **G7 artefacts:** All 9 new files + 4 edited files confirmed present via grep/ls ✓
- **G8 typecheck + tests:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 206/206 green (195 pre-BDA-1 + 11 new brand-dna-invite tests). `npm run lint` → clean ✓
- **G9 E2E:** Not applicable — BDA-1 does not touch a critical flow ✓
- **G10 browser:** Not applicable — BDA-1 has no UI surfaces ✓
- **`npm run build`:** Pre-existing Google Fonts 403 in sandbox (9 font errors, unchanged from B3 baseline). ✓

---

## Migration state after BDA-1

```
0000_init.sql                    — Drizzle journal idx 0
0001_seed_settings.sql           — Drizzle-untracked seed (70 settings rows)
0002_a6_activity_scheduled_inbox — Drizzle journal idx 2
0003_a7_email_stripe_pdf         — Drizzle journal idx 3
0004_a8_portal_auth              — Drizzle journal idx 4
0005_b1_support                  — Drizzle journal idx 5
0006_b3_legal                    — Drizzle journal idx 6
0007_bda1_brand_dna              — Drizzle journal idx 7 (this session)
```

BDA-2's migration (if any) must be `0008_bda2_*.sql`.

---

## PATCHES_OWED rows (BDA-1 — new)

1. `bda1_generic_invite_kinds` — `ACTIVITY_LOG_KINDS` has `invite_created` + `invite_used` (generic, pre-BDA-1) alongside new `brand_dna_invite_sent` + `brand_dna_invite_redeemed` (BDA-1). The generic ones are unused in BDA code. Retire them in Wave 22 SAP.
2. `bda1_invite_ttl_setting` — `brand_dna_invites.expires_at_ms` derives from `portal.magic_link_ttl_hours` (7 days). Spec says "~30 day expiry". Add `brand_dna.invite_ttl_hours` setting in BDA-2 or BDA-5.
3. `bda1_migration_comment_pattern` — Document in CLAUDE.md or a dev note that Drizzle migration files must start with SQL (no leading comments) to avoid `RangeError: The supplied SQL string contains no statements`.

---

## Open threads for BDA-2 (next session)

- **Alignment gate question**: BDA-2 builds the "Does your business represent your personality?" question at the start of the assessment. Three options → three tracks. The `brand_dna_profiles.track` column stores the answer.
- **Card UI route**: starts at `/lite/brand-dna`. The alignment gate is the first screen. Keep `BRAND_DNA_GATE_BYPASS=true` — gate clears only at BDA-3.
- **`issueBrandDnaInvite` / `redeemBrandDnaInvite`**: available at `lib/brand-dna/`. The invite redemption route (for the URL returned by `issueBrandDnaInvite`) is a BDA-2 responsibility.
- **`brand_dna_profiles.contact_id`**: for the invite redemption path, the profile is attached to the contact. For the admin/self path (Andy taking his own assessment), `contact_id = null` and `subject_type = 'superbad_self'`.
- **`logActivity` signature**: `logActivity({ contactId, kind, body, meta, createdBy })` — see `lib/activity-log.ts`.
- **Section visual environments**: art direction per section is a content mini-session concern; BDA-2 can use placeholder colour schemes pending the content session.
- **`houseSpring`**: available from `MotionProvider` / `framer-motion`; use for card transitions and between-section animations per A4 pattern.
- **BUILD_PLAN says "Haiku insight calls"** but spec §9 says "Opus" for section insights. Follow the spec — Opus is correct for between-section insights.

---

## Autonomy loop note

`RemoteTrigger` tool was not available in this environment. The hourly safety-net cron will fire the next session (Wave 3 BDA-2). This is a known environment limitation — no action required.
