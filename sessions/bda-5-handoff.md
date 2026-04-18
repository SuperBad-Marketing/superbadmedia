# BDA-5 Handoff — Client-facing Brand DNA portal paths + multi-stakeholder blends + retake comparison

**Session:** BDA-5 | **Date:** 2026-04-18 | **Model:** Sonnet 4.6 (prescribed `/normal`)
**Wave:** 3 — Brand DNA Assessment (**WAVE 3 CATCHUP — Wave 3 fully closed**)
**Type:** FEATURE
**Rollback:** feature-flag-gated (`brand_dna_assessment_enabled` kill-switch, default false). All portal routes require portal session cookie. No migration, no schema change.

---

## What was built

All BDA-5 acceptance criteria met. Client-facing Brand DNA portal assessment, multi-stakeholder company blend generation, and retake comparison flow.

### New files — Library layer (3)

| File | Purpose |
|---|---|
| `lib/brand-dna/generate-company-blend.ts` | Opus caller: reads ≥2 completed individual profiles for a company, generates blended tags + narrative + divergences via `buildCompanyBlendPrompt`, stores on `brand_dna_blends` |
| `lib/brand-dna/generate-retake-comparison.ts` | Opus caller: compares current + previous profile, generates 200–400 word comparison narrative via `buildRetakeComparisonPrompt`. Not persisted — returned for reveal UI |
| `lib/brand-dna/start-retake.ts` | Archives current profile (`is_current = false`), creates new version at `version + 1`, logs `retake_started` activity |

### New files — Portal routes (12)

| File | Purpose |
|---|---|
| `app/lite/portal/brand-dna/layout.tsx` | Dark immersive shell, kill-switch gated, portal session required |
| `app/lite/portal/brand-dna/page.tsx` | Entry: alignment gate (new) or resume (in-progress) or redirect to profile (complete) |
| `app/lite/portal/brand-dna/actions.ts` | Portal-side server actions: `submitPortalAlignmentGate`, `submitPortalAnswer`, `submitPortalReflection`, `markPortalProfileComplete`, `getPortalProfileId` |
| `app/lite/portal/brand-dna/section/[n]/page.tsx` | Card-per-question (reuses admin `QuestionCardClient` with portal action) |
| `app/lite/portal/brand-dna/section/[n]/insight/page.tsx` | Between-section insight (reuses admin `InsightRevealClient`) |
| `app/lite/portal/brand-dna/section/[n]/reflection/page.tsx` | Optional reflection (reuses admin `ReflectionClient`) |
| `app/lite/portal/brand-dna/reveal/page.tsx` | Cinematic reveal with Suspense; generates comparison narrative on retakes (version > 1) |
| `app/lite/portal/brand-dna/reveal/portal-reveal-client.tsx` | Portal-specific reveal client: same motion/sound as admin, no NextAuth `SessionProvider`/`useSession` |
| `app/lite/portal/brand-dna/profile/page.tsx` | Permanent revisitable profile page with company blend + retake trigger |
| `app/lite/portal/brand-dna/profile/profile-view-client.tsx` | Client component: full profile view, blend display, divergence flags, retake link |
| `app/lite/portal/brand-dna/retake/page.tsx` | Retake confirmation page: calls `startRetake()` → redirects to alignment gate |
| `app/lite/portal/brand-dna/retake/retake-confirm-client.tsx` | Retake confirmation UI with "Begin retake" / "Keep current" |

### New files — Tests (1)

| File | Purpose |
|---|---|
| `tests/brand-dna/bda5-blend-retake.test.ts` | 10 tests: prompt builders (company blend 3, retake comparison 3), export checks (3), barrel exports (1) |

### Edited files (2)

| File | Change |
|---|---|
| `lib/brand-dna/index.ts` | BDA-5 barrel exports: `generateCompanyBlend`, `generateRetakeComparison`, `startRetake` + their result types |
| `eslint.config.mjs` | Added `generate-company-blend.ts` + `generate-retake-comparison.ts` to `no-direct-anthropic-import` ignores |

---

## Key decisions (all silent per `feedback_technical_decisions_claude_calls`)

