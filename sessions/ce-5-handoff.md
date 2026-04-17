# `ce-5` — Visual generation pipeline (social templates + Puppeteer + OpenAI Images) — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (5 of 13)
**Model tier:** Sonnet (as recommended — large implementation session)

---

## What was built

The **social draft generation pipeline**, **template-based image rendering**, **AI image fallback**, **asset storage**, and **visual asset orchestration** — completing CE-5 scope.

**Files created:**

- `lib/content-engine/social-drafts.ts` — `generateSocialDrafts(blogPostId)`: Haiku call per platform (Instagram, LinkedIn, X, Facebook) generates platform-specific text, decides format (single/carousel), inserts `social_drafts` rows with status `generating`. Platform specs enforce register, max length, hashtag guidance, and format constraints (only Instagram gets carousels in v1). `listSocialDrafts(blogPostId, status?)` query helper. Parse fallback on malformed LLM JSON.
- `lib/content-engine/social-templates.ts` — Four starter templates as pure HTML-string builders (same pattern as `lib/quote-builder/pdf-template.ts`): `quote-card` (pull-quote with accent bar), `stat-highlight` (big number/stat), `listicle-card` (numbered key point), `branded-hero` (title-forward with gradient, default fallback). `renderCarouselTemplate()` for multi-slide Instagram carousels with slide numbering. `BrandVisualTokens` type for template variable injection. `PLATFORM_DIMENSIONS` map for all platforms + Instagram portrait variant. HTML escaping on all user-supplied text.
- `lib/content-engine/render-social-image.ts` — `renderSocialImage(html, opts)`: Puppeteer screenshot renderer (extends `lib/pdf/render.ts` pattern). 2x `deviceScaleFactor` for crisp social images. `renderSocialImageBatch(items)`: single-browser-session batch renderer for efficient carousel generation.
- `lib/content-engine/ai-image.ts` — `generateAiImage(blogTitle, blogExcerpt, platform, tokens)`: three-step pipeline — Haiku generates image prompt → OpenAI Images API (DALL-E 3, `b64_json` response format) → Haiku quality gate verification. Returns prompt and revised prompt for auditing. Conservative fallback: quality gate passes on error (discipline #63).
- `lib/content-engine/asset-storage.ts` — `storeContentAsset(key, buffer)` → URL, `readContentAsset(key)` → Buffer|null. v1 stores to `data/content-assets/` (gitignored). Future: swap to R2.
- `lib/content-engine/visual-assets.ts` — `generateVisualAssets(blogPostId)`: orchestrator — for each `generating` social draft: Haiku selects template or decides AI generation → render via template+Puppeteer or OpenAI Images → store → update `social_drafts` with `visual_asset_urls` and status `ready`. `loadBrandVisualTokens(companyId)`: extracts visual tokens from Brand DNA signal_tags, falls back to SuperBad defaults. Carousel path: renders all slides in a single Puppeteer session. AI image fallback on failure: falls back to branded-hero template.
- `app/api/content-assets/[...path]/route.ts` — Public GET route serving stored visual assets. MIME type detection, path traversal prevention, immutable cache headers.
- `tests/content-engine/ce5-social-visual-pipeline.test.ts` — 24 tests across 7 describe blocks.

**Files edited:**

- `lib/content-engine/index.ts` — Added CE-5 barrel exports: `generateSocialDrafts`, `listSocialDrafts`, `generateVisualAssets`, `loadBrandVisualTokens`, `renderTemplate`, `renderCarouselTemplate`, `PLATFORM_DIMENSIONS`, `renderSocialImage`, `renderSocialImageBatch`, `generateAiImage`, `storeContentAsset`, `readContentAsset`.
- `.gitignore` — Added `data/content-assets/` exclusion.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **v1 local asset storage, not R2.** Images stored to `data/content-assets/` and served via API route. R2 upload is a future swap (same `storeContentAsset` interface). Simpler for dev, no additional cloud config needed.
2. **Only Instagram gets carousels in v1.** LinkedIn carousels use PDF documents (different format); X and Facebook don't support multi-image carousel in the same way. The LLM may suggest carousel for other platforms — the parser enforces `single` format for non-Instagram.
3. **2x deviceScaleFactor for social images.** Social platforms display at high DPI. 2x rendering ensures crisp images without bloating file size excessively.
4. **Single-browser batch rendering for carousels.** `renderSocialImageBatch()` opens one Puppeteer instance for all slides, reducing the heavyweight browser-launch cost.
5. **Branded-hero as universal fallback.** When AI image generation fails (no API key, prompt generation fails, quality gate fails), the orchestrator always falls back to the branded-hero template rather than leaving the draft without visuals.
6. **Conservative quality gate (discipline #63).** Haiku quality gate passes on error — a slightly-wrong image that Andy can review is better than a missing visual that blocks the draft.
7. **Video/Remotion deferred.** Per spec §5.2 path 3, video is large-tier only. Separate session scope — CE-5 covers template + AI image paths.

## Verification (G0–G12)

- **G0** — CE-4 and CE-3 handoffs read. Spec `content-engine.md` §5 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `social_drafts` table, `blog_posts` table, `brand_dna_profiles` table, `content_automations_enabled` kill switch, Puppeteer (`puppeteer-core`), `invokeLlmText`, `content-generate-social-draft` / `content-select-visual-template` / `content-generate-image-prompt` LLM slugs — all present.
- **G2** — Files match CE-5 scope (social drafts + templates + rendering + AI image + asset storage + orchestration).
- **G3** — No motion work. Pipeline/rendering session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Platform max lengths and dimensions are format constraints, not autonomy thresholds.
- **G5** — Context budget held. Large session as estimated.
- **G6** — No migration. Code-only additions. Rollback: git-revertable.
- **G7** — 0 TS errors, 158 test files / 1241 passed + 1 skipped (+24 new), clean production build, lint 0 errors (58 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1241 passed. `npm run build` → success. `npm run lint` → 0 errors.
- **G9** — New API route: `/api/content-assets/[...path]`. No admin UI surfaces (social tab is a later CE session).
- **G10** — Pipeline behaviours exercised by unit tests. Asset serving verified via build compilation.
- **G10.5** — N/A (pipeline/library session, no external UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_5_r2_asset_storage`** — Swap local `data/content-assets/` storage to Cloudflare R2 for production durability. Same `storeContentAsset` interface. Low priority for dev, required before launch.
- **`ce_5_video_remotion_pipeline`** — Video generation via Remotion (spec §5.2 path 3, large tier only). Animated text, kinetic typography, parallax from motion templates. Separate session scope.
- **`ce_5_og_image_from_template`** — Use the social template system to auto-generate OG images for blog posts (closes `ce_3_og_image_generation`). Wire into `publishBlogPost()`.
- **`ce_5_brand_dna_visual_tokens_enrichment`** — Brand DNA signal_tags currently has generic structure. When Brand DNA assessment gains explicit visual preference questions (colour, mood, style), the `loadBrandVisualTokens()` extraction should be updated to read those specific fields.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Social draft generation pipeline
- Template system + image renderer
- AI image generator
- Asset storage + API route
- Barrel exports
- Test file

## What the next session (CE-6) inherits

CE-6 is the `content_fan_out` scheduled-task handler (on blog approval → social drafts + newsletter). It inherits:

- **`generateSocialDrafts(blogPostId)`** — generates text drafts for all 4 platforms.
- **`generateVisualAssets(blogPostId)`** — renders visual assets for all drafts, transitions status to `ready`.
- **`content_fan_out` task type** — already registered in A6's type enum.
- **Fan-out orchestration:** CE-6 calls `generateSocialDrafts()` then `generateVisualAssets()` then newsletter rewrite (CE-7 scope) in sequence.
- **Social tab UI** — not yet built. CE-8+ builds the admin surface for viewing/publishing social drafts.
