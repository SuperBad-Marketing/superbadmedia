# `LG-4` — Orchestrator: daily run (steps 1–7) + warmup cap — Session Brief

> **Pre-compiled by LG-3 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references.

---

## 1. Identity

- **Session id:** `LG-4`
- **Wave:** `13 — Lead Generation` (4 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~14k tokens (brief + excerpts + last 2 handoffs + drizzle skill). Well under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Daily run sequence (§3.4)

Source: `docs/specs/lead-generation.md` §3.4

```
The 3am cron (or "Run now" click, or "manual_brief" click) executes:

1.  Compute today's send budget:
    effective_cap = warmup_daily_cap − scheduled_sequence_touches_today
    target = min(settings.max_per_day, effective_cap)
    If target ≤ 0: log run summary with capped_reason, exit.

2.  Query all sources in parallel for the standing brief (or manual brief if override).
    Per-source failures logged to lead_runs.error; run continues with remaining sources.

3.  Deduplicate against:
    - lead_candidates.email_or_domain within dedup window
    - deals (any existing deal for the same company/domain)
    - dnc_emails, dnc_domains, companies.do_not_contact (via isBlockedFromOutreach)

4.  Enrich each survivor with the 9-signal set in parallel.
    Per-source failures logged; run continues with remaining sources.
    Each enrichment call is optional — profile degrades gracefully.

5.  Build viabilityProfile for each (mergeProfiles over discovery + enrichment partials).

6.  Score against both rulesets:
    - qualification floor check per track
    - winner-takes-all track assignment
    - discard if fails floor on both

7.  Take top `target` by score, within warmup budget.

Build-time discipline §12.A: step 1 (enforceWarmupCap()) and step 3 (isBlockedFromOutreach())
are the only two functions that gate Lead Gen writes.
```

**IMPORTANT for LG-4**: Build steps 1–7 only. Steps 8–12 (Hunter.io, draft generation,
brand voice check, candidate insert, final lead_runs commit) are deferred to LG-6/LG-7.
LG-4 returns the scored candidate list + writes a preliminary lead_runs row.
Scoring (step 6) is STUBBED — see §3 acceptance criteria.

### Excerpt 2 — enforceWarmupCap (§10.2)

Source: `docs/specs/lead-generation.md` §10.2

```typescript
// lib/lead-gen/warmup.ts
export async function enforceWarmupCap(): Promise<{
  cap: number
  used: number
  remaining: number
  can_send: boolean
}>
```

```
Cap is per calendar day Melbourne timezone. Resets at midnight Melbourne local.
Applies to ALL outbound Lead Gen sends combined — first touches, follow-ups, manual overrides.
Does NOT apply to transactional, magic-link, Stripe receipts, newsletter sends.

Warmup ramp (from resend_warmup_state.started_at):
  Week 1: 5   Week 2: 10   Week 3: 15   Week 4: 20   Week 5+: 30

Build-time discipline §12.I: enforceWarmupCap() is the ONLY function that reads or writes
resend_warmup_state. Week progression computed from started_at, not manually advanced.
```

Settings keys consumed:
- `warmup.week_one_cap`, `warmup.week_two_cap`, `warmup.week_three_cap`,
  `warmup.week_four_cap`, `warmup.graduated_cap`
- `lead_generation.daily_max_per_day`

`used` count = outreach_sends rows sent today (Melbourne calendar day).
`cap` = warmup ramp cap for current week (from resend_warmup_state.started_at age).
`remaining` = max(0, cap − used).
`can_send` = remaining > 0.

### Excerpt 3 — Dedup query (§3 — derived from spec dedup rules)

```
Dedup logic (step 3 of daily run):
  A candidate is excluded if ANY of:
  - lead_candidates.domain matches candidate.domain AND
    lead_candidates.created_at > now − settings.lead_generation.dedup_window_days * 86400
  - lead_candidates.email_or_domain matches candidate.domain (same window)
  - deals table has a row for the same company domain (any status)
  - isBlockedFromOutreach(null, companyId?) returns true for the domain

companyId lookup: query companies table for domain match.
Use raw SQL / Drizzle .where() clauses for dedup — do NOT loop in-memory for large sets.
```

### Excerpt 4 — Scoring stub contract

```typescript
// lib/lead-gen/scoring-stub.ts (temporary — patched out when LG-5 ships)
export interface ScoreResult {
  saasScore: number       // 0–100
  retainerScore: number   // 0–100
  qualifiedTrack: 'saas' | 'retainer' | null
  qualifies: boolean
}

export function scoreCandidate(_profile: ViabilityProfile): ScoreResult {
  return { saasScore: 0, retainerScore: 0, qualifiedTrack: 'saas', qualifies: true }
}
// Stub: all candidates pass with score 0. LG-5 replaces this with real scoring rules.
// qualifies: true so the stub doesn't silently discard all candidates.
```

### Excerpt 5 — lead_runs schema (§4.5, summary)

```
lead_runs table (LG-1 built it):
  id, trigger (scheduled|run_now|manual_brief), manual_brief_text?,
  candidates_found, candidates_qualified, candidates_capped,
  capped_reason?, error?, started_at_ms, completed_at_ms?
  (Note: exact column names — grep lib/db/schema/lead-runs.ts before writing insert)
```

**Audit footer:**
- `docs/specs/lead-generation.md` §3.4 — daily run pipeline
- `docs/specs/lead-generation.md` §10.2 — enforceWarmupCap contract
- `docs/specs/lead-generation.md` §12.A + §12.I — build-time discipline

## 2a. Visual references

None — `FEATURE` type, no UI surface.

---

## 3. Acceptance criteria

```
LG-4 is done when:

1. lib/lead-gen/warmup.ts exports enforceWarmupCap():
   - Reads resend_warmup_state.started_at to compute current warmup week
   - Computes cap from settings (warmup.week_N_cap / warmup.graduated_cap)
   - Counts outreach_sends today (Melbourne calendar day via created_at_ms)
   - Returns { cap, used, remaining, can_send }
   - Is the ONLY reader/writer of resend_warmup_state (§12.I)

2. lib/lead-gen/scoring-stub.ts exports scoreCandidate(profile):
   - Temporary stub returning { saasScore: 0, retainerScore: 0, qualifiedTrack: 'saas', qualifies: true }
   - Comment: "Stub — patched by LG-5"

3. lib/lead-gen/orchestrator.ts exports runDailySearch(trigger, manualBrief?):
   - Step 1: calls enforceWarmupCap(). If remaining === 0: writes lead_runs row
     (capped_reason: "warmup_cap_exhausted"), returns early.
   - Step 2: runs searchMetaAdLibrary, searchGoogleMaps, searchGoogleAdsTransparency
     in parallel with input from settings (location_centre, location_radius_km, category,
     max_candidates_per_run). Per-source failures logged to run error log; run continues.
   - Step 3: deduplicates survivors against lead_candidates (domain, dedup_window_days),
     deals (domain), and DNC via isBlockedFromOutreach.
   - Step 4: enriches each survivor with all 6 enrichers in parallel.
   - Step 5: calls mergeProfiles([discoveryPartial, ...enrichmentPartials]) for each.
   - Step 6: calls scoreCandidate(profile) for each; discards those where !qualifies.
   - Step 7: sorts by saasScore + retainerScore, takes top N (N = min(target, remaining)).
   - Writes lead_runs row with candidates_found, candidates_qualified, candidates_capped,
     started_at_ms, completed_at_ms.
   - Returns ScoredCandidate[] (see type below).

   Type:
   interface ScoredCandidate {
     businessName: string
     domain: string | null
     location: string | null
     phone: string | null
     source: DiscoveryCandidate['source']
     viabilityProfile: ViabilityProfile
     saasScore: number
     retainerScore: number
     qualifiedTrack: 'saas' | 'retainer'
   }

4. lib/lead-gen/index.ts updated to re-export enforceWarmupCap + runDailySearch.

5. tests/lead-gen/lg4-orchestrator.test.ts passes:
   - enforceWarmupCap: happy path (week 1 cap, used count, remaining calc)
   - enforceWarmupCap: returns can_send: false when used >= cap
   - runDailySearch: returns [] and writes capped lead_runs row when warmup exhausted
   - runDailySearch: runs sources + enrichers + scoring, returns ScoredCandidate[]
   - runDailySearch: dedup removes candidate with known domain
   - runDailySearch: per-source adapter failure is tolerated (run continues)

6. npx tsc --noEmit → 0 errors
7. npm test → green
8. npm run build → clean
9. npm run lint → clean
```

---

## 4. Skill whitelist

- `drizzle-orm` — DB query patterns for dedup (lead_candidates, deals, companies), warmup count (outreach_sends), lead_runs insert

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/warmup.ts` — new — enforceWarmupCap
- `lib/lead-gen/scoring-stub.ts` — new — temporary scoring stub
- `lib/lead-gen/orchestrator.ts` — new — runDailySearch (steps 1–7)
- `lib/lead-gen/index.ts` — edit — add warmup + orchestrator exports
- `tests/lead-gen/lg4-orchestrator.test.ts` — new

---

## 6. Settings keys touched

- **Reads:**
  - `warmup.week_one_cap`, `warmup.week_two_cap`, `warmup.week_three_cap`, `warmup.week_four_cap`, `warmup.graduated_cap`
  - `lead_generation.daily_max_per_day`
  - `lead_generation.dedup_window_days`
  - `lead_generation.location_centre`
  - `lead_generation.location_radius_km`
  - `lead_generation.category`
  - `lead_generation.max_candidates_per_run`
- **Seeds (new keys):** none — all keys seeded by LG-1 migration 0043

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/sources/index.ts` exists — verify: `ls lib/lead-gen/sources/index.ts`
- [ ] `lib/lead-gen/enrichment/index.ts` exists — verify: `ls lib/lead-gen/enrichment/index.ts`
- [ ] `mergeProfiles` exported — verify: `grep "export function mergeProfiles" lib/lead-gen/enrichment/index.ts`
- [ ] `isBlockedFromOutreach` exported — verify: `grep "export.*isBlockedFromOutreach" lib/lead-gen/dnc.ts`
- [ ] `resend_warmup_state` table defined — verify: `grep "resend_warmup_state" lib/db/schema/resend-warmup-state.ts`
- [ ] `outreach_sends` table defined — verify: `grep "outreach_sends" lib/db/schema/outreach-sends.ts`
- [ ] `lead_candidates` table defined — verify: `grep "lead_candidates" lib/db/schema/lead-candidates.ts`
- [ ] `lead_runs` table defined — verify: `grep "lead_runs" lib/db/schema/lead-runs.ts`
- [ ] `companies` table defined — verify: `grep "companies" lib/db/schema/companies.ts`
- [ ] `deals` table defined — verify: `grep "deals" lib/db/schema/deals.ts`
- [ ] `lead_generation.daily_max_per_day` in settings registry — verify: `grep "daily_max_per_day" lib/settings.ts`
- [ ] `warmup.week_one_cap` in settings registry — verify: `grep "week_one_cap" lib/settings.ts`
- [ ] `npx tsc --noEmit` passes before starting (carry-forward from LG-3)

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — pure helper files, no DB migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `lib/lead-gen/warmup.ts` exists — verify: `ls lib/lead-gen/warmup.ts`
- [ ] `lib/lead-gen/scoring-stub.ts` exists — verify: `ls lib/lead-gen/scoring-stub.ts`
- [ ] `lib/lead-gen/orchestrator.ts` exists — verify: `ls lib/lead-gen/orchestrator.ts`
- [ ] `enforceWarmupCap` exported — verify: `grep "export.*enforceWarmupCap" lib/lead-gen/warmup.ts`
- [ ] `runDailySearch` exported — verify: `grep "export.*runDailySearch" lib/lead-gen/orchestrator.ts`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: PASS
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-5)

LG-5 builds the scoring engine that replaces the LG-4 stub:
- `scoreForSaasTrack(profile: ViabilityProfile): number` (0–100)
- `scoreForRetainerTrack(profile: ViabilityProfile): number` (0–100)
- `scoreCandidate(profile: ViabilityProfile): ScoreResult` (replaces scoring-stub.ts)
- Rules come from `docs/specs/lead-generation.md` §6 (scoring rules + qualification floors)
- After LG-5 lands, delete `lib/lead-gen/scoring-stub.ts` and update orchestrator to import from the real scorer

LG-5 also depends on LG-4 (orchestrator imports ScoredCandidate type). Patch the import in orchestrator.ts if it references scoring-stub.ts.

**Dedup note for LG-4 brief-writer:** The `companies` table join may be complex (matching by domain). Simplest dedup approach: check `lead_candidates.domain` directly, then check `deals` JOIN `companies` on domain. The `isBlockedFromOutreach()` call handles DNC per its §12.A mandate.
