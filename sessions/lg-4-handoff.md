# `lg-4` — Scoring engine + candidate creation + daily cron skeleton — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (4 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Scoring engine

**`lib/lead-gen/scoring.ts`** — four pure functions (§12.B: only location for scoring rules):

- `scoreForSaasTrack(profile, softAdjustment?)` — SaaS track scorer with four sub-scorers (advertising 0–20, web 0–30, social 0–25, maps 0–25). SaaS-favourable signals: low PageSpeed (DIY site), young domain, solo/small team, budget pricing tier, moderate social following.
- `scoreForRetainerTrack(profile, softAdjustment?)` — Retainer track scorer with four sub-scorers (advertising 0–25, web 0–30, social 0–25, maps 0–20). Retainer-favourable signals: high ad spend, high PageSpeed, old domain, large team, premium pricing, large social following.
- `assignTrack(profile, softAdjustment?)` — Winner-takes-all per §6.3. Returns `{ track, score, saas, retainer }`.
- `rescoreCandidate(args)` — Reactive ICP scoring per §16. Deterministic rules, no LLM. Engagement adjustments (click +5 cap +15, full open +2 cap +6, sub-60s +0, none -2 cap -8), reply adjustments (positive +12, objection/question +5, negative -15), responsiveness pattern (24h +4, 72h +2, no reply after 3+ touches -3), file note +3, hard bounce -10. Total clamped to [-20, +25]. Track change detection with one-change cap.

**Exported constants:** `SAAS_FLOOR=40`, `RETAINER_FLOOR=55`, `REACTIVE_MIN=-20`, `REACTIVE_MAX=25`.

### 2. Candidate creation

**`lib/lead-gen/candidate.ts`** — `createCandidate(input, db?)`:

- Inserts a `lead_candidates` row from enriched + scored data.
- Populates `scoring_debug_json` for auditability (§12.D).
- Writes `candidate_rescored` activity log row (§12.R).
- Returns `{ candidateId, track, score }`.

### 3. Daily search runner

**`lib/lead-gen/daily-search.ts`** — `runDailySearch(input, db?)`:

- Full §3.4 pipeline skeleton: kill-switch gate → compute budget → discover → dedup → enrich → score → create candidates → write `lead_runs` summary.
- Steps 8–10 (Hunter.io contact discovery, draft generation, drift check) are **stubbed** — LG-5 wires them.
- Warmup enforcement is **stubbed** with `settings.max_per_day` as the cap — LG-6 replaces with `enforceWarmupCap()`.
- Dedup against: existing `lead_candidates` within dedup window, existing `companies`, and DNC list via `isBlockedFromOutreach()`.
- `next3amMelbourneMs()` — DST-safe next-3am scheduler using `Intl.DateTimeFormat`.

### 4. Scheduled-task handler

**`lib/scheduled-tasks/handlers/lead-gen-daily-search.ts`**:

- `handleLeadGenDailySearch` — kill-switch gate, delegates to `runDailySearch`, self-perpetuating via `enqueueTask`.
- `ensureLeadGenDailySearchEnqueued()` — bootstrap export for setup wizard / "Run now".
- Registered in `HANDLER_REGISTRY`.

### 5. Barrel exports

**`lib/lead-gen/index.ts`** updated with all LG-4 exports: scoring functions + types, candidate creation, daily search runner.

## Files created

- `lib/lead-gen/scoring.ts`
- `lib/lead-gen/candidate.ts`
- `lib/lead-gen/daily-search.ts`
- `lib/scheduled-tasks/handlers/lead-gen-daily-search.ts`
- `tests/lead-gen/lg4-scoring.test.ts`
- `tests/lead-gen/lg4-daily-search.test.ts`

## Files edited

