# `LG-5` — Lead Gen scoring engine — Session Brief

> **Pre-compiled by LG-4 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-5`
- **Wave:** `13 — Lead Generation` (5 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~12k tokens (brief + excerpts + last 2 handoffs). Well under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Qualification floors §6.2

Source: `docs/specs/lead-generation.md` §6.2

```
Qualification floors:
  SaaS    floor: 40 / 100  (below = discard)
  Retainer floor: 55 / 100  (below = discard)

Floors live as constants in scoring.ts. Changes ship as deploys, not config.
```

### Excerpt 2 — Scoring function signatures §6.1

Source: `docs/specs/lead-generation.md` §6.1

```typescript
// lib/lead-gen/scoring.ts
export function scoreForSaasTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean }

export function scoreForRetainerTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean }

Both functions are pure: (ViabilityProfile, softAdjustment) → { score, breakdown, qualifies }.
No I/O, no side effects, fully unit-testable.
```

### Excerpt 3 — Winner-takes-all track assignment §6.3

Source: `docs/specs/lead-generation.md` §6.3

```typescript
function assignTrack(profile): { track: 'saas' | 'retainer' | null; score: number } {
  const saas = scoreForSaasTrack(profile)
  const retainer = scoreForRetainerTrack(profile)

  if (!saas.qualifies && !retainer.qualifies) return { track: null, score: 0 }
  if (saas.qualifies && !retainer.qualifies) return { track: 'saas', score: saas.score }
  if (retainer.qualifies && !saas.qualifies) return { track: 'retainer', score: retainer.score }
  return saas.score >= retainer.score
    ? { track: 'saas', score: saas.score }
    : { track: 'retainer', score: retainer.score }
}
```

### Excerpt 4 — Build-time disciplines §6.4

Source: `docs/specs/lead-generation.md` §6.4

```
§12.B — scoring.ts is the only place rules live. No inline scoring logic anywhere else.
         Unit tests cover every rule path.
§12.C — Rule changes are deploys, not config. No scoring rules UI in v1.
§12.D — scoring_debug_json is populated on every candidate for future tuning.
```

### Excerpt 5 — Signal rationale for weight design

Source: `docs/specs/lead-generation.md` §3.2

```
Signal → Source → What it signals

Meta Ad Library active ads + estimated spend → advertising maturity
Google Maps business profile + rating → local presence + establishment
Google Ads Transparency campaigns → ad budget proxy
PageSpeed performance score (0–100) → web quality proxy
Website domain age (years) → business maturity
Instagram Business Discovery (follower/post count) → social presence
YouTube channel (subscriber/video count) → content marketing maturity
Website scrape (has_about, has_pricing, team_size) → operational maturity
Maps photos count + recency → engagement proxy

Two tracks:
  SaaS:     lean team, DIY-leaning, lower revenue → prefers: small team, basic web presence, no heavy ad spend
  Retainer: higher revenue, multi-stakeholder → prefers: ad spend, social presence, established business
```

### Excerpt 6 — Orchestrator stub locations

Source: `lib/lead-gen/orchestrator.ts` (LG-4 output, grep-verifiable)

```
// Two stubs to replace:
function scoreForSaasTrack(_profile: Partial<ViabilityProfile>): ScoreResult {
  // TODO: LG-5 replaces this stub
  return { score: 0, breakdown: {}, qualifies: false };
}
function scoreForRetainerTrack(_profile: Partial<ViabilityProfile>): ScoreResult {
  // TODO: LG-5 replaces this stub
  return { score: 0, breakdown: {}, qualifies: false };
}
```

---

## 2a. Visual references

None — `FEATURE` type, no UI surface.

---

## 3. Acceptance criteria

```
LG-5 is done when:

1. lib/lead-gen/scoring.ts exports:
   - ScoringBreakdown type alias: Record<string, number>
   - SAAS_QUALIFICATION_FLOOR = 40 (constant, not settings.get)
   - RETAINER_QUALIFICATION_FLOOR = 55 (constant, not settings.get)
   - scoreForSaasTrack(profile: Partial<ViabilityProfile>, softAdjustment?: number):
       { score: number; breakdown: ScoringBreakdown; qualifies: boolean }
   - scoreForRetainerTrack(profile: Partial<ViabilityProfile>, softAdjustment?: number):
       { score: number; breakdown: ScoringBreakdown; qualifies: boolean }
   - assignTrack(profile: Partial<ViabilityProfile>):
       { track: 'saas' | 'retainer' | null; score: number }
   All three functions are pure (no I/O, no imports from @/lib/db).

