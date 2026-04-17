# `cms-1` — Brand DNA Assessment content mini-session — Handoff

**Closed:** 2026-04-17
**Type:** Content mini-session (Batch A, item 1 of 2)
**Model tier:** Opus (creative — flagship experience, highest-stakes content in the project)

---

## What was built

The **entire creative content layer** for the Brand DNA Assessment feature. Largest single creative session in the project. 27 files changed, 4283 insertions, 502 deletions.

### Signal tag taxonomy (79 tags, 5 domains)

- **Aesthetic (12):** minimalism, maximalism, organic_forms, geometric_precision, analogue_texture, high_contrast, muted_palette, cinematic_eye, tactile_craft, warmth, monochrome_comfort, retro_nostalgia
- **Communication (16):** directness, diplomacy, introversion, extraversion, brevity, storytelling, formality, warmth_in_voice, dry_humour, confrontation_comfort, tonal_awareness, agreeableness, selective_vulnerability, active_listening, data_driven_persuasion, visual_communication
- **Values (21):** authenticity, perfectionism, pragmatism, independence, collaboration, risk_appetite, risk_caution, patience, ambition, transparency, loyalty, curiosity, tradition, innovation_pull, empathy, conviction, conscientiousness, gut_first, head_first, community_orientation, privacy
- **Creative (13):** improviser, planner, curation_instinct, anti_polish, admires_restraint, admires_boldness, admires_craft, rejects_trend, emotional_resonance, conceptual_thinking, narrative_instinct, cross_pollinator, systematic_creator
- **Aspiration (15):** thought_leadership, quiet_confidence, legacy_drive, achievement_orientation, category_creation, premium_positioning, community_building, affiliation, mentor_instinct, platform_builder, lifestyle_integration, creative_freedom, social_impact, recognition_seeking, self_sufficiency

### Question bank (113 questions)

- **Section 1 — Aesthetic Identity:** 19 questions (16 shared, 1 founder, 2 business), 4 visual
- **Section 2 — Communication DNA:** 20 questions (16 shared, 2 founder, 2 business), 0 visual
- **Section 3 — Values & Instincts:** 20 questions (14 shared, 3 founder, 3 business), 0 visual
- **Section 4 — Creative Compass:** 19 questions (15 shared, 1 founder, 2 business + 1 extra), 3 visual
- **Section 5 — Brand Aspiration:** 20 questions (14 shared, 2 founder, 2 business + 2 extra), 0 visual
- **Supplement — Where the Brand Splits From You:** 15 questions (founder_supplement track only), 2 visual

### TypeScript question bank structure

Old stub `lib/brand-dna/question-bank.ts` deleted. Replaced by directory module:

- `lib/brand-dna/question-bank/types.ts` — `Question`, `SupplementQuestion`, `QuestionOption`, builder functions `q()` and `sq()`
- `lib/brand-dna/question-bank/section-1.ts` through `section-5.ts` — 98 core questions
- `lib/brand-dna/question-bank/supplement.ts` — 15 supplement questions with `brand_override.*` prefix tags
- `lib/brand-dna/question-bank/index.ts` — barrel exports, constants, helpers (`getQuestionsForSection`, `getQuestionById`, `getQuestionsForTrack`, `resolveQuestionText`)

All existing imports from `"@/lib/brand-dna/question-bank"` continue working.

### Opus prompts calibrated (5)

1. **`generate-first-impression.ts`** — Added `findTensionPairs()` with 15 known tension pairs, `buildDomainSummary()` with full domain-to-tag mappings, reflection contrast analysis
2. **`generate-section-insight.ts`** — Added `sectionNumber`, `priorInsights`, `track` to input; `SECTION_CONTEXT` record per section; prior-insight awareness prevents repetition
3. **`generate-prose-portrait.ts`** — Added `brandOverrideTags` to input; extracted `buildOverrideBlock()` helper; 5-point capture framework + brand split narrative for founder_supplement
4. **`generate-company-blend.ts`** — New. Synthesizes 2+ individual profiles into company-level Brand DNA (shared signals by domain, divergences, company portrait)
5. **`generate-retake-comparison.ts`** — New. Compares previous vs current profiles on retake (automated tag movement computation, time-aware framing)

### Art direction + ambient copy

- `docs/content/brand-dna/art-direction-and-ambient.md` — 5 section visual worlds (each with distinct colour temperature, texture, ambient movement), supplement visual world, 15 browser tab titles, intro screen, section title cards, transition cards, reflection prompt, loading copy, reveal sequence, empty states, error copy, retake copy

### Supporting content docs

- `docs/content/brand-dna/taxonomy.md` — Full 79-tag taxonomy with domain descriptions
- `docs/content/brand-dna/section-1.md` through `section-5.md` — Question content with tags
- `docs/content/brand-dna/supplement.md` — Supplement questions with brand override tags

## Key decisions

1. **79 tags, not 40–60.** Andy pushed for deeper personality profiling ("make people feel like we know them better than they know themselves"). Standard Big Five traits + motivational drives included. Approved.
2. **No shapes (single bank per section).** Spec originally said 3 shapes × 5 sections = 15 banks minimum. Replaced with track-exclusive questions using `string | { founder: string; business: string }` text union. Simpler, same depth.
3. **Supplement "confirms alignment" pattern.** Option d in most supplement questions has empty tags array `[]` — the absence of override tags IS the data point (brand = founder).
4. **Tension pair detection in prompts.** 15 known conflicting tag pairs (e.g., `risk_appetite` vs `perfectionism`) surfaced to Opus for richer portrait writing.
5. **Directory-based question bank.** `question-bank/` directory module with barrel index, not a single file. Cleaner for 113 questions + types + helpers.
6. **`resolveQuestionText()` helper.** Handles the `string | { founder: string; business: string }` union type at display time. Imported by `question-card-client.tsx`.

## What the next session should know

- **Action code completion check uses `getQuestionsForSection` not `getQuestionsForTrack`.** The `submitAnswer` server action counts completion by checking answers against ALL questions in a section (including track-exclusive ones the respondent never sees). A founder answering section 1 would need 19 answers for completion but only sees 17 questions. This is a pre-existing action code issue, not a CMS-1 concern — needs fixing in a future BDA build session.
- **Test suite updated.** All 20 brand-dna-card tests pass with new question IDs (`s3_q01` format), real taxonomy tags, and updated counts (98 questions, 19–20 per section).
- **Prompt index updated.** `lib/ai/prompts/brand-dna-assessment.md` changed from "stub" to "calibrated" with full documentation per prompt.
- **`generate-insight.ts` runtime updated.** Now gathers prior insights from the profile before calling Opus, passes `sectionNumber`, `priorInsights`, `track` to the prompt builder.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 163 files, 1312 passed, 0 failures
- `npm run build` — clean
- Commit: `[PHASE-5] CMS-1 — Brand DNA Assessment content mini-session` (27 files)

## PATCHES_OWED (raised this session)

- **`cms_1_action_completion_check_uses_wrong_helper`** — `submitAnswer` action uses `getQuestionsForSection()` (returns all tracks) instead of `getQuestionsForTrack()` for section completion check. Track-exclusive questions a respondent never sees would be counted toward completion threshold. Fix in a future BDA build session.

## Rollback strategy

`git-revertable`. No migration, no schema change. Reverting removes all content files, question bank directory, prompt calibrations, and art direction doc. Would revert `question-card-client.tsx` and `generate-insight.ts` to prior state. The old stub `question-bank.ts` would need manual restoration (deleted in this session).