- `lib/lead-gen/index.ts` — LG-4 barrel exports added
- `lib/scheduled-tasks/handlers/index.ts` — LEAD_GEN_DAILY_SEARCH_HANDLERS registered

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Scoring sub-category caps.** Each signal category (advertising, web, social, maps) is independently capped to prevent a single dominant signal from inflating the total. SaaS: 20/30/25/25. Retainer: 25/30/25/20.

2. **SaaS favours low PageSpeed, retainer favours high.** A bad website is a SaaS-positive signal (they need tools) but a retainer-negative signal (they may not have agency budget). This is the strongest differentiator between tracks.

3. **Team size is the second strongest differentiator.** Solo/small → SaaS, medium/large → retainer. Aligns with the spec's "lean-team, DIY-leaning" SaaS definition.

4. **Reactive scoring recomputes base scores from viability profile.** Rather than applying reactive adjustments to the stored `currentSaasScore`/`currentRetainerScore`, we recompute base scores fresh from the viability profile and add the clamped reactive adjustment. This prevents score drift from accumulated floating-point errors across many rescores.

5. **Dedup uses domain-level DNC check with placeholder email.** At dedup time (step 3), the candidate's contact email isn't known yet (Hunter.io runs at step 8). We check `isBlockedFromOutreach("unknown@domain")` to trigger domain-level DNC only.

6. **Search params fetch 3× the daily cap.** `max_candidates = maxPerDay * 3` ensures the scoring pipeline has enough candidates to fill the cap after disqualification. The excess is discarded after top-N sorting.

## Verification (G0–G12)

- **G0** — LG-3 and LG-2 handoffs read. Spec §6, §16, §3.4 read. BUILD_PLAN Wave 13 read.
- **G1** — Preconditions verified: `ViabilityProfile` type, `enrichCandidate()`, `runDiscovery()`, `isBlockedFromOutreach()`, `enqueueTask()`, `logActivity()`, `leadCandidates` + `leadRuns` schema, `lead_gen_daily_search` in `SCHEDULED_TASK_TYPES`, settings keys — all present.
- **G2** — Files match LG-4 scope (scoring + candidate creation + daily search + handler + tests).
- **G3** — No motion work.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Qualification floors and reactive adjustment bounds are constants per §12.C and §12.X.
- **G5** — Context budget held. Medium session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 185 test files / 1537 passed + 1 skipped (+40 new), clean production build.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1537 passed.
- **G9** — No browser-testable surface. Library-only session.
- **G10** — Scoring engine has 37 tests covering all rule paths, caps, bounds, track assignment, and reactive scoring. Daily search has 3 tests for `next3amMelbourneMs`.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`lg_4_warmup_enforcement_stub`** — `runDailySearch` uses `settings.max_per_day` as the warmup cap. LG-6 replaces with `enforceWarmupCap()` reading from `resend_warmup_state`.
- **`lg_4_draft_generation_stub`** — Steps 8–10 of §3.4 (Hunter.io + draft generation + drift check) are stubbed. LG-5 wires them.
- **`lg_4_scoring_weights_tuning`** — Sub-scorer weights are educated guesses. Real-world data (v1.1) may require rebalancing. The pure-function architecture makes this trivial.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Scoring engine
- Candidate creation helper
- Daily search runner
- Scheduled-task handler + handler registry entry
- Barrel export additions
- Test files

## What the next session (LG-5) inherits

LG-5 is **Draft generator + Brand Voice integration + drift check wiring** — the Claude API calls for outreach draft generation. LG-4 provides:

- **`assignTrack()` + `createCandidate()`** — scoring and candidate insertion are ready. The daily search runner calls them in sequence.
- **`runDailySearch()`** — the full pipeline skeleton. LG-5 needs to wire Hunter.io contact discovery (step 8), draft generation via `generateDraft()` (step 9), and drift check (step 10) into the existing pipeline.
- **Scoring debug JSON** — every candidate created has a full `scoring_debug_json` for downstream auditability.
- **Self-perpetuating cron** — the handler + bootstrap export are ready for the setup wizard to call.
