# `LG-4` — Lead Gen orchestrator — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (4 of 10)
**Model tier:** Sonnet (native)

## What was built

- **`lib/lead-gen/warmup.ts`** — `enforceWarmupCap()` stub returning `{ cap: 10, used: 0, remaining: 10, can_send: true }`. TODO comment for LG-6.
- **`lib/lead-gen/dedup.ts`** — `deduplicateCandidates(candidates, dedupWindowDays, db?)`. Three layers: (1) `lead_candidates.domain` within dedup window, (2) `companies.domain` joined to existing deals, (3) `isBlockedFromOutreach()` per candidate. Within-batch deduplication included.
- **`lib/lead-gen/orchestrator.ts`** — `runLeadGenDaily(trigger)`. Steps 1–7 + step 12: kill-switch gate → warmup cap check → settings read → parallel source adapter calls (`Promise.allSettled`) → dedup → parallel per-candidate enrichment (`Promise.allSettled`) → stub scoring (both tracks return `qualifies: false` — LG-5 replaces) → top-N selection → `lead_runs` insert. Returns `LeadRunSummary`.
- **`app/api/cron/lead-gen-daily/route.ts`** — POST handler, `x-cron-secret` header check, calls `runLeadGenDaily('scheduled')`.
- **`lib/lead-gen/index.ts`** — Updated: re-exports `enforceWarmupCap`, `WarmupCapResult`, `deduplicateCandidates`, `runLeadGenDaily`, `LeadRunSummary`.
- **`.env.example`** — `CRON_SECRET` added (G1 precondition gap patched in-session).
- **`tests/lead-gen/lg4-orchestrator.test.ts`** — 18 tests: warmup stub shape, dedup domain/deal/DNC filtering, orchestrator happy-path/kill-switch/cap/adapter-failure/fetchError/multi-source.

## Key decisions

- `deduplicateCandidates` uses synthetic `dedup@${domain}` email to trigger domain-level DNC path (candidates have no `contact_email` at this stage — Hunter.io is LG-8).
- `lead_candidates` rows are NOT inserted by LG-4; the orchestrator only inserts the `lead_runs` audit row. Candidate insertion is LG-8's job (after email resolution).
- Stub scoring returns `qualifies: false` for both tracks intentionally — LG-5 patches this with real weights. Until LG-5, `qualified_count` is always 0 in run summaries.
- `CRON_SECRET` was missing from `.env.example` (G1 gap). Patched in-session; logged to PATCHES_OWED.

## Artefacts produced

- `lib/lead-gen/warmup.ts` (new)
- `lib/lead-gen/dedup.ts` (new)
- `lib/lead-gen/orchestrator.ts` (new)
- `app/api/cron/lead-gen-daily/route.ts` (new)
- `lib/lead-gen/index.ts` (edited — 5 new exports)
- `.env.example` (edited — CRON_SECRET)
- `tests/lead-gen/lg4-orchestrator.test.ts` (new — 18 tests)

## Verification

- G8: `npx tsc --noEmit` → 0 errors. `npm test` → 174 test files passed (18 new). `npm run build` → clean. `npm run lint` → 0 errors (72 warnings — pre-existing baseline).
- G10.5 (non-UI): fidelity grep — all AC keywords present, all whitelist files covered, no out-of-whitelist edits. PASS.

## Rollback strategy

`git-revertable, no data shape change` — pure helper files + cron route, no new migrations.

## PATCHES_OWED

- **`lg_4_cron_secret_missing_from_env_example`** — `CRON_SECRET` was absent from `.env.example` despite being a G1 precondition. Patched in-session. Root cause: LG-4 brief listed it as a precondition but LG-1/LG-2 never added it. Future briefs that add cron routes must add the key to `.env.example` in their own session.
- **`lg_4_lead_candidates_not_inserted_by_orchestrator`** — LG-4 orchestrator does not insert `lead_candidates` rows (that's LG-8 post-Hunter.io). LG-8 must query `lead_candidates`-equivalent state from the run OR the orchestrator must be extended to insert partial rows. LG-8 brief should clarify the contract.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G10.5 verdict

Non-UI session — fidelity grep: PASS. All AC keywords (`enforceWarmupCap`, `deduplicateCandidates`, `runLeadGenDaily`, `CRON_SECRET`, lead_run insert, kill-switch gate) present in new files. No out-of-whitelist edits. No memory violations.

## What LG-5 inherits

- `lib/lead-gen/orchestrator.ts` contains two stub functions (`scoreForSaasTrack`, `scoreForRetainerTrack`) marked TODO. LG-5 replaces these with `lib/lead-gen/scoring.ts` exports.
- Qualification floors: SaaS = 40/100, Retainer = 55/100 (spec §6.2).
- After LG-5, the orchestrator's step 6 will discard below-floor candidates and `qualified_count` will be meaningful.