2. Scoring rubric (signal weights are implementation decisions — these are the constraints):
   - Scores are normalised to 0–100.
   - softAdjustment is clamped then added: final = clamp(raw + softAdjustment, 0, 100).
   - SaaS scorer prefers: lean team (small/solo team_size_signal), basic web presence,
     lower/no ad spend, has_about_page, positive pagespeed.
   - Retainer scorer prefers: ad spend (meta + google), social presence (instagram followers,
     youtube subscribers), established business (domain_age, maps review_count + rating),
     professional web presence (pagespeed, has_pricing_page, team_size medium/large).
   - Missing signals degrade gracefully (score contribution = 0 for absent signal).
   - breakdown keys match the signal names used so scoring_debug_json is readable.

3. lib/lead-gen/orchestrator.ts patched:
   - Import scoreForSaasTrack and scoreForRetainerTrack from './scoring'
   - Remove the two local stub functions
   - Step 6 now uses real scoring: candidates below both floors are discarded
   - The ScoreResult interface in orchestrator.ts is replaced/moved; orchestrator uses
     the return type from scoring.ts directly

4. lib/lead-gen/index.ts updated to re-export:
   - scoreForSaasTrack, scoreForRetainerTrack, assignTrack from './scoring'
   - SAAS_QUALIFICATION_FLOOR, RETAINER_QUALIFICATION_FLOOR from './scoring'

5. tests/lead-gen/lg5-scoring.test.ts passes:
   - scoreForSaasTrack: solo/small team candidate scores ≥ floor (40)
   - scoreForSaasTrack: missing profile (empty object) scores 0 and does not qualify
   - scoreForSaasTrack: softAdjustment applied correctly (score + adjustment, clamped 0–100)
   - scoreForRetainerTrack: high-ad-spend + high-follower candidate scores ≥ floor (55)
   - scoreForRetainerTrack: missing profile scores 0 and does not qualify
   - assignTrack: both qualify → higher score wins
   - assignTrack: only SaaS qualifies → SaaS assigned
   - assignTrack: only retainer qualifies → retainer assigned
   - assignTrack: neither qualifies → track: null, score: 0
   - breakdown keys are non-empty on a scored candidate

6. npx tsc --noEmit → 0 errors
7. npm test → green
8. npm run build → clean
9. npm run lint → clean
```

---

## 4. Skill whitelist

None required — pure functions, no DB, no external calls.

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/scoring.ts` — new — scoring functions + constants
- `lib/lead-gen/orchestrator.ts` — edit — swap stubs for real imports
- `lib/lead-gen/index.ts` — edit — add scoring exports
- `tests/lead-gen/lg5-scoring.test.ts` — new

---

## 6. Settings keys touched

- **Reads:** none — qualification floors are constants per spec §6.4 ("changes ship as deploys, not config")
- **Seeds (new keys):** none

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/scoring.ts` does NOT exist yet (new file) — verify: `ls lib/lead-gen/scoring.ts 2>&1 | grep "No such"`
- [ ] `lib/lead-gen/orchestrator.ts` exists with stub functions — verify: `grep "TODO: LG-5" lib/lead-gen/orchestrator.ts`
- [ ] `lib/lead-gen/types.ts` exports `ViabilityProfile` — verify: `grep "export interface ViabilityProfile" lib/lead-gen/types.ts`
- [ ] `npx tsc --noEmit` passes before starting (carry-forward from LG-4)

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — pure helper files, no migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `lib/lead-gen/scoring.ts` exists with all exports from AC §1
- [ ] `lib/lead-gen/orchestrator.ts` uses real scoring (stubs removed)
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: PASS
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-6)

LG-6 builds the real `enforceWarmupCap()` warmup ramp:
- Replaces the stub in `lib/lead-gen/warmup.ts`
- 4-week non-overrideable ramp: days 1–7 → 5/day, days 8–14 → 10/day, days 15–21 → 15/day, days 22–28 → 20/day, day 29+ → 30/day
- Reads `resend_warmup_state` table for current day count and cumulative sends
- `enforceWarmupCap()` must be read-only (no mutations) — the orchestrator calls it at step 1
- Key spec reference: `docs/specs/lead-generation.md` §10.1 (ramp) + §10.2 (contract)
