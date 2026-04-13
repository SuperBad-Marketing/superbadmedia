---
spec: docs/specs/content-engine.md
status: stub
populated-by: Content Engine content mini-session
---

# Content Engine prompts (10)

## `content-score-keyword-rankability`
**Tier:** Haiku. **Intent:** domain-authority heuristic scoring + content-gap identification from scraped top-3 SERP results. **Current inline location:** spec §12.

## `content-generate-topic-outline`
**Tier:** Haiku. **Intent:** structured outline from keyword + gaps + Brand DNA tags. **Current inline location:** spec §12.

## `content-generate-blog-post`
**Tier:** Opus. **Intent:** full blog post from outline + Brand DNA full profile + SERP data + content gaps. **Current inline location:** spec §12.

## `content-rewrite-for-newsletter`
**Tier:** Haiku. **Intent:** blog → newsletter format (standalone or digest, selected by post count). **Current inline location:** spec §12.

## `content-generate-social-draft`
**Tier:** Haiku. **Intent:** blog → platform-specific social text + format decision + visual brief. **Current inline location:** spec §12.

## `content-select-visual-template`
**Tier:** Haiku. **Intent:** pick template + fill content for HTML→image rendering, or decide AI generation is needed. **Current inline location:** spec §12.

## `content-generate-image-prompt`
**Tier:** Haiku. **Intent:** blog content + Brand DNA visual signals → OpenAI Images API prompt. **Current inline location:** spec §12.

## `content-match-content-to-prospects`
**Tier:** Haiku. **Intent:** score published post × Lead Gen candidate pool for relevance. **Current inline location:** spec §12.

## `content-draft-outreach-email`
**Tier:** Opus. **Intent:** content-forward outreach email per matched prospect. **Current inline location:** spec §12.

## `content-generate-embed-form-styles`
**Tier:** Haiku. **Intent:** Brand DNA visual tokens → CSS for embeddable opt-in form. **Current inline location:** spec §12.
