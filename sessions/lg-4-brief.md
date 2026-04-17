# `LG-4` — Lead Gen orchestrator (daily run cron handler) — Session Brief

> **Pre-compiled by LG-3 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-4`
- **Wave:** `13 — Lead Generation` (4 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~14k tokens (brief + excerpts + last 2 handoffs + skill). Well under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Daily run sequence §3.4

Source: `docs/specs/lead-generation.md` §3.4

```
Daily run sequence (steps 1–7, LG-4 scope; steps 8–12 belong to LG-5/LG-6/LG-8):

1.  Compute today's send budget:
    effective_cap = warmup_daily_cap − scheduled_sequence_touches_today
    target = min(settings.max_per_day, effective_cap)
    If target ≤ 0: log run summary with capped_reason, exit.

2.  Query all sources in parallel for the standing brief (or manual brief if override).
    Per-source failures logged to lead_runs.error; run continues with remaining sources.

3.  Deduplicate against:
    - `lead_candidates.email_or_domain` within dedup window
    - `deals` (any existing deal for the same company/domain)
    - `dnc_emails`, `dnc_domains`, `companies.do_not_contact` (via isBlockedFromOutreach)

4.  Enrich each survivor with the 9-signal set in parallel.

5.  Build viabilityProfile for each.

6.  Score against both rulesets:
    - qualification floor check per track
    - winner-takes-all track assignment
    - discard if fails floor on both

7.  Take top `target` by score, within warmup budget.

NOTE: LG-4 stubs steps 1 (enforceWarmupCap is LG-6) and 6 (scoring is LG-5).
      Steps 8–12 (Hunter.io, Claude draft, drift check, approval queue) are LG-8.

Build-time discipline §12.A: step 1 (enforceWarmupCap) and step 3 (isBlockedFromOutreach)
are the only two functions that gate Lead Gen writes. LG-4 must call both.
```

### Excerpt 2 — enforceWarmupCap contract §10.2

Source: `docs/specs/lead-generation.md` §10.2

```typescript
// lib/lead-gen/warmup.ts — LG-6 will build this; LG-4 stubs it
export async function enforceWarmupCap(): Promise<{
  cap: number
  used: number
  remaining: number
  can_send: boolean
}>
```

### Excerpt 3 — lead_runs schema §4.5

Source: `docs/specs/lead-generation.md` §4.5

```
lead_runs columns used by LG-4:
  id, trigger ('scheduled' | 'run_now' | 'manual_brief'), started_at_ms,
  completed_at_ms, candidates_found, candidates_after_dedup, candidates_enriched,
  candidates_qualified, budget_cap, budget_used, error (nullable), settings_snapshot_json
```

### Excerpt 4 — kill-switch gate §12

Source: `docs/specs/lead-generation.md` §12.A

```
The cron handler must check lead_gen_enabled kill switch before running.
If disabled: log a capped_reason='kill_switch_disabled' lead_run row and exit.
```

**Audit footer:**
- `docs/specs/lead-generation.md` §3.4 — daily run sequence (steps 1–7)
- `docs/specs/lead-generation.md` §10.2 — enforceWarmupCap contract
- `docs/specs/lead-generation.md` §4.5 — lead_runs schema

## 2a. Visual references

None — `FEATURE` type, no UI surface.

---

## 3. Acceptance criteria

```
LG-4 is done when:

1. lib/lead-gen/warmup.ts exports a stub enforceWarmupCap():
   - Returns { cap: 10, used: 0, remaining: 10, can_send: true } always
   - TypeScript type matches §10.2 exactly
   - Marked with TODO comment: "LG-6 will implement real warmup ramp"
   - NOTE: LG-6 will replace this stub with the real implementation

2. lib/lead-gen/dedup.ts exports deduplicateCandidates(candidates, dedupWindowDays):
   - Queries lead_candidates for existing email_or_domain within dedup window
   - Queries deals for existing company domain match
   - Calls isBlockedFromOutreach() for DNC check
   - Returns filtered DiscoveryCandidate[] (survivors only)

3. lib/lead-gen/orchestrator.ts exports runLeadGenDaily(trigger):
   - trigger: 'scheduled' | 'run_now' | 'manual_brief'
   - Step 1: checks lead_gen_enabled kill switch; exits with lead_run row if disabled
   - Step 1b: calls enforceWarmupCap(); exits if remaining === 0
   - Step 2: calls all 3 source adapters in parallel with settings from settings.get()
   - Step 3: calls deduplicateCandidates() to filter results
   - Step 4: calls all 6 enrichers in parallel for each survivor; merges via mergeProfiles()
   - Step 6: stub scoring — scoreForSaasTrack(profile) and scoreForRetainerTrack(profile)
             both return { score: 0, breakdown: {}, qualifies: false }
             (marked TODO: LG-5 replaces these stubs)
   - Step 7: takes top min(target, survivors.length) by score
   - Step 12: inserts lead_run summary row with all metrics
   - Returns lead_run summary object

