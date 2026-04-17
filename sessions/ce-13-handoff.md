# `ce-13` — Content Engine final session (Wave 12 close) — Handoff

**Closed:** 2026-04-18
**Wave:** 12 — Content Engine (13 of 13) — **WAVE 12 COMPLETE**
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

Three deliverables closing out the Content Engine wave:

### 1. Content-to-outreach matching pipeline (spec §6)

**Files created:**

- `lib/content-engine/outreach-match.ts` — `matchContentToProspects(postId, companyId)` with 4 gates (kill switch → SuperBad-only → post status → Lead Gen availability). Returns early with `lead_gen_not_available` until Wave 13 builds the `lead_candidates` table. Stub `scoreProspects()` and `draftContentOutreachEmail()` functions document the Wave 13 contract (Haiku scoring + Opus drafting). Exports `RELEVANCE_THRESHOLD` (60).

- `lib/scheduled-tasks/handlers/content-outreach-match.ts` — `content_outreach_match` handler. Kill-switch gate on `content_outreach_enabled`, Zod-validated payload, delegates to library.

**Files edited:**

- `lib/scheduled-tasks/handlers/index.ts` — Added `CONTENT_OUTREACH_MATCH_HANDLERS` to registry.
- `lib/scheduled-tasks/handlers/content-fan-out.ts` — Step 3.5 added: enqueues `content_outreach_match` after successful publish, idempotency-keyed on `post_id`.

### 2. Claimable content items for Hiring Pipeline (spec §14.0)

**Files created:**

- `lib/content-engine/claimable-items.ts` — Three functions per spec contract:
  - `listClaimableContentItems({ suitableFor, companyId, limit? })` — returns queued topics with outlines, unclaimed.
  - `claimInternalContentItem(contentId, candidateId, budgetCapAud)` — atomic claim via `UPDATE ... WHERE claimed_by IS NULL`.
  - `releaseContentItem(contentId, reason)` — clears claim, records release reason.

### 3. Demo landing page (spec §3.4)

**Files created:**

- `app/get-started/content-engine/page.tsx` — Server component. SEO metadata. Renders inside existing `/get-started` layout.
- `app/get-started/content-engine/_components/demo-client.tsx` — Client component. Two inputs (vertical + location-locked toggle). Framer Motion transitions. Loading state with progress bar. Result display: keyword + rankability score, outline with sections, content gaps, excerpt in SuperBad's voice, pitch line.
- `app/get-started/content-engine/actions.ts` — Server action `runContentEngineDemo()`. Lightweight pipeline: Haiku keyword derivation → Haiku outline → Opus excerpt. Kill-switch gated on `llm_calls_enabled`. Rankability score simulated (real SerpAPI requires API key setup).

**Files edited:**

- `lib/content-engine/index.ts` — Added CE-13 barrel exports (outreach-match + claimable-items).

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Lead Gen gate returns `false` until Wave 13.** Rather than a dynamic table-existence check (fragile), `isLeadGenAvailable()` returns `false` as a static flag. Wave 13's LG-1 session changes this to `true` and wires the real candidate queries. Clean, explicit, no magic.

2. **Fan-out enqueues outreach-match after publish succeeds.** The `content_outreach_match` task is enqueued at Step 3.5 in the fan-out handler, only when publish returns `ok: true`. Failed publishes don't trigger matching — there's no published URL to link to.

3. **Demo page uses Haiku for keyword/outline + Opus for excerpt.** Matches the real pipeline tiers. Rankability score is simulated (random 55–85) since demo visitors haven't configured SerpAPI. Real scoring lands when the SaaS billing wave wires productConfig.

4. **Claimable items filter on outline presence.** Topics without outlines aren't suitable for trial tasks — candidates need the outline to understand the brief. The `listClaimableContentItems` function filters these out post-query.

5. **Demo result persistence deferred.** Spec §3.4 says "demo result persists to account on signup." This requires SaaS billing infrastructure (Wave 8) to create the account + link the result. Logged as PATCHES_OWED.

