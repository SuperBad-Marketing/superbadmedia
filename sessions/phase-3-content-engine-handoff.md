# Phase 3 — Content Engine — Handoff Note

**Date:** 2026-04-13
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/content-engine.md`
**Status:** Locked, 26 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for the Content Engine — SuperBad's semi-autonomous SEO content engine, dual-use from day one (internal tool + SaaS product). 26 questions asked, all locked. This is the first product to ship on the SaaS billing infrastructure and the largest product spec in the project (7 build sessions estimated).

Three mid-brainstorm redirects from Andy:

1. **Q11 — Visual generation.** I proposed image generation as a v1.1 enhancement with text-only social drafts in v1. Andy pushed back: "image/video generation should happen in-app from the start. If it doesn't it would feel like a let down." Led to the template-first + AI image + Remotion architecture — three rendering systems, significantly more scope, but Andy correctly identified that text-only social output would undermine the "done while you sleep" promise.

2. **Q3 — Pricing dimensions.** Andy flagged two points of friction: (a) whether subscribers need their own Resend account (answer: no, SuperBad absorbs costs), and (b) whether sliders/custom packages could replace fixed tiers. I pushed back on sliders — conflicts with the locked "curated customisation, never sliders" memory and the fixed-tier billing infrastructure. Andy accepted the pushback. Also contributed the framing: "1 keyword-researched post per week, sent to up to 500 people, done while you sleep" — tier descriptions as outcomes, not metrics.

3. **Q15 — Demo landing page.** I proposed showing the prospect's content in a best-guess voice. Andy identified the flaw: prospects haven't completed Brand DNA, so the voice would be mediocre. His redirect: run the full pipeline in SuperBad's own voice, reframe as a branding opportunity ("this is us talking about YOUR area of expertise — imagine what could happen if our tool knew who you were"). Brand DNA becomes the unlock, not the hurdle.

4. **Q20 — Content-to-outreach matching.** Andy added unprompted: published blog posts should match to relevant prospects and become the outreach email itself — "hey, we wrote this post on why telling people you have the worst coffee in Melbourne is the best way to get new customers this week." This led to the full content-to-outreach integration (§6 of the spec).

---

## 2. Key decisions summary

### Product shape
- **Dual-use from day one.** Same pipeline serves SuperBad and subscribers. Multi-tenant by `company_id`.
- **Hands-off default, steering available.** Engine runs autonomously. Optional Topic Strategy panel for engaged subscribers.
- **Two usage dimensions:** published posts/mo + newsletter subscriber cap. Framed as outcomes.
- **Three popcorn tiers:** Small (4 posts, 500 subs), Medium (10 posts, 2,500 subs), Large (20 posts, 10,000 subs).
- **Feature flags:** GSC at medium+, video at large, everything else open.

### Pipeline
- **Six stages:** Research → Topic Queue → Generation → Review → Publish → Fan-out.
- **Visible passive topic queue** with Haiku-generated outlines. Subscriber can veto, not reorder.
- **Two-pass generation:** Haiku outline → Opus draft. Brand DNA as perpetual context.
- **Split-pane review** with rejection chat. Read-only preview — all changes via chat.
- **Blog publishes immediately** on approval. Fan-out (newsletter + social + visuals) runs in background via `scheduled_tasks`.
- **Continuous tier-paced throttle.** Engine won't generate new draft until current one is reviewed.

### Visual generation (biggest scope addition)
- **Template-first:** HTML/CSS templates + Puppeteer → image. Brand DNA visual tokens.
- **AI image fallback:** OpenAI Images API when no template fits. Quality-gated.
- **Remotion video:** Large tier only. Animated text, kinetic typography, motion graphics.
- **Claude decides format** per platform per post (single/carousel/video).

### Newsletter
- **SuperBad absorbs Resend costs.** Subscribers never touch Resend.
- **Domain verification via setup wizard.** Combined blog hosting + newsletter sending DNS.
- **Three list-growth channels:** CSV import (permission pass), embeddable form, inline blog CTA.
- **Hybrid format:** single post → standalone, multiple → digest. One email per send window max.
- **Automated aggressive list hygiene.** Full CSV export including removed contacts.

### Content-to-outreach integration (SuperBad only)
- Published posts matched to Lead Gen prospects via Haiku relevance scoring.
- Content-forward outreach emails in Lead Gen approval queue with earned autonomy.
- Outreach replies auto-enrol into newsletter.

### Subscriber experience
- **Chat-first portal.** Bartender is primary interface. Menu items: Review, Social, Metrics, Topics, List.
- **Three onboarding wizard steps:** domain → topics → newsletter.
- **Demo:** vertical + location input, full pipeline in SuperBad's voice.

---

## 3. No new memories

No new principles surfaced. The spec applied existing memories extensively:
- `feedback_no_content_authoring` — engine does all the work
- `project_brand_dna_as_perpetual_context` — Brand DNA shapes all generation
- `project_two_perpetual_contexts` — both Brand DNA and Client Context feed prompts
- `feedback_pre_populated_trial_experience` — demo result persists to account
- `feedback_curated_customisation` — fixed tiers, not sliders (Andy's slider proposal, pushback accepted)
- `feedback_individual_feel` — each subscriber's portal feels like their own
- `feedback_setup_is_hand_held` — domain verification via wizard
- `project_outreach_strategy_observation_first` — content-forward outreach leads with value
- `feedback_no_lite_on_client_facing` — subscriber surfaces say "SuperBad"

---

## 4. Sprinkle bank updates

- **System email subject lines** (§2) — CLAIMED by content-engine. Newsletter notifications, draft-ready, list milestones.
- **OG images auto-generated per page** (§6) — CLAIMED by content-engine. Every published blog post gets a branded OG card.

---

## 5. Cross-spec flags (consolidated)

### 5.1 Lead Generation (LOCKED)
- Content-match emails in approval queue with `source: 'content_match'` tag
- Content-match emails participate in earned autonomy per track
- Outreach reply handler auto-enrols into newsletter (`consent_source: 'outreach_reply'`)
- Shared SerpAPI integration — same API key, separate query budgets

### 5.2 Sales Pipeline (LOCKED)
- SaaS subscription creates Deal at Won. Standard pattern.

### 5.3 Brand DNA Assessment (LOCKED)
- Perpetual context for all generation (tiered injection)
- Demo uses SuperBad's own Brand DNA for voice
- Seed keywords auto-derived from Brand DNA signals

### 5.4 Client Management (LOCKED)
- Portal integration: chat-first, bartender gains Content Engine actions
- Menu gains: Review, Social, Metrics, Topics, List

### 5.5 SaaS Subscription Billing (LOCKED)
- `productConfig` interface implemented
- Two usage dimensions, three feature flags
- Usage tracking via `recordUsage()` / `checkUsageLimit()`

### 5.6 Onboarding + Segmentation (LOCKED)
- `firstRunView`: three-step onboarding wizard (domain → topics → newsletter)

### 5.7 Surprise & Delight (PRE-WRITTEN)
- Sprinkle claims: system email subjects + OG images
- Hidden egg suppression on review pane
- Standard suppression on wizards and payment flows

### 5.8 Daily Cockpit (#12)
- Andy's own: unreviewed drafts, next newsletter, ranking milestones
- Fleet: drafts waiting >48h, domain failures, list health

### 5.9 Unified Inbox (#11)
- Content-match outreach threads via standard email headers
- Newsletter subscriber replies route to inbox

### 5.10 Client Context Engine (LOCKED)
- Subscriber engagement signals (review frequency, list growth, approval rate)

### 5.11 Foundations
- §11.1–§11.5 all apply. Newsletter = transactional classification. Content-match outreach = outreach classification.

---

## 6. New data

### 6.1 New tables: 8
- `content_topics` — keyword research results + outlines + status
- `blog_posts` — generated posts with full SEO elements
- `blog_post_feedback` — rejection chat threads
- `social_drafts` — per-platform drafts with visual assets
- `newsletter_subscribers` — per-owner subscriber lists
- `newsletter_sends` — scheduled/sent newsletters
- `ranking_snapshots` — weekly position tracking (SerpAPI + GSC)
- `content_engine_config` — per-owner settings (seed keywords, send window, GSC token, embed form token)

### 6.2 No new columns on existing tables
Content Engine is self-contained — reads from companies, contacts, brand_dna_profiles, lead_candidates but adds nothing to them.

### 6.3 `activity_log.kind` gains ~15 values
See spec §11.3.

### 6.4 `scheduled_tasks.task_type` gains 6 values
`content_keyword_research`, `content_generate_draft`, `content_fan_out`, `content_newsletter_send`, `content_ranking_snapshot`, `content_outreach_match`

---

## 7. New integrations (3)

- **OpenAI Images API** — AI-generated visual assets. Setup wizard: API key.
- **Remotion** — Video generation (large tier). npm dependency + Remotion Lambda for production.
- **Google Search Console API** — Ranking data (optional, medium+ tier). Setup wizard: OAuth.

---

## 8. Claude prompts (10)

2 Opus: `generate-blog-post.ts`, `draft-content-outreach.ts`
8 Haiku: `score-keyword-rankability.ts`, `generate-topic-outline.ts`, `rewrite-for-newsletter.ts`, `generate-social-draft.ts`, `select-visual-template.ts`, `generate-image-prompt.ts`, `match-content-to-prospects.ts`, `generate-embed-form-styles.ts`

---

## 9. Build-time disciplines (8 new: 43–50)

Key ones: multi-tenant isolation non-negotiable, Brand DNA as system context never user context, template library version-controlled, AI image quality gate, one unreviewed draft max, content-match outreach SuperBad-only, newsletter batch integrity, embeddable form token rotation.

---

## 10. Content mini-session scope

**Large.** Dedicated creative session. Produces: ~10–15 social visual HTML/CSS templates, newsletter email template (2 variants), demo page copy, blog CTAs, embeddable form design, system email subject voice, OG image templates, empty/loading state copy, fleet overview labels, notification copy, Remotion art direction. Must run before Phase 5 sessions B + C + D.

---

## 11. Phase 5 sizing

7 sessions:
- **A:** Data model + keyword research + rankability + topic queue (large)
- **B:** Blog generation + review + rejection chat + publishing (large, depends on A)
- **C:** Visual generation — templates + Puppeteer + OpenAI Images + Remotion (large, parallels D after B)
- **D:** Newsletter — list management + import + form + sends + hygiene (medium-large, parallels C after B)
- **E:** Social drafts — adapters + format selection + carousel + publish flow (medium, depends on C)
- **F:** SaaS integration — productConfig + portal + onboarding + demo + billing (medium-large, after A + SaaS infra)
- **G:** Outreach integration + ranking feedback + fleet overview (medium, after A + B)

---

## 12. What the next session should know

### 12.1 Next recommended spec: Unified Inbox (#11)

Centralised comms surface. Defines the `messages` table that Client Context Engine reads from. Multiple locked specs reference it: Client Context Engine (abstract schema), Client Management (portal chat escalation), Task Manager (rejection feedback), Lead Gen (outreach email threading), Content Engine (subscriber replies). This is the last major data-schema-defining spec — locking it before Daily Cockpit (#12) ensures the cockpit has all its data sources concretely defined.

### 12.2 Things easily missed

- **Three rendering systems for visuals.** Puppeteer (templates → image), OpenAI Images API (AI fallback), Remotion (video). Each has its own error handling, storage path (R2), and quality gating. The visual pipeline (Session C) is the riskiest build surface.
- **Multi-tenant isolation is the #1 build risk.** Every query scopes by `company_id`. SuperBad's own content uses SuperBad's company record. Cross-tenant leakage would be catastrophic.
- **Content-to-outreach matching is SuperBad-only.** Subscriber content never matches against SuperBad's prospects or other subscribers' data. The matching pipeline reads from Lead Gen's candidate pool, which is SuperBad's internal data.
- **The newsletter subscriber cap is a running total, not a reset.** Unlike posts/month, the subscriber count doesn't reset each billing cycle. It's a ceiling. Upgrade prompt when they approach the cap.
- **Resend costs at scale need pricing validation.** A large-tier subscriber with 10,000 newsletter subscribers and 20 posts/month could mean significant email volume. Tier pricing needs to cover this with margin. Flag for Phase 4 financial modelling.
- **The demo uses SuperBad's voice, not a guess at the prospect's.** Andy's explicit redirect. Brand DNA is the unlock, not a hurdle.
- **Embeddable form tokens are per-owner and must rotate on request.** Stale tokens return a clean error. Security boundary.

---

## 13. Backlog state

**Phase 3 spec backlog: 17 total, 13 locked, 4 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, Onboarding + Segmentation, Client Context Engine, Client Management, SaaS Subscription Billing, **Content Engine** (this session).

Remaining: Unified Inbox (#11), Daily Cockpit (#12), Setup Wizards (#13), Hiring Pipeline (#14), Finance Dashboard (#17).

Next recommended: Unified Inbox (#11).

---

**End of handoff.**
