# HP-5 Handoff — Hiring Pipeline: Portfolio Ingestion (Platform-Specific API Handlers)

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Vision LLM support — `lib/ai/invoke.ts`

`invokeLlmVision({ job, prompt, imageUrls, system, maxTokens })` — new function extending the LLM invoke boundary to support Anthropic's image content blocks. Returns `InvokeLlmResult` (text + token counts). Uses `source.type: "url"` for image blocks. Available to any future consumer needing vision analysis.

### Platform-specific portfolio handlers — `lib/hiring/portfolio.ts`

Rewrote from a stub module into a full multi-platform ingestion pipeline. Three platform handlers + vision analysis + external call logging:

**Vimeo handler** (`fetchVimeoSignal`):
- Calls Vimeo's oEmbed API (`vimeo.com/api/oembed.json`) — free, no API key needed.
- Extracts: title, description, author_name, thumbnail_url.
- Returns video-typed WorkSample with title + thumbnail.
- Gated by `hiring.discovery.vimeo_enabled` kill switch.

**Behance handler** (`fetchBehanceSignal`):
- Fetches the Behance page and extracts OG metadata via cheerio.
- Extracts: og:title, og:description, og:image.
- Gated by `hiring.discovery.behance_enabled` kill switch.

**Generic web handler** (`fetchOgSignal`):
- Used for personal sites, Dribbble, Are.na, YouTube, LinkedIn, TikTok, and unknown URLs.
- Fetches page HTML, parses OG tags via cheerio.
- Extracts: og:title, og:description, og:image (+ fallback to `<title>` and `meta[name=description]`).
- 10s timeout, 500KB body cap, User-Agent header.

**Vision LLM analysis** (`analyzePortfolioVision`):
- Called after platform fetch when thumbnails are found.
- Sends up to 4 thumbnail URLs to `hiring-portfolio-ingest-vision` (Sonnet vision).
- Prompt asks for 5–15 lowercase hyphenated style tags in JSON array format.
- Strips markdown fences, validates JSON, caps at 20 tags.
- Boosts confidence by 0.15 when tags are extracted (capped at 0.85).
- Graceful fallback on LLM failure or non-JSON response (returns empty tags).

**`ingestPortfolioUrl()` routing:**
- `vimeo` → Vimeo oEmbed → vision
- `behance` → Behance OG → vision
- All others → generic OG → vision
- Vision only runs when thumbnails were found by the platform handler.

**External call logging:**
- Every external call (Vimeo API, Behance fetch, generic fetch, vision LLM) logs to `external_call_log` via best-effort insert.
- Job names match spec §15: `hiring-portfolio-ingest-vimeo`, `hiring-portfolio-ingest-behance`, `hiring-portfolio-ingest-generic`, `hiring-portfolio-ingest-vision`.
- Logs duration_ms + platform-specific units.

**Confidence tiers:**
- Kill switch off: 0.2
- Fetch failed: 0.3
- OG metadata found (no thumbnail): 0.4
- OG metadata + thumbnail: 0.6
- Vimeo oEmbed success: 0.7
- Any handler + successful vision tags: +0.15 (max 0.85)

## New files

- `tests/hp5-portfolio-ingestion.test.ts` (25 tests)

## Edited files

- `lib/ai/invoke.ts` — added `invokeLlmVision()` + `InvokeLlmVisionOptions` type
- `lib/hiring/portfolio.ts` — full rewrite: platform handlers, vision analysis, external call logging, settings integration

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 240 files, 2196 passed, 1 skipped (pre-existing)
- Browser check: not applicable (API calls require live endpoints + LLM keys; validated via typecheck + 25 new tests)

## Key decisions

- **Vimeo oEmbed over authenticated API** — oEmbed is free, requires no API key, and returns everything we need (title, description, thumbnail, author). The authenticated API would give more metadata (views, likes, tags) but requires token management for zero benefit at v1 scale.
- **Behance uses OG scraping, not public JSON** — Behance's public API has been deprecated/unreliable. OG metadata from the page HTML is stable and provides title, description, and thumbnail.
- **Vision runs on thumbnails, not full pages** — sending full page screenshots would need Puppeteer. Thumbnail URLs are already extracted by the platform handler and give the vision model enough to identify style.
- **`detectPlatform` exported** — was private; now exported for test coverage and potential reuse by discovery sources (HP-6+).
- **Instagram not yet handled** — spec says IG uses Apify (paid service) with graceful fallback. That's HP-6 scope, along with the discovery agent. IG URLs currently fall through to the generic OG handler.

## Rollback

- Git-revertable: `invoke.ts` change is additive (new function, no existing function modified). `portfolio.ts` rewrite replaces the stub but maintains the same export surface (`PortfolioSignal`, `WorkSample`, `detectPlatform`, `ingestPortfolioUrl`). Test file is additive.

## Settings keys consumed

- `hiring.discovery.vimeo_enabled` — kill switch for Vimeo oEmbed calls
- `hiring.discovery.behance_enabled` — kill switch for Behance page fetch

## Next session should know

- HP-6 (discovery agent) should add IG ingestion via Apify with graceful fallback (spec §5.1 "On-demand Instagram ingestion"). The `ingestPortfolioUrl` routing already handles `instagram` platform detection — just needs a handler function.
- The vision prompt may benefit from calibration in a content mini-session. Current prompt is functional but not voice-tuned.
- `invokeLlmVision()` is now available for any future consumer (e.g. trial task delivery review, content analysis).
- Scoring and invite draft quality should noticeably improve now that `PortfolioSignal` contains real thumbnails, bios, work samples, and extracted tags instead of empty stubs.
