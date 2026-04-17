# `ce-2` — Keyword research pipeline + rankability scoring + topic queue — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (2 of 13)
**Model tier:** Opus (recovery session — prior session crashed mid-build, left dirty working tree)

---

## What was built

The **keyword research pipeline**, **rankability scoring engine**, **topic queue management**, **credential retrieval helper**, and **scheduled-task handler** — completing CE-2 scope.

**Files created (by prior session, verified and fixed this session):**

- `lib/content-engine/research.ts` — `fetchSerpResults()` (SerpAPI top 10 organic) + `runKeywordResearch()` (full pipeline: load seed keywords → SERP fetch → rankability score → Haiku outline → insert topic). Kill-switch gated via `content_automations_enabled`. Deduplicates against existing queued/generating/generated topics. Logs `content_topic_researched` activity.
- `lib/content-engine/rankability.ts` — `scoreKeywordRankability()` (0–100 composite: 0–70 authority + 0–30 gap bonus). `computeAuthorityScore()` linear scale (7 points per high-authority competitor). `isHighAuthority()` with subdomain matching. `analyseContentGaps()` fetch + cheerio text extraction + Haiku gap identification (1–3 gaps). `fetchAndExtractText()` with 10s timeout, nav/footer/sidebar stripping, 2000-char truncation.
- `lib/content-engine/topic-queue.ts` — `generateTopicOutline()` (Haiku with Brand DNA tags-only injection, structured JSON: sections, word count, snippet opportunity). `listQueuedTopics()` ordered by rankability score desc. `vetoTopic()` one-click status flip. `pickNextTopic()` top un-vetoed for generation.
- `lib/content-engine/index.ts` — Barrel exports for all CE-2 modules.
- `lib/integrations/getCredential.ts` — Shared credential retrieval helper. Reads `integration_connections` by vendor key, vault-decrypts. Returns `null` if no active connection. First consumer: CE-2 SerpAPI key; reusable by any wizard-registered integration.
- `lib/scheduled-tasks/handlers/content-keyword-research.ts` — `content_keyword_research` handler. Kill-switch gate + Zod payload validation + delegates to `runKeywordResearch()`.
- `data/high-authority-domains.json` — 433 domains (deduplicated this session from 438).
- `tests/content-engine/ce2-research.test.ts` — 27 tests across 7 describe blocks.

**Files edited:**

- `lib/scheduled-tasks/handlers/index.ts` — Added `CONTENT_KEYWORD_RESEARCH_HANDLERS` spread.
- `package.json` / `package-lock.json` — `cheerio ^1.2.0` added.

## Recovery context

A prior session wrote all the CE-2 source files but crashed before verification. This session:
1. Found dirty working tree with all CE-2 files in place but failing tests
2. Fixed broken `vi.mock("@/lib/db", ...)` in test file (referenced non-existent `tests/helpers/test-db` module)
3. Added missing `vi.mock("@/lib/channels/email/send")` mock (Resend constructor throws without API key when handler registry is imported)
4. Added `vi.mock("@/lib/integrations/getCredential")` mock
5. Deduplicated `data/high-authority-domains.json` (5 duplicates: digitalocean.com, producthunt.com, sourceforge.net, canva.com, figma.com)
6. Ran full verification gates

## Key decisions (locked by prior session, verified this session)

1. **`getCredential()` as shared primitive.** Not CE-specific — any wizard-registered API key is retrieved the same way.
2. **Authority score is linear.** 7 points per high-authority result, max 70. Simple, predictable, explainable.
3. **Content gap analysis degrades gracefully.** Fetch failures → skipped page. LLM failure → empty gaps (topic still queues on authority score alone). Zero gaps → no gap bonus (authority score only).
4. **Outline fallback on LLM failure.** Minimal single-section outline so the topic still enters the queue.
5. **`pickNextTopic()` has redundant WHERE clause.** `status = "queued"` already excludes vetoed/skipped but the extra `not(inArray(...))` is harmless. Noted for future cleanup.

## Verification (G0–G12)

- **G0** — CE-1 and OS-3 handoffs read. Spec `content-engine.md` read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `content_topics` table, `content_engine_config` table, `integration_connections` table, `brand_dna_profiles` table, `companies` table, `activity_log` kinds, `scheduled_tasks` types, kill switches, settings keys — all exist.
- **G2** — Files match CE-2 scope.
- **G3** — No motion work. Pipeline-only session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Truncation limit (2000 chars) is a content-processing constant, not an autonomy threshold.
- **G5** — Context budget held. Recovery session, small-to-medium scope.
- **G6** — No migration. Code-only additions. Rollback: git-revertable.
- **G7** — 0 TS errors, 155 test files / 1175 passed + 1 skipped (+27 new), clean production build, lint 0 errors (58 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1175 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 0 errors, 58 warnings.
- **G9** — No UI changes. Pipeline-only session.
- **G10** — No browser-verifiable surfaces. Pipeline behaviours exercised by unit tests.
- **G10.5** — N/A (pipeline session, no UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_2_pick_next_topic_redundant_where`** — `pickNextTopic()` has `eq(status, "queued") AND not(inArray(status, ["vetoed","skipped"]))`. Second clause is redundant. Harmless but noisy. Low-priority cleanup.
- **`ce_2_settings_key_for_text_truncation`** — `fetchAndExtractText` uses hardcoded 2000-char truncation. Consider promoting to `content.scrape_text_max_chars` settings key if it needs tuning. Low priority.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Content engine library modules (research, rankability, topic-queue, index)
- Credential retrieval helper
- Scheduled task handler + registry entry
- High-authority domains data file
- Test file
- cheerio dependency

## What the next session (CE-3) inherits

CE-3 is blog generation + review surface + rejection chat + publishing. It inherits:

- **Full keyword research pipeline** ready to populate the topic queue.
- **Topic queue management** — `listQueuedTopics()`, `vetoTopic()`, `pickNextTopic()` all available.
- **`generateTopicOutline()`** — outlines already generated during research and stored on topics.
- **`getCredential()`** shared primitive for API key retrieval.
- **LLM job slugs registered** — `content-score-keyword-rankability` and `content-generate-topic-outline` in models registry + INDEX.
- **No prompt files yet** — CE-2 uses inline prompts (gap analysis + outline generation). CE-3 should consider extracting to `lib/ai/prompts/content-engine/` if the pattern warrants.
- **Blog generation needs:** `content-generate-blog-post` (Opus) prompt, two-pass pipeline, split-pane review surface, rejection chat, publishing to Cloudflare path route, SEO elements, OG image generation.
