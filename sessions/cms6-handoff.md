# CMS-6 Handoff — Content Mini-Session: Cost & Usage Observatory + Surprise & Delight

**Date:** 2026-04-21
**Status:** COMPLETE

## What was produced

### Cost & Usage Observatory (4 files)

1. **`docs/content/cost-usage-observatory/banners.md`** �� Banner copy for all 3 severity tiers:
   - Tier-low: 10 variants stratified by job family (LLM/payments/comms/media rendering)
   - Tier-mid: 8 variants, same stratification, prominent numbers + multiplier
   - Tier-severe: 5 variants, terse/flat/no-voice
   - Threshold-crossed: 2 MTD + 3 projection variants
   - Tier-health: 2 variants for underwater-tier banners
   - Unknown-job: 1 variant
   - Kill-switch modal: 2 disable + 2 resume confirmation lines
   - Acknowledge/suppress: 2 variants

2. **`docs/content/cost-usage-observatory/empty-states.md`** — 6 dashboard surfaces:
   - Observatory landing, tier-health all-green, anomalies empty, top-jobs loading, settings blank, kill-switches empty

3. **`docs/content/cost-usage-observatory/weekly-digest.md`** — Full digest email framework:
   - Subject-line pool: 7 variants (3 green, 2 amber, 2 red posture)
   - Opener pool: 6 variants
   - Section headings: 5 fixed sections
   - Closer pool: 4 variants

4. **`docs/content/cost-usage-observatory/diagnosis-scenarios.md`** — 10 synthetic anomaly scenarios for Opus prompt calibration:
   - Prompt regression, loop detection, vendor price change, data spike, ambiguous third-party change, warmup false positive, multi-job cascade, silent-governor guardrail, deploy-without-prompt-change, diagnoser self-trigger

### Surprise & Delight (4 files)

5. **`docs/content/surprise-and-delight/ambient-pools.md`** — Seed copy for all 6 closed-list ambient surface categories:
   - Empty states (7 sub-contexts: pipeline, prospects, inbox, tasks, content, notes, fallback)
   - Error pages (404, 500, generic)
   - Loading copy (10 lines)
   - Success toasts (15 lines: general + specific actions)
   - Placeholder text (search bars, inputs, notes, filter states)
   - Morning brief narrative (calm/busy/mixed/Monday/Friday variants)

6. **`docs/content/surprise-and-delight/egg-copy.md`** — Final copy for all 18 eggs:
   - 12 public eggs with copy pools (including welcome safety net)
   - 6 admin eggs with copy pools (CRT, milestone spotter, three wons, weekend warrior, inbox zero, first client won)

7. **`docs/content/surprise-and-delight/riddles.md`** — 3 seed riddles:
   - "Grandmother" (answer: fourteen) — 7 common wrongs + reward content
   - "Camera" (answer: camera) — 7 common wrongs + reward content
   - "Melbourne" (answer: melbourne) — 6 common wrongs + reward content
   - Each includes social post text, public reward, logged-in reward with persistent icon

8. **`docs/content/surprise-and-delight/per-page-configs.md`** — Per-page configs resolving PATCHES_OWED:
   - Rapid scroller summaries: 9 pages with one-sentence summaries
   - Deep reader link targets: 9 pages with deeper-piece links (some disabled at launch, fail-closed)
   - Rain ambient audio requirements documented (file still needs sourcing)

## PATCHES_OWED status

- `sd11_rapid_scroller_per_page_summary` — **RESOLVED** by `per-page-configs.md`
- `sd11_deep_reader_link_target` — **RESOLVED** by `per-page-configs.md`
- `sd11_rain_ambient_mp3` — **STILL OPEN** — requirements documented, file needs sourcing in an asset session or manual commit

## Admin egg catalogue expansion

The tracker listed "3–5 more owed from Phase 3" as a CMS-6 deliverable. **Already completed** by SD-13 (2026-04-21): added weekend warrior, inbox zero, first client won — total admin eggs now 6.

## Next session should know

- **COB-4** is unblocked. CMS-6 content is landed; all banner copy, empty states, and digest framework are ready for the detector + banner build sessions.
- **Rain ambient MP3** remains the only open S&D patch. It's an audio file to source, not a content gap.
- **Diagnosis scenarios** (10 in the calibration file) should be used as a test harness when building the `diagnose-cost-anomaly.ts` prompt in COB-5/COB-6.
- **Ambient copy pools** are seeds for `generateInVoice()` — the LLM regenerates on demand. Build sessions wire the retrieval, not the static content.
- **Per-page configs** need to be loaded into the public marketing site's build config when those pages ship. Each new page added post-launch must include a rapid-scroller summary.
