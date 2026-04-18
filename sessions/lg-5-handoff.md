# `lg-5` — Draft generator + Brand Voice integration + drift check wiring — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (5 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Hunter.io contact discovery

**`lib/lead-gen/contact-discovery.ts`** — `discoverContact(domain, companyName)`:

- Queries Hunter.io Domain Search API with 10s timeout.
- Prefers decision-maker roles from closed list (§7.1 step 2): founder, ceo, owner, marketing-manager, marketing-director, growth-lead.
- High-confidence (≥70) matches → `email_confidence: 'verified'`.
- Low-confidence matches → `email_confidence: 'inferred'`.
- Pattern inference fallback for generic patterns (`info@`, `contact@`, `hello@`). Name-dependent patterns (`{first}.{last}`) return null — no name available at discovery time.
- Logs to `external_call_log` (job: `hunter.domain_search`, cost: ~$0.03).
- Uses `getCredential("hunter-io")` from vault.
- Graceful degradation: no API key → returns null; fetch error → returns null.

### 2. Outreach draft generator

**`lib/lead-gen/draft-generator.ts`** — `generateDraft(input)`:

- Opus-tier per-prospect email generation via `invokeLlmText` (job: `lead-gen-outreach-draft`).
- System prompt composes: SuperBad Brand DNA profile (via `getSuperbadBrandProfile()`, discipline #44), sender identity, prospect track, Spam Act footer template, output format rules.
- User prompt includes: prospect company/contact, brief, touch kind, viability profile as structured JSON, prior touches for follow-ups, recent blog posts (empty in v1), nudge feedback when provided.
- Every email generated end-to-end per prospect by LLM — no templates (memory `feedback_outreach_never_templated`).
- Post-generation Zod-free JSON parse with markdown-fence stripping.
- §8.4 drift check: `checkBrandVoiceDrift()` on every draft → one auto-regen with drift feedback on failure → second failure flags visibly (`drift_check_flagged: true`) without blocking.
- Persists to `outreach_drafts` table with all generation metadata (model, prompt version, generation time, drift scores).
- Links draft to candidate via `lead_candidates.pending_draft_id`.
- §8.5 nudge regeneration: `nudgeFeedback` param triggers regeneration with Andy's feedback in the prompt; persisted to `nudge_thread_json`.
- Logs `draft_generated` activity.

### 3. Daily search pipeline wiring (steps 8–10)

**`lib/lead-gen/daily-search.ts`** — steps 8–10 of §3.4 replaced from stubs to real calls:

- Step 8: `discoverContact()` for each top candidate. Domainless candidates skip Hunter.io. No contact email → candidate skipped (§7.1 step 5).
- Step 9: `generateDraft()` with first-touch params, standing brief, viability profile, contact info.
- Step 10: Drift check wired inside `generateDraft()`.
- `draftedCount` now tracks real draft generation count in `lead_runs` summary.

### 4. Candidate creation extended

**`lib/lead-gen/candidate.ts`** — `CreateCandidateInput` extended with optional `contactEmail`, `contactName`, `contactRole`, `emailConfidence` fields. Values populated from Hunter.io discovery and written to `lead_candidates` row.

## Files created

- `lib/lead-gen/contact-discovery.ts`
- `lib/lead-gen/draft-generator.ts`
- `tests/lead-gen/lg5-contact-discovery.test.ts`
- `tests/lead-gen/lg5-draft-generator.test.ts`

## Files edited

- `lib/lead-gen/daily-search.ts` — steps 8–10 wired, imports added
- `lib/lead-gen/candidate.ts` — extended input type + insert values
- `lib/lead-gen/index.ts` — LG-5 barrel exports added

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Hunter.io confidence threshold at 70.** Matches above 70 confidence → `verified`; below → `inferred`. 30 is the absolute minimum — below that, the match is too unreliable to even try.

2. **Pattern inference is limited to generic-name patterns only.** Without a known contact name, name-dependent patterns (`{first}`, `{first}.{last}`) can't be filled. Returns null instead of guessing. Candidate is skipped with `no_contact_email`.

3. **Draft generation is inline-synchronous in the daily search loop.** Each candidate gets its draft generated sequentially during the daily run. Acceptable for the v1 daily cap of 5–30 candidates; parallelisation would risk rate limits and make error attribution harder.

4. **Brand DNA loaded via `getSuperbadBrandProfile()` (existing).** Reuses the Quote Builder's shared helper. SuperBad's own brand assessment → drift-grader shape, with fallback to hard-coded profile for early dev.

5. **Prompt version `lg5-v1` stored with every draft.** Enables future prompt A/B testing at the strategy level (not copy level, per `feedback_outreach_never_templated`).

## Verification (G0–G12)

- **G0** — LG-4 and LG-3 handoffs read. Spec §7, §8, §3.4 read.
- **G1** — Preconditions verified: `invokeLlmText`, `checkBrandVoiceDrift`, `getSuperbadBrandProfile`, `outreachDrafts` schema, `leadCandidates` schema, `getCredential`, `external_call_log`, `lead-gen-outreach-draft` LLM slug, `SUPERBAD_SENDER`, `logActivity` — all present.
- **G2** — Files match LG-5 scope (contact discovery + draft generator + daily search wiring + tests).
- **G3** — No motion work.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Hunter confidence threshold (70, 30) and cost estimate ($0.03) are operational constants, not autonomy thresholds.
- **G5** — Context budget held. Medium session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 187 test files / 1556 passed + 1 skipped (+19 new), clean production build.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1556 passed.
- **G9** — No browser-testable surface. Library-only session.
- **G10** — Contact discovery: 7 tests (API key missing, verified match, inferred match, role preference, pattern fallback, name-required pattern, fetch error, low-confidence skip). Draft generator: 12 tests (happy path, kill switch, API error, unparseable response, drift regen + flag, successful regen, nudge feedback, follow-up touches, system message discipline #44, empty subject/body, markdown-fenced JSON).
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`lg_5_hunter_name_pattern_inference`** — Pattern inference with contact names (from website scrape team page or other sources) would improve email discovery. Currently only generic patterns (`info@`, `contact@`) are inferred. Future enhancement when website scrape discovers team names.
- **`lg_5_draft_generation_parallel`** — Draft generation runs sequentially per candidate. Parallelisation deferred — v1 daily caps are low enough that sequential is fine.
- **`lg_5_recent_blog_posts_wiring`** — `recentBlogPosts` param always `[]` in v1. Content Engine v1.1 can populate from published blog posts to give the draft generator reference material.

## PATCHES_OWED (closed this session)

- **`lg_4_draft_generation_stub`** — Steps 8–10 of §3.4 are now fully wired.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Contact discovery module
- Draft generator module
- Daily search wiring (reverts to stubs)
- Candidate creation contact field population
- Barrel export additions
- Test files

## What the next session (LG-6) inherits

LG-6 is **Warmup ramp enforcement + sender reputation tracking** — replaces the `settings.max_per_day` cap stub in `runDailySearch()` with real `enforceWarmupCap()` reading from `resend_warmup_state`. LG-5 provides:

- **Full daily search pipeline** — steps 1–12 all wired. LG-6 only needs to replace the warmup stub at step 1.
- **Draft generation producing real `outreach_drafts` rows** — the approval queue (LG-7) has real data to render.
- **Contact discovery populating `lead_candidates` with emails** — the send path (LG-8+) has contact info to send to.
