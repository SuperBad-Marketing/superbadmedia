# BDA-2 Handoff — Brand DNA card UI + alignment gate + save/resume

**Session:** BDA-2 | **Date:** 2026-04-13 | **Model:** Sonnet 4.6 (prescribed tier)
**Wave:** 3 — Brand DNA Assessment
**Type:** FEATURE
**Rollback:** feature-flag-gated (`brand_dna_assessment_enabled` kill-switch, default false). Route tree disabled at layout level. No new migration — question bank is static content.

---

## What was built

All BDA-2 acceptance criteria met.

### New files

| File | Purpose |
|---|---|
| `app/lite/brand-dna/layout.tsx` | Kill-switch gate + dark immersive shell (`background: var(--color-neutral-950)`) |
| `app/lite/brand-dna/page.tsx` | Server Component: checks auth + existing profile for resume; renders `AlignmentGateClient` |
| `app/lite/brand-dna/actions.ts` | Server Actions: `submitAlignmentGate`, `submitAnswer`, `submitReflection`, `getSelfProfileId` |
| `app/lite/brand-dna/alignment-gate-client.tsx` | "Does your business represent your personality?" — 3 track cards (houseSpring + AnimatePresence) |
| `app/lite/brand-dna/section/[n]/page.tsx` | Card-per-question page: validates section 1–5, resolves profileId, finds next unanswered question |
| `app/lite/brand-dna/section/[n]/question-card-client.tsx` | Progress bar, staggered option cards, submits FormData via `submitAnswer` |
| `app/lite/brand-dna/section/[n]/insight/page.tsx` | React Suspense: `InsightShimmer` fallback → `InsightContent` (calls `generateSectionInsight`) |
| `app/lite/brand-dna/section/[n]/insight/insight-reveal-client.tsx` | Animated blockquote reveal (houseSpring) + next-section card / stub complete card |
| `app/lite/brand-dna/section/[n]/reflection/page.tsx` | Section 5 only; redirects non-5 sections to insight; renders `ReflectionClient` |
| `app/lite/brand-dna/section/[n]/reflection/reflection-client.tsx` | Free-form textarea + Skip button; both paths call `submitReflection` |
| `lib/brand-dna/question-bank.ts` | 15 stub questions (3/section × 5 sections); each option has 1–3 signal tag strings |
| `lib/brand-dna/generate-insight.ts` | `generateSectionInsight(profileId, section, dbOverride?)` — Opus caller, cached in `section_insights` |
| `tests/brand-dna-card.test.ts` | 20 tests: QUESTION_BANK structure (5) + generateSectionInsight (4) + submitAlignmentGate (4) + submitAnswer (5) + submitReflection (2) |
| `sessions/bda-3-brief.md` | Wave 3 BDA-3 brief (G11.b rolling cadence) |

### Edited files

| File | Change |
|---|---|
| `lib/brand-dna/index.ts` | Added BDA-2 barrel exports: QUESTION_BANK, SECTION_TITLES, SECTION_SUBTITLES, getQuestionsForSection, getQuestionById, Question, QuestionOption, generateSectionInsight |
| `lib/kill-switches.ts` | Added `brand_dna_assessment_enabled` to KillSwitchKey union + defaults registry (false) |
| `proxy.ts` | Added `/lite/brand-dna` to `isPublicRoute()` — prevents infinite redirect loop (brand-dna gate target IS the assessment) |
| `eslint.config.mjs` | Added `lib/brand-dna/generate-insight.ts` to no-direct-anthropic-import ignores (LLM caller boundary, same as lib/ai/) |

---

## Key decisions

- **`actions.ts` is a "use server" file — only async functions exported.** `QUESTIONS_PER_SECTION` and `QUESTION_BANK` were initially exported from `actions.ts` but Turbopack rejects non-async exports from "use server" files. Removed both; pages import direct from `@/lib/brand-dna/question-bank`.

- **Insight caching in `section_insights` JSON array.** `generateSectionInsight` reads `brand_dna_profiles.section_insights` before calling Opus. If `section_insights[section-1]` is already set, returns cached text. This prevents regeneration on page revisit. Cache miss = Opus call + store result.

- **Answer idempotency.** `submitAnswer` checks for existing `brand_dna_answers` row by `(profile_id, question_id)` before inserting. If already answered, skips insert + tag update but still updates `current_section` and redirects correctly.

- **Signal tag aggregation.** Each answer submit calls `updateSignalTags(profileId, tagsAwarded)` which reads `brand_dna_profiles.signal_tags` JSON map, increments tag frequency counts, writes back. Tags are passed from the client as a JSON array in the FormData — they're taken from the selected option's `tags` array in the question bank.

- **Resume logic.** Entry page (`page.tsx`) checks for existing `superbad_self` profile. If `profile.track` is set and `profile.status !== 'complete'`, redirects to `section/{profile.current_section}`. This handles page refresh + return visits.

- **Section 5 completion path.** `submitAnswer` for section 5's last question redirects to the reflection page. `submitReflection` saves non-empty text then redirects to `/lite/brand-dna/section/5/insight` (the stub complete page). BDA-3 replaces this destination with the portrait reveal.

- **`llm_calls_enabled` gates insight generation.** When kill-switch is off, `generateSectionInsight` returns a stub string without calling Anthropic. Consistent with all other LLM callers in the project.

- **`BRAND_DNA_GATE_BYPASS=true` required.** Gate middleware (`proxy.ts`) redirects `/lite/*` admin routes to `/lite/onboarding` if `brand_dna_complete` is false on the session. BDA-2 builds the assessment but does NOT complete the profile. Gate clears only when BDA-3 marks `status='complete'` on Andy's superbad_self profile.

