# `ce-12` — Content Engine onboarding wizard — Handoff

**Closed:** 2026-04-18
**Wave:** 12 — Content Engine (12 of 13)
**Model tier:** Sonnet (as recommended — standard UI session)

---

## What was built

The **Content Engine onboarding wizard** — a 3-step client-facing wizard rendered inside `<WizardShell>` per spec §3.3 + §1.1.

**Files created:**

- `lib/content-engine/onboarding.ts` — `deriveSeedKeywords()` (Brand DNA signal tags + vertical + location → keyword list with source attribution), `ensureContentEngineConfig()` (idempotent config row creation), `completeContentEngineOnboarding()` (saves preferences, kicks off pipeline, logs activity).

- `lib/wizards/defs/content-engine-onboarding.ts` — `WizardDefinition` with key `content-engine-onboarding`, 3 steps (dns-verify → review-and-confirm → form), completion contract requiring domain verified + at least 1 keyword + send day.

- `app/lite/content/onboarding/page.tsx` — Server component. Reads shell config, renders client orchestrator.

- `app/lite/content/onboarding/_components/onboarding-client.tsx` — Client orchestrator. Three custom step components:
  - Step 1: Domain verification (DNS record display with manual confirm checkbox — Cloudflare CNAME + Resend SPF/DKIM)
  - Step 2: Seed keyword review (derived keywords with source labels, remove/add, "These look right" CTA)
  - Step 3: Newsletter preferences (send day/time/tz selectors, optional CSV import, "Start my engine" CTA)

- `app/lite/content/onboarding/actions.ts` — 2 server actions: `initOnboardingAction` (ensure config + derive keywords), `completeOnboardingAction` (Zod-validated, saves preferences + optional CSV import + kicks off pipeline).

- `tests/content-engine/ce12-onboarding.test.ts` — 12 tests: deriveSeedKeywords (empty, vertical+location, signal tags, malformed tags), ensureContentEngineConfig (existing, new), completeContentEngineOnboarding (no config), wizard definition (registration, step order, contract reject ×2, contract accept).

**Files edited:**

- `lib/wizards/defs/index.ts` — Added `content-engine-onboarding` import to barrel.
- `lib/content-engine/index.ts` — Added CE-12 barrel exports (onboarding module).

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Custom step components over step-type registry.** The three steps have Content-Engine-specific logic (keyword editing with source labels, send-window picker, CSV toggle) that doesn't fit the generic step-type components. Custom components rendered as `children` inside WizardShell — same pattern as other wizard consumers.

2. **Domain verification is a manual confirm checkbox.** Real DNS polling (dns-verify step-type) requires a resolver backend not yet wired. The checkbox approach lets subscribers proceed immediately and notes that DNS propagation takes up to 48h. The engine starts keyword research after Step 2 regardless — by the time DNS resolves, drafts are ready.

3. **Seed keyword derivation is synchronous.** Runs at wizard init, not as a background job. Company vertical + location + Brand DNA signal tags (top 8 by frequency) derived in a single pass. Sources shown alongside each keyword so the subscriber understands why each was suggested.

4. **CSV import via server action, not the csv-import step-type.** The step-type does client-side parse + column mapping. For the onboarding wizard, CSV is optional and simpler — raw file read on client, server-side parse and import via `importSubscribersFromCsv()`.

## Verification (G0–G12)

- **G0** — CE-11 and CMS-2 handoffs read. Spec §3.3, §1.1 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `WizardShell`, `content_engine_config` table, `brand_dna_profiles` table, `companies` table, `importSubscribersFromCsv()`, `ensureContentGenerationEnqueued()`, `registerWizard()` — all present.
- **G2** — Files match CE-12 scope (onboarding wizard + supporting library + tests).
- **G3** — No motion work. Wizard shell inherits houseSpring from SW-1.
- **G4** — No numeric/string literals in autonomy-sensitive paths.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 166 test files / 1334 passed + 1 skipped (+12 new), clean production build, lint 0 errors (66 warnings, 0 from CE-12 files).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1334 passed. `npm run build` → success.
- **G9** — No browser-testable state yet (no real data in dev db). UI structure verified via build.
- **G10** — Onboarding logic exercised by 12 unit tests.
- **G10.5** — N/A (standard UI build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_12_dns_polling_backend`** — Domain verification uses manual confirm checkbox. Real DNS record polling (via dns-verify step-type with a resolver function) is owed for a future polish pass. Not blocking — engine starts research after Step 2 regardless of DNS propagation status.
- **`ce_12_gsc_oauth_substep`** — Spec §3.3 Step 1 includes "optional Google Search Console OAuth connection." Not wired in this session — GSC OAuth requires the OAuth consent flow infrastructure which lands in a later wave. The wizard works without it (SerpAPI is the baseline per spec §7.1).
- **`ce_12_wizard_progress_persistence`** — Wizard state lives in React state only. Full `wizard_progress` table persistence (resume after browser close) is owed from the SW-2 step library wiring. Not CE-12 specific — applies to all wizard consumers.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Onboarding page + server actions + client component
- Onboarding library module
- Wizard definition + barrel import
- Content-engine barrel exports
- Test file

## What the next session (CE-13) inherits

CE-13 is the **final Wave 12 session** — whatever's left from the Content Engine build plan. CE-12 provides:

- **Wizard definition registered** at key `content-engine-onboarding` — ready for portal `firstRunView` routing.
- **`deriveSeedKeywords(companyId)`** — reusable for any context that needs to suggest keywords from Brand DNA.
- **`ensureContentEngineConfig(companyId)`** — idempotent config row creation for new subscribers.
- **`completeContentEngineOnboarding()`** — kicks off pipeline after wizard completion.
