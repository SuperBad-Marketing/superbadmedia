# BDA-2 — Brand DNA card UI + alignment gate + save/resume — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** BDA-2
- **Wave:** 3 — Brand DNA Assessment
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `docs/specs/brand-dna-assessment.md` §§3.2–3.3, §§4.1–4.4, §§10.1–10.4, §10.7 — alignment gate, card UI, section structure, visual environments, save/resume — primary
- `BUILD_PLAN.md` Wave 3 §BDA-2 — session inventory
- `docs/specs/brand-dna-assessment.md` §8.1–8.2 — column shapes consumed by this session (profiles + answers)

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md BDA-2)

```
BDA-2 — Brand DNA card UI + alignment gate + save/resume
- Builds: `/lite/brand-dna` route tree (app/lite/brand-dna/)
  - `/lite/brand-dna` — entry: alignment gate question ("Does your business
    represent your personality?"); 3 options → sets brand_dna_profiles.track;
    creates profile row if not exists; redirects to section 1
  - `/lite/brand-dna/section/[n]` — card-per-question UI (1 question per
    screen, 4 options); answer saves immediately to brand_dna_answers;
    updates brand_dna_profiles.current_section + status = 'in_progress'
  - `/lite/brand-dna/section/[n]/insight` — between-section loading shimmer
    (2–4 seconds) + Opus insight call (generate-section-insight prompt slug);
    transition card renders insight text with houseSpring animation;
    section title card for next section; visual environment shifts
  - `/lite/brand-dna/section/[n]/reflection` — (section 5 only) optional
    free-form text area; prominent Skip affordance; saves to
    brand_dna_profiles.reflection_text if submitted
  - Resume logic: if brand_dna_profiles.current_section > 1, skip alignment
    gate + completed sections; resume at the first unanswered question
  - Question bank stub: static question bank with 3 placeholder questions per
    section (final bank ships in content mini-session); each option maps to
    1–3 tag strings; BDA-2 hardcodes 15 stub questions × 5 sections = 75 stubs
- Owns: `/lite/brand-dna/` route tree; question-bank stub at
  `lib/brand-dna/question-bank.ts`; `generateSectionInsight()` Opus caller at
  `lib/brand-dna/generate-insight.ts`
- Consumes: BDA-1 (brand_dna_profiles, brand_dna_answers, brand_dna_invites,
  issueBrandDnaInvite, redeemBrandDnaInvite), A3/A4 (houseSpring, UI components),
  A6 (logActivity), lib/ai/models.ts (modelFor slug)
- Rollback: feature-flag-gated — `brand_dna_assessment_enabled` kill-switch
  (new in this session)
- BRAND_DNA_GATE_BYPASS=true required throughout (gate clears at BDA-3)
```

## 4. Skill whitelist

- `framer-motion` — for houseSpring card transitions, between-section animations, `AnimatePresence`
- `drizzle-orm` — for answer inserts + profile updates (save/resume pattern)
- `superbad-brand-voice` — for alignment gate copy, loading states, section title copy

## 5. File whitelist (G2 scope discipline)

