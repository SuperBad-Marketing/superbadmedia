# `lg-1` — Lead Generation data model + schema — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (1 of 10) — **Wave 13 opener**
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. New tables (8)

All in `lib/db/schema/` with corresponding migration `0043_lg1_lead_generation.sql`:

- **`lead_candidates`** — prospect pool. Full spec §4.1 columns + §16.6 reactive scoring columns (reactive_adjustment, rescored_at, rescore_count, below_floor_after_rescore, track_change_used, previous_track, track_changed_at). Indexed on run, track, domain, promoted_to_deal_id.
- **`outreach_drafts`** — Claude-generated drafts through approval. 6-state status enum (pending_approval → approved_queued → sent → rejected/superseded/expired). FK to user for approved_by.
- **`outreach_sends`** — authoritative send records with full engagement signal columns (open counts, click counts, dwell time, bounce kind, engagement tier).
- **`outreach_sequences`** — per-contact thread state machine. 7-state status enum. Engagement cutoff counter (default threshold 3).
- **`lead_runs`** — append-only audit log. Trigger enum (scheduled/run_now/manual_brief). Per-run cap metrics.
- **`dnc_emails`** + **`dnc_domains`** — blocklists with source tracking and user attribution.
- **`resend_warmup_state`** — single-row warmup ramp config.
- **`autonomy_state`** — per-track (saas/retainer) earned autonomy. 4-mode state machine (manual/probation/auto_send/circuit_broken). Seeded with both track rows.

### 2. DNC enforcement function

**`lib/lead-gen/dnc.ts`** — `isBlockedFromOutreach(email, companyId?)` is the ONLY read path for DNC rules (§12.J). Check order: company → email → domain. Also exports `addDncEmail()`, `addDncDomain()`, `removeDncEmail()`, `removeDncDomain()` with normalisation (§12.K).

### 3. Sender identity

**`lib/lead-gen/sender.ts`** — `SUPERBAD_SENDER` constant and `SUPERBAD_FROM_STRING`. Single sender per §10.3 Q13.

### 4. Barrel export

**`lib/lead-gen/index.ts`** — re-exports DNC functions + sender identity.

### 5. Settings keys (14)

9 Lead Generation keys (`lead_generation.*`) + 5 warmup ramp keys (`warmup.*`). All seeded in migration 0043.

### 6. Kill switch

`lead_gen_enabled` added to kill-switches.ts (default OFF).

### 7. Enum extensions

- **`contacts.email_status`** — gained `'unsubscribed'` value (6th value).
- **`activity_log.kind`** — gained 4 reactive scoring kinds: `candidate_rescored`, `candidate_track_changed`, `candidate_track_change_suppressed`, `candidate_below_floor`.
- **`scheduled_tasks.task_type`** — gained 4 Lead Gen types: `lead_gen_daily_search`, `sequence_scheduler`, `engagement_tier_evaluator`, `auto_send_execute`.

### 8. CE-13 gate flip

`isLeadGenAvailable()` in `lib/content-engine/outreach-match.ts` flipped from `return false` to `return true`. Content-to-outreach matching pipeline now passes Gate 4 when Lead Gen tables exist.

## Files created

- `lib/db/schema/lead-candidates.ts`
- `lib/db/schema/outreach-drafts.ts`
- `lib/db/schema/outreach-sends.ts`
- `lib/db/schema/outreach-sequences.ts`
- `lib/db/schema/lead-runs.ts`
- `lib/db/schema/dnc.ts`
- `lib/db/schema/resend-warmup-state.ts`
- `lib/db/schema/autonomy-state.ts`
- `lib/db/migrations/0043_lg1_lead_generation.sql`
- `lib/lead-gen/dnc.ts`
- `lib/lead-gen/sender.ts`
- `lib/lead-gen/index.ts`
- `tests/lead-gen/lg1-schema.test.ts`
- `tests/lead-gen/lg1-dnc.test.ts`

## Files edited

- `lib/db/schema/index.ts` — 8 new barrel exports
- `lib/db/schema/contacts.ts` — `unsubscribed` added to email_status
- `lib/db/schema/activity-log.ts` — 4 reactive scoring kinds
- `lib/db/schema/scheduled-tasks.ts` — 4 Lead Gen task types
- `lib/db/migrations/meta/_journal.json` — idx 43
- `lib/kill-switches.ts` — `lead_gen_enabled`
- `lib/settings.ts` — 14 new keys in registry
- `lib/content-engine/outreach-match.ts` — gate flip
- `tests/settings.test.ts` — count updated 123 → 137, idempotency count
- `tests/crm/schema.test.ts` — email_status length 5 → 6
- `tests/content-engine/ce13-outreach-match.test.ts` — gate now passes

## Verification (G0–G12)

- **G0** — CE-13 and CE-12 handoffs read. Lead Gen spec read. BUILD_PLAN Wave 13 read.
- **G1** — Preconditions verified: `companies.do_not_contact`, `deals` table, `user` table, `settings` table, `activity_log` kinds, `scheduled_tasks` types — all present.
- **G2** — Files match LG-1 scope (data model + DNC enforcement + sender identity + tests).
- **G3** — No motion work.
- **G4** — No numeric/string literals in autonomy-sensitive paths. All thresholds are schema defaults or settings keys.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — Migration 0043 additive (new tables + INSERT OR IGNORE). Rollback: migration reversible (drop 8 tables + remove 14 settings rows).
- **G7** — 0 TS errors, 171 test files / 1394 passed + 1 skipped (+44 new), clean production build, lint 0 errors (70 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1394 passed. `npm run build` → success. `npm run lint` → 0 errors.
- **G9** — No browser-testable surface. Data model session.
- **G10** — Schema exports + enum values + DNC enforcement + sender identity exercised by 44 unit tests.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`lg_1_dnc_management_surface`** — DNC management UI (Settings → Lead Generation → Do Not Contact) not built. BUILD_PLAN spec §20 #1 bundles it with schema, but it's a UI surface. Deferring to LG-7 (UI session) or a dedicated mini-session.
- **`lg_1_settings_registry_doc_update`** — `docs/settings-registry.md` needs 14 new rows (9 lead_generation.* + 5 warmup.*). Deferred to avoid touching docs in a schema session.

## PATCHES_OWED (closed this session)

- **`ce_13_lead_gen_wiring`** — `isLeadGenAvailable()` flipped to `true`.

## Rollback strategy

Migration 0043 is reversible. Drop all 8 new tables + delete 14 settings rows + delete 2 autonomy_state seed rows. Schema file removal + barrel un-export + enum value removal. No existing data affected.

## What the next session (LG-2) inherits

LG-2 is **Enrichment pipeline part 1: Meta Ad Library + Google Maps + Google Ads Transparency Center** — the three primary discovery sources. LG-1 provides:

- **All 8 tables** ready for candidate creation, draft storage, sequence tracking.
- **`isBlockedFromOutreach()`** for dedup step 3 of the daily run.
- **`SUPERBAD_SENDER`** for outbound identity.
- **`lead_gen_enabled`** kill switch for handler gating.
- **14 settings keys** for search config + warmup ramp caps.
- **Autonomy state seeded** for both tracks (saas + retainer, both in `manual` mode).
