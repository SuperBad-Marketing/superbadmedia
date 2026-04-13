# BDA-3 — Opus portrait + reveal choreography — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** BDA-3
- **Wave:** 3 — Brand DNA Assessment
- **Type:** FEATURE
- **Model tier:** `/deep` (Opus) — large context, multi-prompt orchestration, Tier 2 motion
- **Sonnet-safe:** no — Opus required for portrait generation + choreography complexity
- **Estimated context:** large

## 2. Spec references

- `docs/specs/brand-dna-assessment.md` §§6.1–6.4 — portrait fields (prose portrait, first impression, signal tags, between-section insight voice)
- `docs/specs/brand-dna-assessment.md` §§8.1–8.2 — profile schema columns consumed by this session
- `docs/specs/brand-dna-assessment.md` §9 — Claude prompts (generate-first-impression, generate-prose-portrait)
- `docs/specs/brand-dna-assessment.md` §§10.7 — reveal choreography (Tier 2 motion slot 1, `sound:brand_dna_reveal`)
- `docs/specs/brand-dna-assessment.md` step 8 + step 9 (profile generation loading, the reveal)
- `BUILD_PLAN.md` Wave 3 §BDA-3 — session inventory

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md BDA-3)

```
BDA-3 — Opus prose portrait + first-impression + company blend + reveal choreography
- Builds: `/lite/brand-dna/reveal` reveal route
  - Profile generation loading (5–8 second intentional pause)
  - `sound:brand_dna_reveal` fires as reveal begins
  - Cinematic profile build: first impression leads, then section-by-section
    tag + prose materialisation (total ~15–20 seconds)
  - After reveal: permanent profile page
- Opus callers:
  - `lib/brand-dna/generate-first-impression.ts` — 2–3 sentence sharpest insight
  - `lib/brand-dna/generate-prose-portrait.ts` — 500–800 word narrative portrait
- Tier 2 choreography: `brand-dna-reveal` entry in lib/motion/choreographies.ts
- `sound:brand_dna_reveal` registered in lib/sounds.ts (8th key)
- Sets brand_dna_profiles.status = 'complete' + completed_at_ms after portrait saved
- BRAND_DNA_GATE_BYPASS=true still required (BDA-4 wires the gate clear)
```

## 4. Skill whitelist

- `framer-motion` — Tier 2 reveal choreography, section-by-section materialisation, houseSpring
- `drizzle-orm` — portrait + first impression write-back, status = 'complete' update
- `howler` (via existing `SoundProvider`) — `sound:brand_dna_reveal` trigger

## 5. File whitelist (G2 scope discipline)

**New:**
- `app/lite/brand-dna/reveal/page.tsx` — reveal entry Server Component (fetches/generates portrait)
- `app/lite/brand-dna/reveal/reveal-client.tsx` — cinematic reveal animation (Tier 2 + sound)
- `lib/brand-dna/generate-first-impression.ts` — `generateFirstImpression(profileId, db?)` Opus caller
- `lib/brand-dna/generate-prose-portrait.ts` — `generateProsePortrait(profileId, db?)` Opus caller
- `lib/ai/prompts/brand-dna-assessment/generate-first-impression.ts` — Opus prompt
- `lib/ai/prompts/brand-dna-assessment/generate-prose-portrait.ts` — Opus prompt
- `tests/brand-dna-reveal.test.ts` — tests for generate-first-impression + generate-prose-portrait + reveal route