1. **Client components are shared, actions are separate.** `QuestionCardClient`, `InsightRevealClient`, `ReflectionClient`, `AlignmentGateClient` are imported from the admin `app/lite/brand-dna/` tree into the portal tree. All accept `submitAction` as a prop, so they work with either admin or portal actions. The `RevealClient` is portal-specific because the admin version couples to NextAuth `SessionProvider` / `useSession().update()`.

2. **Portal reveal doesn't need session.update().** Admin reveal calls `session.update()` to refresh the JWT `brand_dna_complete` claim (so proxy.ts Gate 1 clears). Portal sessions are cookie-based and the portal gate reads profile status from DB on each request — no cached JWT to refresh.

3. **Retake comparison is not persisted.** The comparison narrative is generated on-demand during the retake reveal and rendered inline. Both profiles (previous archived, current active) store all the data needed to regenerate. Avoids a new column or table.

4. **Company blend stored on `brand_dna_blends`.** Generated when ≥2 completed `client`-type profiles exist for a company. The blend output (shared tags, divergences, portrait) is parsed from Opus's structured response using the `=== SECTION ===` markers.

5. **Portal routes live under `/lite/portal/brand-dna/`.** Already covered by `proxy.ts`'s `isPublicRoute('/lite/portal/*')` pattern — no middleware changes needed.

---

## Verification gates

- **G1 preflight:** All preconditions verified: `brand_dna_profiles` schema, `brand_dna_blends` schema, `brand_dna_answers` schema, `getPortalSession`, prompt files, question bank, `generateSectionInsight`, `generateFirstImpression`, `generateProsePortrait`, `logActivity`, `killSwitches`, `modelFor` — all present.
- **G2 scope:** All files within BDA-5 whitelist.
- **G3 settings reads:** No new settings keys. Uses existing `brand_dna_assessment_enabled` kill-switch.
- **G4 literal-grep:** No autonomy-sensitive literals in diff. `max_tokens` values in LLM callers are API parameters, not autonomy config.
- **G5 motion:** Portal reveal reuses existing Tier-2 `brand-dna-reveal` choreography + `sound:brand_dna_reveal`. No new motion slots. Profile view uses standard houseSpring.
- **G6 rollback:** Feature-flag-gated. All portal routes gated by `brand_dna_assessment_enabled` kill-switch. No migration, no schema change.
- **G7 artefacts:** 16 new files + 2 edited files present and committed.
- **G8 typecheck + tests + lint + build:** `npx tsc --noEmit` → 0 errors. `npm test` → 1637 passed + 1 skipped (193 files, +10 new tests). `npm run lint` → 0 errors. `npm run build` → clean.
- **G9 E2E:** Not a critical flow in the Phase 4 list.
- **G10 browser:** Portal routes require active portal session cookie (set by magic link redemption). Full end-to-end portal flow not exercisable until CM-1 builds the client management surface and CLD-1 handles Cloudinary. Structural verification via build output confirming all routes register.
- **G11:** This file.
- **G12:** Tracker + commit.

---

## PATCHES_OWED (raised this session)

1. `bda5_blend_auto_trigger` — `generateCompanyBlend()` must be called automatically when a stakeholder completes their assessment and the company has ≥2 completed profiles. Currently the function exists but is not wired to any trigger. Wire in the CM wave when portal completion events are handled.

2. `bda5_retake_blend_regeneration` — Per spec §3.5: "Blend regenerated for multi-stakeholder companies when any stakeholder retakes." The `startRetake()` function archives the old profile but doesn't trigger blend regeneration. Wire when `markPortalProfileComplete` detects the company now has ≥2 completed profiles after a retake.

3. `bda5_portal_reveal_dedup_with_admin` — The `PortalRevealClient` duplicates ~80% of the admin `RevealClient` visual code. When a future session refactors the admin reveal (e.g. for the Settings → Display panel), extract the shared visual code into `components/brand-dna/reveal-visual.tsx` and have both clients compose it.

---

## What the next session (CMS-3 + CMS-4) inherits

CMS-3 and CMS-4 are content mini-sessions (Batch B), not code sessions. They produce copy, templates, and voice treatment for the Content Engine and SaaS Subscription Billing respectively. No dependency on BDA-5.

After CMS-3+CMS-4: Wave 10 catchup (CM-1 → CLD-1 → CLD-2 → CM-7 → ... → CM-E2E), then Wave 14 (IF-1 → IF-E2E).