---

## Build fix — offline environment

The sandbox cannot reach Google Fonts APIs (403). `npm run build` requires `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/home/user/superbad-lite/.font-mock.json` to bypass the Turbopack font loading. The `.font-mock.json` file contains `src`-less `@font-face` CSS stubs for all 9 fonts in `lib/fonts.ts`. This is a **pre-existing environment constraint** — the font configuration predates BDA-2; all prior sessions documented the same 403 limitation.

Also required: musl libc for the SWC binary:
```
apt-get install -y musl
ln -s /lib/x86_64-linux-musl/libc.so /lib/libc.musl-x86_64.so.1
ldconfig
```

---

## Verification gates

- **G1 preflight:** All preconditions verified before build started ✓
- **G2 scope:** All files within whitelist. Two out-of-whitelist edits documented with rationale: `proxy.ts` (prevent infinite redirect), `eslint.config.mjs` (LLM caller carve-out). ✓
- **G4 settings-literal grep:** No autonomy-sensitive literals in production code ✓
- **G5 motion:** houseSpring used throughout; AnimatePresence on alignment gate cards; stagger on question option cards; fade-in on insight reveal blockquote. Consistent with A4 patterns. ✓
- **G6 rollback:** feature-flag-gated; no new migration ✓
- **G7 artefacts:** All 14 new files + 4 edited files present ✓
- **G8 typecheck + tests:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 226/226 green (206 pre-BDA-2 + 20 new). `npm run lint` → clean ✓. `npm run build` → clean (with font mock) ✓
- **G9 E2E:** Not a critical flow ✓
- **G10 browser:** `curl http://localhost:3001/lite/brand-dna | grep -i personality` → returns full SSR HTML containing "Does your business represent your personality?" ✓

---

## Migration state after BDA-2

No new migration. State unchanged from BDA-1:
```
0000_init.sql                    — Drizzle journal idx 0
0001_seed_settings.sql           — Drizzle-untracked seed
0002_a6_activity_scheduled_inbox — Drizzle journal idx 2
0003_a7_email_stripe_pdf         — Drizzle journal idx 3
0004_a8_portal_auth              — Drizzle journal idx 4
0005_b1_support                  — Drizzle journal idx 5
0006_b3_legal                    — Drizzle journal idx 6
0007_bda1_brand_dna              — Drizzle journal idx 7
```

BDA-3's migration (if any) must be `0008_bda3_*.sql`. BDA-3 is unlikely to need a migration unless it adds new columns to `brand_dna_profiles` (possible for `shape` or additional portrait fields).

---

## PATCHES_OWED rows (BDA-2 — new)

1. `bda2_question_bank_stub` — 15 stub questions ship with BDA-2. Final question bank (75 questions per section × 5 sections) is a content mini-session. BDA-2 question IDs (`s1_001`–`s5_003`) will be replaced; answer rows referencing old IDs become orphaned. Schedule content session before BDA-5.
2. `bda2_font_mock_env` — `.font-mock.json` in repo root is a dev-only build workaround for the offline sandbox. Remove (or move to `.gitignore`) once the project moves to a networked build environment. Does not affect production Coolify deployment.
3. `bda2_section5_insight_stub` — Section 5 insight page (`/lite/brand-dna/section/5/insight`) shows a generic "complete" stub card. BDA-3 replaces this with the Opus portrait reveal. If BDA-3 is delayed, the stub is visible.

---

## Open threads for BDA-3 (next session)

- **Portrait reveal route.** `submitReflection` currently redirects to `/lite/brand-dna/section/5/insight?profileId=...`. BDA-3 should create `/lite/brand-dna/reveal?profileId=...` as the cinematic destination and update `submitReflection` redirect target.
- **`generateSectionInsight` API surface.** Callable at `lib/brand-dna/generate-insight.ts`. BDA-3 will create a companion `generatePortrait(profileId, db?)` function for the full Opus portrait pass.
- **`brand_dna_profiles.signal_tags`** — being written correctly by BDA-2 (JSON map of tag → frequency count). BDA-3 reads this to inform the portrait generation prompt.
- **`brand_dna_profiles.section_insights`** — JSON string array, one entry per section (0-indexed). Written by `generateSectionInsight`; BDA-3 may pass these to the portrait prompt for continuity.
- **`brand_dna_profiles.reflection_text`** — written by `submitReflection` if user provides text. BDA-3 includes it in the portrait prompt.
- **`sound:brand_dna_reveal`** — new sound key BDA-3 registers in `lib/sounds.ts`. A4's sound registry currently has 7 keys; this will be the 8th.
- **Tier 2 motion slot 1.** BDA-3 owns the first Tier 2 choreography slot (`brand-dna-reveal` entry in `lib/motion/choreographies.ts`). The choreography spec lives in `docs/specs/brand-dna-assessment.md` §10.7.
- **`status = 'complete'`** — BDA-3 must set `brand_dna_profiles.status = 'complete'` + `completed_at_ms` on Andy's superbad_self profile after the reveal. This is what triggers `brand_dna_complete = true` in the NextAuth session (via `jwt` callback). The gate clears on next admin route visit.
- **`BRAND_DNA_GATE_BYPASS=true`** still required throughout BDA-3.
- **BDA-3 is a `/deep` (Opus) session** — large context, 5 Opus prompts in `lib/ai/prompts/brand-dna-assessment/`. Plan for it.

---

## Autonomy loop note

`RemoteTrigger` tool was not available in this environment. The hourly safety-net cron will fire the next session (Wave 3 BDA-3). Known environment limitation — no action required.
