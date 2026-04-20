# HP-1 Handoff — Hiring Pipeline: Data Model + Schema + Core CRUD

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Schema — 4 new tables

- **`role_briefs`** — perpetual LLM context per hiring role. Fields: role basics (name, engagement_type, rate band, hours/week, location, remote_ok, open_count), reference portfolio signals (JSON), LLM synthesis output (style_summary, extracted_tags, do/avoid lists, discovery hints), andy_overrides, regeneration/discovery timestamps. Indexes on status + engagement_type.
- **`candidates`** — every person in the pipeline at any stage. Fields: role_brief FK, stage, source, discovery_source, engagement_type, contact info, portfolio signal (cached JSON), brief_match_score, bench state (status, paused_until, rate, capacity), compliance (ABN, legal_name, agreement, bank_details), archive state. Indexes on role_brief, stage+updated_at, email, bench_status+paused_until.
- **`trial_tasks`** — one row per paid trial sent. Fields: candidate FK (cascade delete), role_brief FK, content ref, description, budget, rate, due date, delivery tracking, Andy's review (notes + rating + disposition). Indexes on candidate, role_brief, disposition.
- **`candidate_archives`** — timeline of archive events (never overwritten). Fields: candidate FK (cascade delete), stage_when_archived, reason_code, free_text, reflection, disposition_direction, un_archived_at. Index on candidate+archived_at.

### Stage model — `lib/hiring/stages.ts`

- `HIRING_STAGES` — 7-stage registry with order, label, full_time_only flag (all false in v1)
- `ARCHIVE_REASONS_BY_STAGE` — closed-list reason codes per source stage, per spec §4.5
- `SKIP_TRIAL_REASONS` — 3 reasons for Skip-Trial → Bench shortcut

### Validation — `lib/hiring/validate-candidate.ts`

- `validateCandidate()` — pure function enforcing spec §12.2 rules:
  - Bench requires ABN + agreement + bank_details + hourly_rate + capacity > 0
  - paused_until requires bench_status=paused
  - bench_status requires stage=bench

### Stage transition — `lib/hiring/transition-candidate-stage.ts`

- `transitionCandidateStage()` — transactional stage change with validation + activity logging
  - All manual transitions allowed (per spec §4.4 "Andy can drag any card to any stage")
  - Auto-sets stage_before_archive + archived_at on archive
  - Auto-clears archived_at on un-archive
  - Auto-sets bench_status=active on bench entry
  - Auto-clears bench fields on bench exit
  - Blocks bench entry without compliance (via validation)
  - Writes activity_log with correct kind per stage

### Core CRUD — `lib/hiring/queries.ts`

- **Role Briefs:** createRoleBrief, getRoleBriefById, listRoleBriefs (filter by status/engagement_type), updateRoleBrief
- **Candidates:** createCandidate, getCandidateById, listCandidates (filter by stage/source/role_brief/engagement_type/bench_status), listCandidatesByRoleBrief, updateCandidate
- **Bench queries:** getAvailableBenchMembers (filtered by active+not-paused+capacity), openBenchCount (active/paused/total)
- **Trial Tasks:** createTrialTask, getTrialTaskById, listTrialTasksByCandidate, listTrialTasks (filter by disposition/role_brief/overdue), updateTrialTask
- **Candidate Archives:** createCandidateArchive, getArchivesForCandidate, markArchiveUnarchived

### Activity log — `trial_skipped` kind added

- Spec §4.4 references `trial_skipped` for Skip-Trial → Bench, but §3.1 only listed 16 kinds. Added the 17th kind. Hiring Pipeline block now has 17 kinds.

### Migration — `0058_hp1_hiring_pipeline.sql`

- Creates all 4 tables + 10 indexes. Journal entry added.

## New files

- `lib/db/schema/role-briefs.ts`
- `lib/db/schema/candidates.ts`
- `lib/db/schema/trial-tasks.ts`
- `lib/db/schema/candidate-archives.ts`
- `lib/db/migrations/0058_hp1_hiring_pipeline.sql`
- `lib/hiring/stages.ts`
- `lib/hiring/validate-candidate.ts`
- `lib/hiring/transition-candidate-stage.ts`
- `lib/hiring/queries.ts`
- `lib/hiring/index.ts`
- `tests/hp1-hiring-pipeline.test.ts` (30 tests)

## Edited files

- `lib/db/schema/index.ts` — added 4 new schema re-exports
- `lib/db/schema/activity-log.ts` — added `trial_skipped` kind
- `lib/db/migrations/meta/_journal.json` — added migration entry

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 236 files, 2096 passed, 1 skipped (pre-existing)
- Browser check: not applicable (schema + queries, no UI)

## Key decisions

- **Renamed `CANDIDATE_SOURCES` → `HIRING_CANDIDATE_SOURCES`** to avoid export collision with `lead-candidates.ts` which already exports `CANDIDATE_SOURCES` through the schema barrel.
- **No legal-transitions map.** Spec §4.4 says "Andy can drag any card to any stage" — all transitions are manually allowed. Constraints are enforced by `validateCandidate()` on the simulated target state (bench compliance gate), not by a restricted transitions map.
- **`getAvailableBenchMembers()` filters in JS** rather than pure SQL because the role-matching logic (matching bench members to a role string) needs the role_brief relationship which is cleaner in application code. Later HP sessions may optimize if needed.
- **`trial_skipped` kind added** — spec §4.4 explicitly mentions this kind but §3.1's enumeration missed it. Added to maintain completeness.

## Rollback

- Git-revertable: migration creates new tables only, no existing table modifications
- Schema additions are additive — removing them has no effect on existing features
- Activity log `trial_skipped` kind is additive — no existing code references it

## Settings keys consumed

- None directly in HP-1 (schema + CRUD layer; settings consumption starts in HP-2+)

## Next session should know

- HP-2 should build the Role Brief authoring wizard (uses WizardDefinition from Setup Wizards, consumes `createRoleBrief()` + `updateRoleBrief()`)
- `getAvailableBenchMembers()` and `openBenchCount()` are ready for Task Manager and Daily Cockpit consumption
- The 28 hiring settings keys are already seeded in `0001_seed_settings.sql`
- `HiringCandidateSource` (not `CandidateSource`) is the type name — lead-gen owns the `CandidateSource` name