4. app/api/cron/lead-gen-daily/route.ts:
   - POST handler only
   - Calls runLeadGenDaily('scheduled')
   - Protected by CRON_SECRET header check (grep .env.example for CRON_SECRET)
   - Returns 200 JSON with lead_run summary on success, 500 on unhandled error

5. lib/lead-gen/index.ts updated to re-export:
   - enforceWarmupCap from ./warmup
   - deduplicateCandidates from ./dedup
   - runLeadGenDaily from ./orchestrator

6. tests/lead-gen/lg4-orchestrator.test.ts passes:
   - enforceWarmupCap: returns correct shape
   - deduplicateCandidates: filters existing domains + DNC, passes through new candidates
   - runLeadGenDaily: happy path — calls adapters, enrichers, dedup, returns run summary
   - runLeadGenDaily: kill-switch disabled — returns immediately with capped reason
   - runLeadGenDaily: warmup cap = 0 — returns immediately
   - runLeadGenDaily: source adapter failure — run continues with remaining sources

7. npx tsc --noEmit → 0 errors
8. npm test → green
9. npm run build → clean
10. npm run lint → clean
```

---

## 4. Skill whitelist

- `drizzle-orm` — db queries for dedup (lead_candidates, deals) + lead_runs insert

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/warmup.ts` — new — stub enforceWarmupCap
- `lib/lead-gen/dedup.ts` — new — deduplication helper
- `lib/lead-gen/orchestrator.ts` — new — runLeadGenDaily
- `app/api/cron/lead-gen-daily/route.ts` — new — cron POST handler
- `lib/lead-gen/index.ts` — edit — add warmup + dedup + orchestrator exports
- `tests/lead-gen/lg4-orchestrator.test.ts` — new

---

## 6. Settings keys touched

- **Reads:**
  - `lead_generation.daily_search_enabled` (kill-switch check before enforceWarmupCap)
  - `lead_generation.daily_max_per_day`
  - `lead_generation.dedup_window_days`
  - `lead_generation.location_radius_km`
  - `lead_generation.location_centre`
  - `lead_generation.category`
  - `lead_generation.standing_brief`
- **Seeds (new keys):** none — all keys already seeded by LG-1

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/sources/index.ts` exists — verify: `ls lib/lead-gen/sources/index.ts`
- [ ] `lib/lead-gen/enrichment/index.ts` exists — verify: `ls lib/lead-gen/enrichment/index.ts`
- [ ] `mergeProfiles` exported from enrichment — verify: `grep "export function mergeProfiles" lib/lead-gen/enrichment/index.ts`
- [ ] `isBlockedFromOutreach` exported from lead-gen — verify: `grep "isBlockedFromOutreach" lib/lead-gen/index.ts`
- [ ] `lead_candidates` table defined — verify: `grep "lead_candidates" lib/db/schema/lead-candidates.ts`
- [ ] `lead_runs` table defined — verify: `grep "lead_runs" lib/db/schema/lead-runs.ts`
- [ ] `lead_gen_enabled` kill switch exists — verify: `grep "lead_gen_enabled" lib/kill-switches.ts`
- [ ] `CRON_SECRET` env var declared — verify: `grep "CRON_SECRET" .env.example`
- [ ] `npx tsc --noEmit` passes before starting (carry-forward from LG-3)

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — pure helper files + cron route, no new migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `lib/lead-gen/warmup.ts` exists with stub `enforceWarmupCap`
- [ ] `lib/lead-gen/dedup.ts` exists with `deduplicateCandidates`
- [ ] `lib/lead-gen/orchestrator.ts` exists with `runLeadGenDaily`
- [ ] `app/api/cron/lead-gen-daily/route.ts` exists with POST handler
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: PASS
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-5)

LG-5 builds the scoring engine:
- `scoreForSaasTrack(profile: ViabilityProfile): { score: number; breakdown: Record<string, number>; qualifies: boolean }`
- `scoreForRetainerTrack(profile: ViabilityProfile): { score: number; breakdown: Record<string, number>; qualifies: boolean }`
- These replace the stubs in `lib/lead-gen/orchestrator.ts`
- LG-5 also builds `lib/lead-gen/scoring.ts` with the full qualification floor + scoring rubric from the spec
- After LG-5, LG-4's orchestrator can be patched to use real scoring (or LG-5 patches it directly)

Key spec reference: `docs/specs/lead-generation.md` §5 (viabilityProfile fields), §6 (scoring rubric), §7 (qualification floor per track).