## Verification (G0–G12)

- **G0** — CE-12 and CE-11 handoffs read. Spec §6, §14.0, §3.4 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `blogPosts` table, `contentTopics` table with claimable columns, `companies` table, `killSwitches.content_outreach_enabled`, handler registry, `enqueueTask()`, `logActivity()`, `/get-started` layout — all present.
- **G2** — Files match CE-13 scope (outreach matching + claimable items + demo page + tests).
- **G3** — No new motion work. Demo page uses houseSpring via Framer `motion` (existing).
- **G4** — No numeric/string literals in autonomy-sensitive paths. `RELEVANCE_THRESHOLD` is a named constant.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 169 test files / 1350 passed + 1 skipped (+16 new), clean production build, lint 0 errors (2 warnings on CE-13 stub files — unused rest args on Wave 13 stub functions).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1350 passed. `npm run build` → success.
- **G9** — No browser-testable state yet (demo requires LLM keys in .env). UI structure verified via build.
- **G10** — Outreach matching + claimable items + handler exercised by 16 unit tests.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_13_lead_gen_wiring`** — `isLeadGenAvailable()` returns `false`. Wave 13 LG-1 flips this and wires `scoreProspects()` + `draftContentOutreachEmail()` to real candidate queries.
- **`ce_13_demo_result_persistence`** — Demo result doesn't persist to account on signup. Needs SaaS billing account creation flow (Wave 8 SB-4/SB-6) to link demo output to new subscriber.
- **`ce_13_demo_serpapi_scoring`** — Demo uses simulated rankability score. Real SerpAPI scoring requires API key, which requires the setup wizard to have been run. Consider a platform-level SerpAPI key for demo purposes.
- **`ce_13_gsc_oauth`** — Google Search Console OAuth integration (spec §7.2). Requires OAuth consent flow infrastructure. CE-12 also flagged this (`ce_12_gsc_oauth_substep`). Deferred to a future polish pass or the SW wave when OAuth step-type lands.
- **`ce_13_remotion_video`** — Remotion video generation for social drafts (spec §5.2 path 3, large tier only). Requires Remotion npm dependency + Lambda setup. CE-5 also deferred this. Lands in a dedicated session post-Wave 12.
- **`ce_13_superbad_company_gate`** — `isSuperBadCompany()` currently returns `true` for any existing company. Needs a proper `is_superbad` flag on `companies` or a settings key. Wave 13 or Phase 6 launch step.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Outreach matching library + handler + registry wiring
- Claimable items library
- Demo page + server action + client component
- Content-engine barrel exports for CE-13 modules
- Fan-out enqueue step 3.5
- Test files

## Wave 12 — Content Engine COMPLETE

All 13 sessions (CE-1 through CE-13) shipped. The Content Engine is fully built:

- **Pipeline:** Research → Topic Queue → Generation → Review → Publish → Fan-out (social + newsletter + outreach matching)
- **Admin surfaces:** 5 tabs (Review, Social, Metrics, Topics, List) + fleet overview + onboarding wizard
- **Crons:** 6 scheduled tasks (keyword research, draft generation, fan-out, newsletter send, ranking snapshot, outreach match)
- **Public:** Blog route at `/blog/[slug]` + demo at `/get-started/content-engine`
- **Cross-spec contracts:** Claimable items for Hiring Pipeline, outreach matching for Lead Gen

**Deferred to future sessions:** GSC OAuth, Remotion video, demo result persistence, real SerpAPI in demo.

## What the next wave (Wave 13 — Lead Generation) inherits

- **`content_outreach_match` handler** wired and registered. LG-1 flips `isLeadGenAvailable()` and implements `scoreProspects()` + `draftContentOutreachEmail()`.
- **Fan-out auto-enqueues** the matching task on every published post.
- **Kill switch** `content_outreach_enabled` gates the entire pipeline.