- `app/lite/brand-dna/page.tsx` — alignment gate entry screen (`new`)
- `app/lite/brand-dna/layout.tsx` — brand-dna layout shell (`new`)
- `app/lite/brand-dna/section/[n]/page.tsx` — card-per-question page (`new`)
- `app/lite/brand-dna/section/[n]/insight/page.tsx` — between-section insight page (`new`)
- `app/lite/brand-dna/section/[n]/reflection/page.tsx` — reflection page (section 5 only) (`new`)
- `app/lite/brand-dna/actions.ts` — Server Actions: `submitAlignmentGate`, `submitAnswer`, `submitReflection` (`new`)
- `lib/brand-dna/question-bank.ts` — static stub question bank (75 questions across 5 sections × 3 tracks) (`new`)
- `lib/brand-dna/generate-insight.ts` — `generateSectionInsight(profileId, section, db?)` Opus caller; uses `modelFor('brand-dna-generate-section-insight')` (`new`)
- `lib/brand-dna/index.ts` — add barrel exports for new functions (`edit`)
- `lib/kill-switches.ts` — add `brand_dna_assessment_enabled` flag (`edit`)
- `proxy.ts` — add `/lite/brand-dna` to `isPublicRoute()` exceptions (portal auth applies; check existing patterns) (`edit`)
- `tests/brand-dna-card.test.ts` — unit tests for Server Actions + generateSectionInsight (`new`)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none (BDA-2 uses `llm_calls_enabled` kill-switch for insight generation — existing)
- **Seeds:** none

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] BDA-1 closed cleanly — verify: `ls sessions/bda-1-handoff.md`
- [ ] `brand_dna_profiles` extended (has `track`, `current_section`, `signal_tags`) — verify: `grep "track\|current_section\|signal_tags" lib/db/schema/brand-dna-profiles.ts`
- [ ] `brand_dna_answers` table exists — verify: `grep "brand_dna_answers" lib/db/schema/brand-dna-answers.ts`
- [ ] `issueBrandDnaInvite` exported — verify: `grep "export.*issueBrandDnaInvite" lib/brand-dna/issue-invite.ts`
- [ ] `redeemBrandDnaInvite` exported — verify: `grep "export.*redeemBrandDnaInvite" lib/brand-dna/redeem-invite.ts`
- [ ] Migration journal idx 7 exists — verify: `grep '"idx": 7' lib/db/migrations/meta/_journal.json`
- [ ] `modelFor` exported from `lib/ai/models.ts` — verify: `grep "export.*modelFor" lib/ai/models.ts`
- [ ] `houseSpring` available (A4) — verify: `grep "houseSpring" lib/motion/choreographies.ts || grep "houseSpring" components/lite/motion-provider.tsx`
- [ ] `llm_calls_enabled` in kill-switches — verify: `grep "llm_calls_enabled" lib/kill-switches.ts`
- [ ] `BRAND_DNA_GATE_BYPASS` in `.env.example` — verify: `grep "BRAND_DNA_GATE_BYPASS" .env.example`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — new `brand_dna_assessment_enabled` kill-switch in `lib/kill-switches.ts`. Rollback = set flag to false (routes return early or redirect to `/lite/onboarding`). No data shape change beyond answer rows which are left orphaned (harmless). No migration in BDA-2 — question bank is static content, no new tables.

## 9. Definition of done

- [ ] `/lite/brand-dna` route exists and serves the alignment gate — verify: dev server on :3001, `curl -s http://localhost:3001/lite/brand-dna | grep -i "personality"` returns match
- [ ] `lib/brand-dna/question-bank.ts` exports question bank — verify: `grep "export.*QUESTION_BANK\|export.*questionBank" lib/brand-dna/question-bank.ts`
- [ ] `lib/brand-dna/generate-insight.ts` exports `generateSectionInsight` — verify: `grep "export.*generateSectionInsight" lib/brand-dna/generate-insight.ts`
- [ ] `brand_dna_assessment_enabled` in `lib/kill-switches.ts` — verify: `grep "brand_dna_assessment_enabled" lib/kill-switches.ts`
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run lint` → clean.
- [ ] `npm run build` → clean (pre-existing Google Fonts 403 acceptable per A7/A8/B1/B2/B3/BDA-1 precedent).
- [ ] G-gates G0–G12 run end-to-end with a clean handoff written.

## 10. Notes for the next-session brief writer (BDA-3)

BDA-3 builds the Opus profile generation + cinematic reveal. It needs from BDA-2:
- `generateSectionInsight()` API surface (callable from BDA-3's reveal trigger)
- The `brand_dna_profiles.current_section` tracking confirmed working (BDA-3 reads it to know all sections are done)
- `brand_dna_profiles.section_scores` and `signal_tags` being written (BDA-2 aggregates tag frequency per section answer)
- `brand_dna_profiles.reflection_text` written (section 5 → reflection → BDA-3 reads for portrait generation)
- The stub question bank's tag structure (BDA-3 reads `tags_awarded` from answers to build the tag frequency map)
- **BDA-3 is a `/deep` (Opus) session** — complex choreography + Opus prompt integration + Tier 2 motion + sound trigger
- `sound:brand_dna_reveal` is the new sound key BDA-3 registers in `lib/sounds.ts`
- The reveal is the highest-design-investment moment in the product — BDA-3 should not rush it
- `BRAND_DNA_GATE_BYPASS=true` still required in BDA-3 — gate only clears when BDA-3 sets `status='complete'` on the SuperBad-self profile (the final step of BDA-3)
- BUILD_PLAN note: "Opus prose portrait + first-impression + company blend + reveal choreography (Tier 2 motion slot 1) + `sound:brand_dna_reveal`"
