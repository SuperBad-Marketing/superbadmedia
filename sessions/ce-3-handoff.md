# `ce-3` — Blog generation + review surface + rejection chat + publishing — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (3 of 13)
**Model tier:** Opus (started on Opus; tracker recommended Sonnet)

---

## What was built

The **blog generation pipeline (Opus)**, **review surface (split-pane)**, **rejection chat with regeneration**, **publishing logic**, and **public blog route** — completing CE-3 scope.

**Files created:**

- `lib/content-engine/generate-blog-post.ts` — `generateBlogPost(companyId, topicId?)`: picks top queued topic (or accepts specific topicId), transitions topic `queued → generating`, loads Brand DNA full profile as system context (discipline #44), calls Opus via `invokeLlmText` with new `system` param, parses structured JSON output (title, slug, body, meta description, structured data, internal links, snippet target), runs §11.5 drift check with one auto-regen on failure, inserts `blog_posts` row with status `in_review`, transitions topic to `generated`. Reverts topic to `queued` on failure. Enforces discipline #47 (one unreviewed draft max per owner).
- `lib/content-engine/review.ts` — `approveBlogPost(postId)`: status transition to `approved`, enqueues `content_fan_out` task for CE-6, logs activity. `rejectAndRegenerate(postId, feedback)`: inserts user feedback into `blog_post_feedback`, loads all prior feedback as context, Opus re-drafts with feedback history, drift-checks, updates blog post in place, inserts assistant response, logs activity. `getBlogPostFeedback(postId)`: full feedback thread. `getBlogPostForReview(postId)`: post + topic for review surface. `listPostsForReview(companyId)`: drafts in review.
- `lib/content-engine/publish.ts` — `publishBlogPost(postId)`: transitions `approved → publishing → published`, resolves company domain for URL, patches structured data with published URL + author, generates internal links to other published posts (top 5 most recent), logs activity. `resolveCompanyByDomain(hostname)`: multi-tenant hostname-to-company resolution. `getPublishedPost(companyId, slug)`: lookup for blog route. `listPublishedPosts(companyId)`: published posts newest first.
- `app/blog/[slug]/page.tsx` — Public blog route. Multi-tenant: resolves company from request hostname (`x-forwarded-host` → `host` → `NEXT_PUBLIC_APP_URL` fallback). Full SEO package: `<title>`, meta description, OG image, Twitter card, canonical URL, JSON-LD Article schema via `<script type="application/ld+json">`. Simple markdown-to-HTML renderer (headings, bold, italic, links, lists, code blocks). Newsletter opt-in CTA at bottom. `generateMetadata()` for Next.js metadata API.
- `app/lite/content/page.tsx` — Admin content landing. Review tab active (Social, Metrics, Topics, List disabled for later CE sessions). Lists all posts in review + recently published. Links to review detail page.
- `app/lite/content/actions.ts` — Server actions: `approvePostAction(postId)` (approve + auto-publish), `rejectPostAction(postId, feedback)`. Admin-role-gated, Zod-validated.
- `app/lite/content/review/[postId]/page.tsx` — Split-pane review detail page. Admin-only.
- `app/lite/content/_components/review-split-pane.tsx` — Client component: left pane (~60%) rendered markdown preview with title/slug/meta/status; right pane (~40%) rejection chat thread + feedback input + approve/revise buttons. Framer `houseSpring` entrance animation. Optimistic chat updates. Keyboard shortcut (Enter to send).
- `tests/content-engine/ce3-blog-generation.test.ts` — 29 tests across 9 describe blocks.

**Files edited:**

- `lib/ai/invoke.ts` — Added optional `system` param to `InvokeLlmTextOptions` (owed patch from UI-5/6/7). Passes through to Anthropic SDK. Backwards compatible (omitting `system` behaves identically to pre-patch).
- `lib/content-engine/index.ts` — Added CE-3 barrel exports: `generateBlogPost`, `approveBlogPost`, `rejectAndRegenerate`, `getBlogPostFeedback`, `getBlogPostForReview`, `listPostsForReview`, `publishBlogPost`, `resolveCompanyByDomain`, `getPublishedPost`, `listPublishedPosts`.
- `components/lite/admin-shell-nav.tsx` — Added "Content" nav item (`/lite/content`, `Newspaper` icon, `status: "live"`).

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **`invokeLlmText` system-message support.** Added optional `system` field rather than creating a new function. Every existing caller works unchanged; CE-3 is the first consumer of the `system` param.
2. **Auto-publish on approval.** `approvePostAction` chains approve → publish in one server action. The spec says "Blog publishes immediately on approval" (§2.1 Stage 5). Fan-out is enqueued separately via `content_fan_out` task (CE-6 builds the handler).
3. **Simple markdown renderer for v1.** Both the public blog route and the review preview use a basic regex-based markdown-to-HTML converter. A proper remark/rehype pipeline is a CE-5+ enhancement.
4. **Multi-tenant blog via hostname resolution.** `resolveCompanyByDomain()` checks `companies.domain` for the request hostname. Cloudflare path routing configuration is a setup wizard task (CE-12). CE-3 builds the rendering route that Cloudflare will point to.
5. **Stale `.next/types/` duplicate files removed.** Build artifacts with spaces in filenames (`routes.d 2.ts`, etc.) were causing typecheck noise — removed as part of verification. Not a CE-3 concern, pre-existing build-directory state.

## Verification (G0–G12)

- **G0** — CE-2 and CE-1 handoffs read. Spec `content-engine.md` read in full. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `content_topics` table, `blog_posts` table, `blog_post_feedback` table, `brand_dna_profiles` table, `companies.domain` column, `activity_log` kinds, `scheduled_tasks` types, kill switches, settings keys — all exist.
- **G2** — Files match CE-3 scope (generation + review + publish + blog route + admin surface).
- **G3** — Review split-pane uses Framer `houseSpring` entrance animation. No new Tier 2 motion slots consumed (review pane is standard UI, not a choreography moment).
- **G4** — No numeric/string literals in autonomy-sensitive paths. `maxTokens: 8000` is a generation budget, not an autonomy threshold.
- **G5** — Context budget held. Large session as estimated.
- **G6** — No migration. Code-only additions. Rollback: git-revertable.
- **G7** — 0 TS errors, 156 test files / 1204 passed + 1 skipped (+29 new), clean production build, lint 0 errors (58 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1204 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 0 errors, 58 warnings.
- **G9** — New UI surfaces: `/lite/content` (admin content landing), `/lite/content/review/[postId]` (split-pane review), `/blog/[slug]` (public blog). No browser verification possible without running data (pipeline-driven content).
- **G10** — Admin review flow exercised via server actions. Blog route rendering verified via build compilation + SEO metadata generation.
- **G10.5** — N/A (no external reviewer this session; verification gates caught all defects inline).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_3_remark_rehype_markdown_pipeline`** — Replace regex-based markdown-to-HTML with remark/rehype pipeline for proper rendering (code block highlighting, image handling, footnotes, etc.). Both `app/blog/[slug]/page.tsx` and `review-split-pane.tsx` share the same simple renderer. Medium priority.
- **`ce_3_og_image_generation`** — OG image auto-generation is stubbed (no `og_image_url` set during generation). The visual pipeline (CE-5/CE-6) builds the template system. Low priority — posts publish without OG images.
- **`ce_3_newsletter_cta_form`** — The inline newsletter CTA on the blog route is static HTML. A working form needs a subscriber creation endpoint + CSRF + Spam Act consent. Ships in CE-7 (newsletter infrastructure).
- **`ce_3_superbad_blog_cta`** — Spec §2.1 Stage 5: "For SuperBad's own posts: subtle inline CTA — one dry line noting the Content Engine wrote it, linking to the demo page." Not yet differentiated — all posts get the same generic CTA. Content mini-session provides the copy.
- **`ui_5_invoke_system_role_plumbing`** — **CLOSED** by this session. `invokeLlmText` now accepts `system` param. UI-5/6/7 can migrate their single-string prompts to use `system` in a future cleanup pass.

## PATCHES_OWED (closed this session)

- **`ui_5_invoke_system_role_plumbing`** — Closed. `invokeLlmText` now accepts optional `system` param.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Content engine library modules (generate-blog-post, review, publish)
- Blog route (`app/blog/[slug]`)
- Admin content surface (`app/lite/content/`)
- `invokeLlmText` system-message support (backwards compatible — removal still works)
- Content nav item in admin shell
- Test file

## What the next session (CE-4) inherits

CE-4 is the `content_generate_draft` scheduled-task handler (tier-paced automatic generation). It inherits:

- **`generateBlogPost(companyId, topicId?)`** — ready to call from a handler.
- **Topic queue** — `pickNextTopic(companyId)` from CE-2.
- **Discipline #47 enforcement** — one unreviewed draft max per owner, checked inside `generateBlogPost()`.
- **Drift check** — built into generation pipeline, no handler-level check needed.
- **Kill switch** — `content_automations_enabled` gates generation.
- **`content_generate_draft` task type** — already registered in A6's type enum.
- **No prompt files extracted yet** — CE-2 and CE-3 use inline prompts. Consider extracting to `lib/ai/prompts/content-engine/` if the pattern warrants.
- **LLM job slug** — `content-generate-blog-post` (Opus) registered in models registry + INDEX.