**Edited:**
- `app/lite/brand-dna/actions.ts` — update `submitReflection` redirect from section/5/insight → /lite/brand-dna/reveal; add `markProfileComplete()` server action
- `lib/brand-dna/index.ts` — add barrel exports for generateFirstImpression, generateProsePortrait
- `lib/motion/choreographies.ts` — add `brand-dna-reveal` Tier 2 choreography entry
- `lib/sounds.ts` — add `brand_dna_reveal` sound key (8th entry)
- `lib/ai/prompts/brand-dna-assessment/generate-section-insight.ts` — already exists (verify)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none new (uses existing `llm_calls_enabled` kill-switch)
- **Seeds:** none

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] BDA-2 closed cleanly — verify: `ls sessions/bda-2-handoff.md`
- [ ] `/lite/brand-dna/section/5/insight` route exists — verify: `ls app/lite/brand-dna/section/\[n\]/insight/page.tsx`
- [ ] `submitReflection` redirects to section/5/insight — verify: `grep "section/5/insight" app/lite/brand-dna/actions.ts`
- [ ] `brand_dna_profiles.prose_portrait` column exists — verify: `grep "prose_portrait" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_profiles.first_impression` column exists — verify: `grep "first_impression" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_profiles.signal_tags` column exists and being written — verify: `grep "signal_tags" app/lite/brand-dna/actions.ts`
- [ ] `brand_dna_profiles.reflection_text` column exists — verify: `grep "reflection_text" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_profiles.section_insights` column exists — verify: `grep "section_insights" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_profiles.completed_at_ms` column exists — verify: `grep "completed_at_ms" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand-dna-generate-first-impression` slug registered in models.ts — verify: `grep "brand-dna-generate-first-impression" lib/ai/models.ts`
- [ ] `brand-dna-generate-prose-portrait` slug registered in models.ts — verify: `grep "brand-dna-generate-prose-portrait" lib/ai/models.ts`
- [ ] `generateSectionInsight` pattern available as template — verify: `ls lib/brand-dna/generate-insight.ts`
- [ ] Tier 2 choreography registry pattern — verify: `ls lib/motion/choreographies.ts`
- [ ] `SoundKey` union in lib/sounds.ts — verify: `grep "SoundKey" lib/sounds.ts`
- [ ] `BRAND_DNA_GATE_BYPASS` in .env.example — verify: `grep "BRAND_DNA_GATE_BYPASS" .env.example`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — same `brand_dna_assessment_enabled` kill-switch. No new DB columns (all portrait fields exist from BDA-1 schema). Rollback = kill-switch false. The `sound:brand_dna_reveal` sound file may not exist yet (content session) — SoundProvider should handle missing audio gracefully (existing pattern: it silently no-ops on load error).

## 9. Definition of done

- [ ] `submitReflection` redirects to `/lite/brand-dna/reveal` — verify: `grep "brand-dna/reveal" app/lite/brand-dna/actions.ts`
- [ ] `lib/brand-dna/generate-first-impression.ts` exports `generateFirstImpression` — verify: `grep "export.*generateFirstImpression" lib/brand-dna/generate-first-impression.ts`
- [ ] `lib/brand-dna/generate-prose-portrait.ts` exports `generateProsePortrait` — verify: `grep "export.*generateProsePortrait" lib/brand-dna/generate-prose-portrait.ts`
- [ ] `brand-dna-reveal` in choreographies.ts — verify: `grep "brand-dna-reveal" lib/motion/choreographies.ts`
- [ ] `brand_dna_reveal` in sounds.ts — verify: `grep "brand_dna_reveal" lib/sounds.ts`
- [ ] `brand_dna_profiles.status = 'complete'` written — verify: test + code grep
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run lint` → clean.
- [ ] `npm run build` → clean (use `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=.font-mock.json` for sandbox — see bda-2-handoff.md).
- [ ] G-gates G0–G12 run end-to-end with a clean handoff written.

## 10. Notes for the next-session brief writer (BDA-4)

BDA-4 is a **small session** that wires the gate clear:
- When `brand_dna_profiles` for `superbad_self` has `status = 'complete'`, the NextAuth `jwt` callback must set `token.brand_dna_complete = true`
- The jwt callback lives in `lib/auth/auth.ts` — needs a DB query on sign-in and on `session.update()` call
- After BDA-4, `BRAND_DNA_GATE_BYPASS=true` is no longer needed for Andy to access admin routes
- BDA-4 should also test that the middleware correctly allows admin access after gate clear
- The critical-flight check (`hasCompletedCriticalFlight()`) in `proxy.ts` is a stub returning true — BDA-4 may defer wiring it to SW-4 per the original plan
- BDA-4 is the last session in Wave 3; after it, Wave 4 (Setup Wizards) begins
