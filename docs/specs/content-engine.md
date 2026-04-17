# Content Engine — Feature Spec

**Phase 3 output. Locked 2026-04-13. 26 questions resolved.**

> **Prompt files:** `lib/ai/prompts/content-engine.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

SuperBad's semi-autonomous SEO content engine — dual-use from day one. Powers SuperBad's own blog, newsletter, and social channels, and is sold as a SaaS product to subscribers. The first product to ship on the SaaS billing infrastructure defined in `docs/specs/saas-subscription-billing.md`.

The differentiator: content that sounds like the subscriber because it reads their Brand DNA profile as perpetual context. Every blog post, newsletter, social draft, and outreach email is voice-matched — not templated, not generic, not "AI content." The engine does the work while the subscriber sleeps.

---

## 1. Locked decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Product identity | Dual-use from day one — internal tool for SuperBad's own content AND a SaaS product sold to subscribers. Same pipeline serves both. |
| Q2 | Subscriber involvement | Hands-off default, steering available. Engine runs autonomously using Brand DNA + business context. Optional Topic Strategy panel for engaged subscribers. Popcorn tiers gate volume, not involvement. |
| Q3 | Usage dimensions | Two: published posts per month + newsletter subscriber cap. Framed as outcomes — "1 keyword-researched post per week, sent to up to 500 people, done while you sleep." |
| Q4 | Pipeline architecture | Research → visible passive topic queue (with outline) → generation → review → publish → fan-out. Topic queue is engine-managed; subscriber can see and veto, not reorder or add. |
| Q5 | Rankability scoring | Domain authority heuristic (static high-authority domain list + SerpAPI data) + content gap analysis (fetch + cheerio on top 3 results + Haiku Claude call). No new integrations beyond what Lead Gen already uses. |
| Q6 | Blog generation | Two-pass: Haiku outline → Opus draft. Outline visible in topic queue for informed vetoing. Brand DNA as perpetual context (tags-only for Haiku, full profile for Opus). |
| Q7 | Review gate | Split-pane: rendered preview left (~60%), rejection chat right (~40%). Read-only content — all changes via chat feedback. Persistent iteration history. Approve triggers automatic fan-out. |
| Q8 | Fan-out mechanics | Background via `scheduled_tasks`. Blog publishes immediately on approval. Newsletter + social drafts generate in background. Newsletter holds for scheduled send window (configurable cadence). Multiple approved posts batch into next send. |
| Q9 | Blog hosting | Lite hosts blogs on the subscriber's own domain via Cloudflare path routing. Setup wizard guides DNS configuration. Combined with newsletter domain verification — one wizard, both jobs. SuperBad's own blog at `superbadmedia.com.au/blog/*` uses the same mechanism. |
| Q10 | Newsletter list growth | Three channels: CSV import (mandatory permission pass), embeddable opt-in form (Brand DNA-styled), inline blog CTA on Lite-hosted posts. Direct opt-ins (form + CTA) skip permission pass. Full Spam Act compliance on every send. |
| Q11 | Social draft publishing | Stub channel adapters with Publish button per platform (Instagram, LinkedIn, X, Facebook). Opens native compose screen in v1. Swappable for real API calls later with zero UI change. |
| Q11b | Visual generation | Template-first: branded HTML/CSS templates rendered via Puppeteer, pulling Brand DNA visual identity. AI image fallback via OpenAI Images API when no template fits. Remotion for video (animated text, kinetic typography, motion graphics) on select posts. Claude decides format per platform per post. |
| Q12 | Pipeline cadence | Continuous with tier-paced throttle. Engine paces itself to spread posts evenly across the month. Won't generate a new draft until the current one is reviewed. Research replenishment weekly via `scheduled_tasks`. |
| Q13 | Subscriber dashboard | Same chat-first portal as retainer clients. Bartender is the primary interface. Menu items: Review, Social, Metrics, Topics, List. Notification bell / subtle sticky header for new drafts. Quick actions via bartender conversation. |
| Q14 | Ranking feedback | SerpAPI re-queries as default (zero setup). Google Search Console as optional OAuth integration via setup wizard. Engine gracefully degrades without GSC. Feature flag candidate for tier gating. |
| Q15 | Demo landing page | Two-input demo: vertical + location-locked. Full pipeline output in SuperBad's own voice. Pitch: "this is us talking about YOUR area of expertise — imagine what could happen if our tool knew who you were." Demo result persists to account on signup. |
| Q16 | Admin surface | Dedicated module at `/lite/content` with five tabs: Review, Social, Metrics, Topics, List. Separate `/lite/content/subscribers` fleet overview for subscriber engine health. |
| Q17 | Subscriber onboarding | Three wizard steps after Brand DNA: domain verification (required, includes optional GSC OAuth) → seed keyword review (auto-derived, subscriber approves/tweaks) → newsletter preferences (send window + optional list import). Engine starts research after step 2. |
| Q18 | productConfig | menuItems, usageDimensions, featureFlags, firstRunView, demoConfig, bartenderActions all defined. GSC at medium+ tier, video generation at large tier, everything else open. |
| Q19 | List hygiene | Automated and aggressive. Hard bounces remove immediately, soft bounces 3x then remove, unsubscribes permanent, 90-day inactive removed. Visible to subscriber (read-only). Full CSV export including removed contacts with status column. No override. |
| Q20 | Outreach integration | Outreach replies auto-enrol into SuperBad's newsletter (consent_source: 'outreach_reply'). Content-to-outreach matching: published posts matched to relevant prospects, content-forward email generated. |
| Q21 | Content-match outreach | Content-match emails land in Lead Gen approval queue tagged as "content match." Participate in earned autonomy — same graduation, probation, circuit-breaker discipline. |
| Q22 | Blog SEO | Standard package on every post: title tag, meta description, OG image, JSON-LD Article schema, canonical URL, internal linking, ToC. Featured snippet targeting where content gap analysis identifies opportunity. |
| Q23 | Newsletter format | Hybrid: single post gets full standalone rewrite, multiple posts get Claude-drafted editorial digest. One email per send window maximum. Haiku-tier rewrite. |
| Q24 | Social format | Platform-appropriate — Claude decides single image or carousel per platform per post. Template library supports both single and multi-slide templates. |
| Q25 | Voice & delight | Sprinkles claimed: system email subject lines + OG images. Empty states via `generateInVoice()`. Hidden egg suppression on review pane. |
| Q26 | SuperBad blog CTA | Subtle inline CTA on every SuperBad blog post: one dry line noting the Content Engine wrote it, linking to demo page. The blog is the product demo in action. |

### 1.1 Setup wizard shell reference (added 2026-04-13 Phase 3.5)

The Content Engine onboarding three-step flow (segment verified → keyword brief initial run → domain-connect stage reached) renders through the `WizardDefinition` primitive owned by [setup-wizards.md](./setup-wizards.md) §5.3. Wizard key: **`content-engine-onboarding`**. Render mode: **slideover**. This spec owns the step content and completion payload; the shell (progress bar, resume, cancel, celebration, Observatory integration) lives in the primitive. Phase 5 build sessions for onboarding render steps inside `<WizardShell>`, never re-implement the chrome.

---

## 2. Pipeline architecture

### 2.1 The six stages

```
Research → Topic Queue → Generation → Review → Publish → Fan-out
```

**Stage 1 — Research.** Weekly `scheduled_tasks` job per owner. SerpAPI keyword research from seed keywords (auto-derived from Brand DNA signals + vertical + location for subscribers, from `superbad-business-context` for SuperBad). Each candidate keyword is:
1. Rankability-scored against the top 10 SERP results using a domain authority heuristic (static high-authority domain list, ~500 entries, maintained as `/data/high-authority-domains.json`).
2. Content-gap-analysed: fetch + cheerio on top 3 ranking pages, Haiku Claude call identifies underserved angles.
3. Scored and ranked. Top candidates (enough to fill the next generation cycle) enter the topic queue.

**Stage 2 — Topic Queue.** Visible passive queue. Each topic shows: keyword, rankability score, content gap summary, and a Haiku-generated outline (sections, key points, target word count, featured snippet opportunity flag). Subscriber can see the queue and veto topics (one-click thumbs-down). Engine manages ordering and selection. The optional Topic Strategy panel lets engaged subscribers add seed keywords that influence future research — upstream influence, not queue manipulation.

**Stage 3 — Generation.** Engine picks the top un-vetoed topic from the queue. Two-pass:
1. Haiku outline (already generated in Stage 2 and visible in queue).
2. Opus draft: full blog post from outline + Brand DNA full profile + SERP data + content gap analysis. Outputs: title, body (markdown), meta description, suggested slug, structured data (JSON-LD Article), internal linking suggestions, featured snippet target section (where applicable). **AI search citation tuning:** generation prompt must instruct the model to lead each post (and each major section) with a direct, factual answer to the target question before expanding — "X is Y because Z" structure in the opening paragraph. This pattern maximises citation by AI search engines (Perplexity, ChatGPT search, Google AI Overviews) which extract concise answer fragments.

The engine won't generate a new draft until the current one is reviewed (approved or rejected). This is the throttle that prevents unreviewed drafts piling up.

**Stage 4 — Review.** Split-pane surface. Left (~60%): rendered blog post preview (title, body, meta, slug, OG image preview). Right (~40%): rejection chat. Subscriber reads the preview, then either:
- **Approves** → post moves to Publish.
- **Rejects via chat** → types specific feedback ("too corporate, pull it back"), Claude regenerates using original prompt + feedback as added context. Updated draft replaces the original. Chat thread persists for iteration history. Same rejection-chat primitive as setup wizards and Client Context Engine.

All generated content passes the §11.5 brand-voice drift check before entering the review queue. Drafts below the drift threshold are auto-regenerated once; a second failure surfaces a "voice drift flagged" warning.

**Stage 5 — Publish.** Blog publishes immediately on approval:
- HTML page rendered at `[subscriber-domain]/blog/[slug]` (or `superbadmedia.com.au/blog/[slug]` for SuperBad's own content).
- SEO elements: title tag, meta description, OG image (auto-generated via template system), JSON-LD Article schema, canonical URL, table of contents for longer posts.
- Internal links to other published posts on the same domain.
- Inline newsletter opt-in CTA at the bottom.
- For SuperBad's own posts: subtle inline CTA — one dry line noting the Content Engine wrote it, linking to the demo page.

**Stage 6 — Fan-out.** Background via `scheduled_tasks`:
1. **Newsletter rewrite** — Haiku call rewrites approved post(s) for email format. Hybrid logic: single post → standalone newsletter, multiple posts since last send → editorial digest with brief intro. Holds for the next scheduled send window.
2. **Social drafts** — one Haiku call per platform (Instagram, LinkedIn, X, Facebook). Claude decides format (single image or carousel) based on content. Each draft includes: platform-specific text, visual asset (template-rendered or AI-generated), and format metadata.
3. **Visual asset generation** — per social draft:
   - Claude selects template or decides AI-generation is needed.
   - **Template path:** HTML/CSS template populated with content + Brand DNA visual tokens → Puppeteer renders to image. Multi-slide for carousels.
   - **AI image path:** Haiku generates image prompt from content + Brand DNA visual signals → OpenAI Images API → stored in Cloudflare R2.
   - **Video path (large tier only):** Remotion renders animated text / kinetic typography / parallax from template + content. Output stored in R2.
4. **Content-to-outreach matching** (SuperBad's own content only) — Haiku call scores published post against Lead Gen candidate pool. High-relevance matches get a Claude-drafted content-forward outreach email queued in the Lead Gen approval queue, tagged "content match." Participates in earned autonomy.

### 2.2 Scheduling summary

| Job | Schedule | Worker |
|-----|----------|--------|
| Keyword research | Weekly per owner | `scheduled_tasks` → `content_keyword_research` |
| Draft generation | Continuous, tier-paced, gated by review | `scheduled_tasks` → `content_generate_draft` |
| Fan-out (newsletter + social + visuals) | On approval | `scheduled_tasks` → `content_fan_out` |
| Newsletter send | Configurable window per owner (default: Tuesday 10am local) | `scheduled_tasks` → `content_newsletter_send` |
| Ranking snapshot | Weekly per published post | `scheduled_tasks` → `content_ranking_snapshot` |
| Content-to-outreach matching | On publish (SuperBad only) | `scheduled_tasks` → `content_outreach_match` |

---

## 3. SaaS product configuration

### 3.1 Popcorn tiers

| | Small | Medium | Large |
|---|---|---|---|
| **Framing** | 1 keyword-researched post per week, sent to up to 500 people, done while you sleep | ~2 posts per week, up to 2,500 people | ~5 posts per week, up to 10,000 people |
| **Posts/month** | 4 | 10 | 20 |
| **Newsletter subscribers** | 500 | 2,500 | 10,000 |
| **GSC integration** | — | ✓ | ✓ |
| **Video generation** | — | — | ✓ |
| **Topic steering** | ✓ | ✓ | ✓ |
| **Carousel posts** | ✓ | ✓ | ✓ |

### 3.2 productConfig interface

```
contentEngineConfig: ProductConfig = {
  menuItems: ['Review', 'Social', 'Metrics', 'Topics', 'List'],
  usageDimensions: [
    { key: 'published_posts', label: 'Posts per month', resetCycle: 'billing' },
    { key: 'newsletter_subscribers', label: 'Newsletter subscribers', resetCycle: 'none' }
  ],
  featureFlags: ['gsc_integration', 'topic_steering', 'video_generation'],
  firstRunView: 'ContentEngineOnboardingWizard',
  demoConfig: {
    inputs: ['vertical', 'location_locked'],
    pipeline: 'full',
    voice: 'superbad_own'
  },
  bartenderActions: [
    'approve_draft', 'reject_draft', 'add_seed_keyword',
    'remove_seed_keyword', 'show_metrics', 'show_next_newsletter',
    'trigger_list_import'
  ]
}
```

### 3.3 Subscriber onboarding (three wizard steps)

**Step 1 — Domain verification (required).** Combined DNS setup for blog hosting (Cloudflare path routing) + newsletter sending (SPF/DKIM via Resend). Sub-step: optional Google Search Console OAuth connection. Clear "ask your web person to do this one step" fallback path for non-technical subscribers.

**Step 2 — Seed keyword review.** Engine auto-derives seed keywords from Brand DNA signals + vertical. Subscriber sees the list, approves/tweaks, done. Engine starts keyword research immediately after this step — drafts ready by the time DNS propagates from Step 1.

**Step 3 — Newsletter preferences.** Send window (day + time, default Tuesday 10am local). Optional CSV list import (mandatory permission pass on imported contacts). Optional embeddable form code generation.

### 3.4 Demo landing page

Two-input demo: subscriber selects vertical and whether they're location-locked. Engine runs the full pipeline — real SerpAPI keyword research for that vertical/location, rankability scoring, content gap analysis, Haiku outline, Opus excerpt — in SuperBad's own voice. No email gate. Page explicitly calls out: *"this is us talking about YOUR area of expertise. imagine what could happen if our tool knew who you were."*

Demo result persists to subscriber's account on signup. The SuperBad-voiced excerpt is replaced by subscriber-voiced content once Brand DNA completes.

---

## 4. Newsletter infrastructure

### 4.1 Sending architecture

SuperBad runs one Resend account. Subscribers never see or touch Resend. All sending costs absorbed into tier pricing. Each subscriber's newsletter sends from their own verified domain (setup wizard Step 1). All sends route through the §11.2 `sendEmail()` gate with `classification: 'transactional'` (newsletter is opt-in, not outreach).

Every send includes: `List-Unsubscribe` header, unsubscribe link in body, sender identity (Spam Act 2003 compliance).

### 4.2 List management

Three growth channels per subscriber:
1. **CSV import** — upload wizard with mandatory permission pass email. Only contacts who click confirm join. `consent_source: 'csv_import'`, `consented_at` timestamp.
2. **Embeddable opt-in form** — HTML snippet styled with Brand DNA visual tokens (colours, fonts). Subscriber drops it on their website. Direct opt-in, no permission pass. `consent_source: 'embed_form'`.
3. **Inline blog CTA** — opt-in form at bottom of every Lite-hosted blog post. Direct opt-in. `consent_source: 'blog_cta'`.

### 4.3 List hygiene (automated, aggressive, visible)

- Hard bounces → immediate removal.
- Soft bounces → 3 retries, then removal.
- Unsubscribes → instant, permanent. Re-subscribe requires new opt-in.
- 90-day inactive (zero opens) → automated removal.
- All removals route through `canSendTo()` gate — permanent, no override.
- Subscriber sees a read-only list health panel: bounce rate, unsubscribe rate, inactive %, recent removals with reasons.
- Full CSV export available: all contacts including removed, with status column (`active`, `bounced`, `unsubscribed`, `inactive_removed`). Export cannot be re-imported to bypass removals.

### 4.4 Newsletter format (hybrid)

- **One post since last send** → full standalone newsletter. Haiku rewrites the blog post for email format — conversational, scannable, with "read the full post" link.
- **Multiple posts since last send** → editorial digest. Haiku drafts a brief editorial intro + headline/excerpt/"read more" per post. Feels intentional, not a dump.
- **One email per send window maximum.** The audience never gets more than one Content Engine email per scheduled slot.

### 4.5 Outreach reply auto-enrolment (SuperBad only)

When a Lead Gen prospect replies to any outreach email, the Lead Gen reply handler adds them to SuperBad's newsletter list. `consent_source: 'outreach_reply'`, `consented_at` = reply timestamp. No confirmation email — the reply is the engagement signal. Spam Act compliant (existing business relationship). One-click unsubscribe on every subsequent send.

---

## 5. Social draft generation

### 5.1 Platform coverage (v1)

Instagram, LinkedIn, X, Facebook. Each draft is platform-format-specific:
- **Instagram:** carousel-friendly (Claude decides single vs multi-slide based on content). Square or portrait format. Hashtag strategy.
- **LinkedIn:** professional register. Landscape or square. No hashtags unless industry-standard.
- **X:** concise. Thread format for longer content. Landscape card image.
- **Facebook:** conversational register. Landscape. Minimal hashtags.

### 5.2 Visual asset generation

Three rendering paths, Claude selects per draft:

1. **Template path (primary).** HTML/CSS templates populated with blog content + Brand DNA visual tokens (colours, typography, spacing, mood). Puppeteer renders to PNG/JPG. Multi-slide for carousels (one render per slide). Template library is version-controlled at `/templates/social/`, not database-stored.

2. **AI image path (fallback).** When no template fits the content (needs a scene, abstract visual, or photographic style). Haiku generates an image prompt from blog content + Brand DNA visual signals → OpenAI Images API → stored in Cloudflare R2. Quality-gated: if the image doesn't meet a basic relevance check (Haiku verification call), the engine falls back to the template path.

3. **Video path (large tier only).** Remotion renders animated text, kinetic typography, or simple parallax from a motion template + blog content. Output stored in R2. Formats: Instagram Reel (9:16), LinkedIn video (16:9), X video (16:9). Facebook shares the LinkedIn render.

### 5.3 Publishing (v1)

Stub channel adapters per platform. Each draft has a **Publish** button that opens the platform's native compose screen with text pre-filled (where supported — X and LinkedIn) or clipboard-copied (Instagram, Facebook). Adapter interface defined so real API calls slot in later with zero UI change.

Social drafts also have **Copy** and **Download** buttons for manual workflows.

---

## 6. Content-to-outreach integration (SuperBad only)

### 6.1 Matching

When a SuperBad blog post is published, a Haiku-tier Claude call scans the Lead Gen candidate pool and scores relevance: post topic × prospect enrichment profile (vertical, location, ad activity, website content). High-relevance matches (above a configurable threshold) proceed to email generation.

### 6.2 Email generation

For each matched prospect, Opus generates a content-forward outreach email. Not a pitch — leading with value: *"hey, we wrote this post on [topic directly relevant to their business] — want us to send it over?"* Email includes a link to the blog post. The post IS the value.

### 6.3 Queue integration

Content-match emails land in the Lead Gen approval queue alongside regular cold outreach, tagged `content_match` for visual distinction. They participate in Lead Gen's earned autonomy system — same graduation, probation, and circuit-breaker discipline. Content-forward emails are inherently lower-risk (leading with value, not pitching), so autonomy streaks may build faster in practice.

Content-match outreach respects: §11.2 safe-to-send gate, §11.4 quiet window, Lead Gen warmup ceiling, DNC list. Same enforcement path as all other outreach.

### 6.4 Reply → newsletter loop

When a matched prospect replies, the Lead Gen reply handler:
1. Routes the reply through Lead Gen's standard reply intelligence (classification, handler routing).
2. Auto-enrols the contact into SuperBad's newsletter list (`consent_source: 'outreach_reply'`).

This closes the loop: content → outreach → reply → newsletter subscriber → more content exposure → warmer prospect.

---

## 7. Ranking feedback loop

### 7.1 SerpAPI re-queries (default, all tiers)

Weekly `scheduled_tasks` job per published post. SerpAPI queries the target keyword and records the current organic ranking position. Trend tracking per post: entry position, current position, peak position, direction.

The engine uses ranking trends to refine future keyword selection:
- Keywords in verticals where previous posts ranked well get a research boost.
- Keywords where posts failed to rank within 8 weeks are deprioritised in future research.

### 7.2 Google Search Console (optional, medium+ tiers)

Subscriber connects GSC via OAuth during the domain setup wizard. The engine reads:
- Real impression data per page.
- Click-through rates per query.
- Actual ranking positions for all queries (not just the target keyword).
- Unexpected ranking opportunities — queries the page appears for that weren't targeted.

GSC data supplements SerpAPI re-queries. When both are available, GSC is authoritative for the subscriber's own domain. SerpAPI provides competitor landscape context.

The engine gracefully degrades without GSC — SerpAPI re-queries are always the baseline.

---

## 8. Admin surfaces

### 8.1 SuperBad's internal Content Engine (`/lite/content`)

Five tabs:
- **Review** — split-pane review surface. Draft queue with rejection chat. Same as subscriber experience.
- **Social** — social drafts with Publish buttons per platform. Download/copy. Carousel preview.
- **Metrics** — posts published, ranking trends, newsletter open/click rates, list growth, social engagement (manual tracking in v1).
- **Topics** — passive topic queue with outlines. Veto power. Seed keyword management.
- **List** — SuperBad's newsletter subscriber list. Import wizard, embed code, health panel, CSV export.

### 8.2 Subscriber fleet overview (`/lite/content/subscribers`)

Summary cards: total active subscribers, total posts published this month, aggregate list size, subscribers with unreviewed drafts (churn risk signal).

Compact list: one row per subscriber showing engine status (healthy / draft waiting / domain not verified / list declining), post count, list size, last review date. Click-through to read-only view of subscriber's content surfaces.

Same pattern as `/lite/clients` index from Client Management.

### 8.3 Cockpit integration

Daily Cockpit reads from Content Engine:
- Andy's own: unreviewed drafts count, next scheduled newsletter, ranking milestones (post entered top 10, post hit #1).
- Fleet: subscribers with drafts waiting > 48h (churn signal), domain verification failures, list health alerts.

---

## 9. Subscriber portal integration

### 9.1 Chat-first experience

Same portal pattern as retainer clients. Bartender is the primary interface. Subscriber types to get things done:
- "what's waiting for my review?" → bartender surfaces pending draft.
- "approve the latest post" → bartender triggers approval (with confirmation).
- "add Melbourne photography as a topic" → bartender adds seed keyword.
- "how's my list growing?" → bartender shows metrics summary.
- "when's the next newsletter going out?" → bartender shows scheduled send.

For interactions needing more space (full blog preview, rejection chat feedback), the bartender routes to the full surface.

### 9.2 Menu items

Review, Social, Metrics, Topics, List — via the portal menu bubble → full-page overlay. Same clean UI as retainer portal.

### 9.3 Notifications

Notification bell / subtle sticky header when:
- A new draft is ready for review.
- A post has been published.
- A newsletter has been sent (with open rate if available).
- Domain verification is incomplete (persistent gentle nudge).

Email notifications for draft-ready events, routed through §11.2 `sendEmail()`.

---

## 10. Voice & delight treatment

### 10.1 Sprinkle claims

**System email subject lines** (§2 of sprinkle bank) — CLAIMED. Every Content Engine notification email and newsletter carries a voiced subject line. Examples: draft-ready notification, newsletter-sent confirmation, list milestone. Content mini-session produces the voice treatment.

**OG images auto-generated per page** (§6 of sprinkle bank) — CLAIMED. Every published blog post gets a branded OG card with a dry line baked into the template alongside the post title. Content mini-session produces the line pool or generation prompt.

### 10.2 Ambient voice

Empty states (no drafts, no topics, no subscribers, no published posts) get dry copy via `generateInVoice()` reading SuperBad's Brand DNA. Loading states ("researching keywords...", "writing your post...", "generating newsletter...") get static dry lines — content mini-session produces these.

### 10.3 Suppression

Hidden egg suppression on the review pane during active rejection-chat feedback. Standard suppression on all wizard surfaces and payment flows per the S&D spec.

---

## 11. Data model

### 11.1 New tables

**`content_topics`**
- `id`, `company_id` (owner — SuperBad or subscriber company), `keyword`, `rankability_score`, `content_gaps` (JSON — angles identified), `outline` (JSON — sections, points, word count, snippet flag), `serp_snapshot` (JSON — top 10 results at research time), `status` (enum: `queued` / `vetoed` / `generating` / `generated` / `skipped`), `vetoed_at`, `created_at`

**`blog_posts`**
- `id`, `company_id`, `topic_id` (FK → content_topics), `title`, `slug`, `body` (markdown), `meta_description`, `og_image_url`, `structured_data` (JSON — JSON-LD Article), `internal_links` (JSON), `snippet_target_section` (nullable text), `status` (enum: `draft` / `in_review` / `approved` / `publishing` / `published` / `rejected`), `published_at`, `published_url`, `created_at`, `updated_at`

**`blog_post_feedback`**
- `id`, `blog_post_id` (FK), `role` (enum: `user` / `assistant`), `content` (text), `created_at`
- Rejection chat thread per blog post. Same pattern as other chat surfaces.

**`social_drafts`**
- `id`, `blog_post_id` (FK), `platform` (enum: `instagram` / `linkedin` / `x` / `facebook`), `text`, `format` (enum: `single` / `carousel` / `video`), `visual_asset_urls` (JSON array — supports multi-slide), `image_prompt` (nullable — for AI-generated path), `carousel_slides` (nullable JSON — per-slide content for multi-image), `status` (enum: `generating` / `ready` / `published`), `published_at`, `created_at`

**`newsletter_subscribers`**
- `id`, `company_id` (owner), `email`, `name` (nullable), `consent_source` (enum: `csv_import` / `embed_form` / `blog_cta` / `outreach_reply` / `permission_pass`), `consented_at`, `status` (enum: `pending_confirmation` / `active` / `bounced` / `unsubscribed` / `inactive_removed`), `bounce_count`, `last_opened_at`, `unsubscribed_at`, `removed_at`, `created_at`

**`newsletter_sends`**
- `id`, `company_id`, `blog_post_ids` (JSON array — posts included in this send), `subject`, `body` (HTML), `format` (enum: `single` / `digest`), `scheduled_for`, `sent_at`, `recipient_count`, `open_count`, `click_count`, `created_at`

**`ranking_snapshots`**
- `id`, `blog_post_id` (FK), `keyword`, `position` (nullable integer — null if not found in top 100), `impressions` (nullable — GSC only), `clicks` (nullable — GSC only), `ctr` (nullable — GSC only), `source` (enum: `serpapi` / `gsc`), `snapshot_date`, `created_at`

**`content_engine_config`**
- `id`, `company_id` (unique — one config per owner), `seed_keywords` (JSON array), `send_window_day` (enum: day of week, default `tuesday`), `send_window_time` (time, default `10:00`), `send_window_tz` (timezone, default from user's `timezone` column), `gsc_refresh_token` (nullable, encrypted), `gsc_property_url` (nullable), `embed_form_token` (unique token for embeddable form), `created_at`, `updated_at`

### 11.2 New columns on existing tables

None. Content Engine is self-contained — it reads from `companies`, `contacts`, `brand_dna_profiles`, and `lead_candidates` but does not add columns to them.

### 11.3 `activity_log.kind` gains ~15 values

`content_topic_researched`, `content_topic_vetoed`, `content_draft_generated`, `content_draft_approved`, `content_draft_rejected`, `content_post_published`, `content_newsletter_scheduled`, `content_newsletter_sent`, `content_social_draft_generated`, `content_social_published`, `content_subscriber_added`, `content_subscriber_removed`, `content_outreach_matched`, `content_seed_keyword_added`, `content_seed_keyword_removed`

### 11.4 `scheduled_tasks.task_type` gains 6 values

`content_keyword_research`, `content_generate_draft`, `content_fan_out`, `content_newsletter_send`, `content_ranking_snapshot`, `content_outreach_match`

---

## 12. Claude prompts

| Prompt | Model | Purpose |
|--------|-------|---------|
| `score-keyword-rankability.ts` | Haiku | Domain authority heuristic scoring + content gap identification from scraped top-3 results |
| `generate-topic-outline.ts` | Haiku | Structured outline from keyword + gaps + Brand DNA tags |
| `generate-blog-post.ts` | Opus | Full blog post from outline + Brand DNA full profile + SERP data + content gaps |
| `rewrite-for-newsletter.ts` | Haiku | Blog → newsletter format (standalone or digest, selected by post count) |
| `generate-social-draft.ts` | Haiku | Blog → platform-specific social text + format decision (single/carousel/video) + visual brief |
| `select-visual-template.ts` | Haiku | Pick template + fill content for HTML→image rendering, or decide AI generation needed |
| `generate-image-prompt.ts` | Haiku | Blog content + Brand DNA visual signals → OpenAI Images API prompt |
| `match-content-to-prospects.ts` | Haiku | Score published post × Lead Gen candidate pool for relevance |
| `draft-content-outreach.ts` | Opus | Content-forward outreach email per matched prospect |
| `generate-embed-form-styles.ts` | Haiku | Brand DNA visual tokens → CSS for embeddable opt-in form |

All Opus prompts read the full Brand DNA profile as system context. All Haiku prompts read Brand DNA signal tags only. Both layers follow the tiered injection pattern locked in `docs/specs/brand-dna-assessment.md`.

All externally-destined output (blog posts, newsletter, social drafts, outreach emails) passes §11.5 `checkBrandVoiceDrift()` before entering the review queue or send pipeline.

---

## 13. Integrations

### 13.1 Existing (no new setup)

| Integration | Used for |
|-------------|----------|
| **SerpAPI** | Keyword research, SERP analysis, ranking snapshots, Google Maps data |
| **Resend** | Newsletter sends, notification emails, permission pass emails — all via §11.2 `sendEmail()` |
| **Anthropic (Claude)** | All generation (outlines, posts, newsletters, social, matching, outreach) |
| **Cloudflare** | Blog hosting via path routing, R2 for visual asset storage |
| **Puppeteer** | HTML/CSS template → image rendering for social visuals + OG images |

### 13.2 New integrations

| Integration | Used for | Setup |
|-------------|----------|-------|
| **OpenAI Images API** | AI-generated visual assets when no template fits | Setup wizard: API key |
| **Remotion** | Video generation for social drafts (large tier only) | npm dependency, Remotion Lambda for production rendering |
| **Google Search Console API** | Ranking data, impressions, CTR, unexpected queries (optional, medium+ tier) | Setup wizard: OAuth consent flow |

### 13.3 Setup wizard steps for Content Engine

Lead Gen's setup wizard already covers SerpAPI. Content Engine adds:
- OpenAI Images API key
- GSC OAuth connection (optional, during domain verification wizard)

Remotion requires no external API key — it's a build dependency.

---

## 14. Cross-spec flags

### 14.0 Hiring Pipeline — claimable-internal-backlog surface (added 2026-04-13 Phase 3.5)

Content Engine exposes a claimable surface over SuperBad's own internal content backlog so Hiring Pipeline can hand trial tasks to candidates without the risk of two candidates working on the same item.

```ts
// List items suitable for the given purpose
listClaimableContentItems(opts: {
  suitableFor: 'trial_task',             // extendable; future consumers pass their own tag
  limit?: number,
}): Promise<ContentBacklogItem[]>

// Atomically claim — fails if already claimed. Caps a per-candidate spend in AUD.
claimInternalContentItem(
  contentId: string,
  candidateId: string,
  budgetCapAud: number,
): Promise<{ ok: true } | { ok: false, reason: 'already_claimed' | 'archived' | 'ineligible' }>

// Release a claim (candidate declined, withdrew, or clean parting). Frees the item for re-claim.
releaseContentItem(contentId: string, reason: string): Promise<void>
```

Atomicity guaranteed via a single SQL `UPDATE ... WHERE claimed_by IS NULL` transaction. New `content_items` columns: `claimed_by` (nullable FK → `candidates.id`), `claimed_at`, `claim_budget_cap_aud`, `claim_released_at`, `claim_released_reason`. Consumer = Hiring Pipeline trial-task assignment (§3 of that spec); future consumers (e.g. bench-work allocation) register via the same three functions.

### 14.1 Lead Generation (LOCKED)

- Content-match emails land in Lead Gen approval queue with `source: 'content_match'` tag.
- Content-match emails participate in earned autonomy per track.
- Outreach reply handler auto-enrols into newsletter (`consent_source: 'outreach_reply'`).
- Content Engine shares SerpAPI integration — same API key, same setup wizard step, separate query budgets.

### 14.2 Sales Pipeline (LOCKED)

- SaaS subscription creates a Deal at Won stage. Content Engine subscriptions follow the standard SaaS deal creation pattern from `docs/specs/saas-subscription-billing.md`.

### 14.3 Brand DNA Assessment (LOCKED)

- Blog generation reads subscriber's Brand DNA profile as perpetual context (tiered: full for Opus, tags for Haiku).
- Demo landing page uses SuperBad's own Brand DNA for voice.
- Seed keywords auto-derived from Brand DNA signals during onboarding Step 2.

### 14.4 Client Management (LOCKED)

- Content Engine subscriber portal uses the same chat-first pattern.
- Bartender gains Content Engine safe actions (approve, reject, seed keywords, metrics, newsletter info, import).
- Portal menu gains Content Engine items: Review, Social, Metrics, Topics, List.

### 14.5 SaaS Subscription Billing (LOCKED)

- Content Engine implements `productConfig` interface contract (§3.2 of this spec).
- Two usage dimensions: `published_posts` (monthly reset), `newsletter_subscribers` (no reset — running cap).
- Three feature flags: `gsc_integration`, `topic_steering`, `video_generation`.
- Usage tracking via `recordUsage()` / `checkUsageLimit()` primitives from SaaS billing spec.

### 14.6 Onboarding + Segmentation (LOCKED)

- Content Engine `firstRunView` is the three-step onboarding wizard (domain → topics → newsletter).
- Triggers after Brand DNA completion, following the standard SaaS onboarding sequence.

### 14.7 Surprise & Delight (PRE-WRITTEN)

- System email subject lines claimed — Content Engine notifications and newsletters carry voiced subjects.
- OG images claimed — published blog posts carry branded OG cards with dry line.
- Hidden egg suppression on review pane during active feedback.
- Standard suppression on onboarding wizards and payment flows.

### 14.8 Task Manager (LOCKED)

- No direct dependency. Content review is not a "task" — it's a product-specific workflow.

### 14.9 Daily Cockpit (#12)

- Andy's own: unreviewed draft count, next newsletter, ranking milestones.
- Fleet: drafts waiting > 48h, domain verification failures, list health alerts.

### 14.10 Unified Inbox (#11)

- Content-match outreach emails thread via standard `In-Reply-To`/`References` headers.
- Newsletter subscriber replies (if enabled) route to the Unified Inbox.

### 14.11 Client Context Engine (LOCKED)

- Subscriber engagement signals (review frequency, list growth rate, content approval rate) readable via `getSignalsForAllContacts()` for churn prediction.

### 14.12 Foundations

- §11.1: All mutations via `logActivity()`.
- §11.2: All sends via `sendEmail()` gate. Newsletter = `classification: 'transactional'`. Content-match outreach = `classification: 'outreach'`.
- §11.3: All timestamps via `formatTimestamp()`.
- §11.4: Content-match outreach respects quiet window. Newsletter sends are exempt (transactional — subscriber opted in).
- §11.5: All externally-destined content passes `checkBrandVoiceDrift()`.

---

## 15. Build-time disciplines

43. **Multi-tenant isolation is non-negotiable.** Every query, every generation, every list, every send scopes by `company_id`. No cross-tenant data leakage. Enforced at the data-access layer, not just middleware.
44. **Blog generation prompts read Brand DNA as system context, never user context.** Prevents prompt injection via Brand DNA answers.
45. **Template library is version-controlled** (`/templates/social/`), not database-stored. Changes require a deploy, not a database migration.
46. **Visual asset quality gate.** AI-generated images pass a Haiku verification call before being attached to a social draft. Failed verification falls back to template path. No unreviewed AI images reach the subscriber.
47. **One unreviewed draft maximum per owner.** The generation throttle is enforced at the `scheduled_tasks` enqueue level — the engine checks for existing `in_review` posts before generating.
48. **Content-match outreach is SuperBad-only.** The matching pipeline reads from Lead Gen's candidate pool, which is SuperBad's internal data. Subscriber content never matches against SuperBad's prospects or other subscribers' data.
49. **Newsletter sends are batched per send window.** No partial sends — all posts approved since the last send go in one email. A failed send retries the entire batch, not individual posts.
50. **Embeddable form tokens are per-owner and rotate on request.** Stale tokens return a clean error, not a broken form.

---

## 16. Content mini-session scope

**Large.** Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` skills loaded. Produces:

- Social visual template library: initial set of ~10–15 HTML/CSS templates covering typography posts, quote cards, stat highlights, listicle slides, carousel frames, story formats. All pulling Brand DNA tokens. Art direction for the visual system.
- Newsletter email template design (standalone + digest variants).
- Demo landing page copy: the "this is us talking about YOUR area of expertise" pitch, convention-break callout, vertical/location input framing.
- Inline blog CTA copy (the dry one-line CTA on SuperBad's own posts + the standard opt-in CTA on all posts).
- Embeddable opt-in form design.
- System email subject line voice treatment (claimed sprinkle): draft-ready, newsletter-sent, list milestone subjects.
- OG image template design (claimed sprinkle): the dry line pool or generation prompt for OG cards.
- Empty state copy: no drafts, no topics, no subscribers, no published posts, no social drafts, no ranking data.
- Loading state copy: "researching keywords...", "writing your post...", "generating newsletter...", "creating visuals...", "publishing...".
- Fleet overview labels and empty states.
- Notification copy: draft-ready, post-published, newsletter-sent, domain-incomplete.
- Remotion motion template art direction (for large-tier video generation).

---

## 17. Success criteria

1. SuperBad's own blog publishes at `superbadmedia.com.au/blog/*` with full SEO package.
2. A subscriber can sign up, complete Brand DNA, run the onboarding wizard, and have a keyword-researched draft in their review queue within 48 hours — without touching any configuration beyond the wizard.
3. Approving a draft publishes the blog post, generates newsletter + social drafts + visual assets, and schedules the newsletter send — all automatically.
4. The subscriber's audience receives a branded newsletter from the subscriber's own domain on the scheduled window.
5. Social drafts include platform-appropriate visual assets (template-rendered or AI-generated).
6. Content-match outreach emails appear in Andy's Lead Gen queue for matching prospects.
7. Ranking snapshots show position trends for all published posts.
8. The review rejection chat produces measurable improvement in draft quality across iterations.
9. Multi-tenant isolation verified: subscriber A cannot see subscriber B's content, list, or metrics.
10. All sends pass §11.2 gate. All generated content passes §11.5 drift check. All mutations logged via §11.1.

---

## 18. Out of scope (explicit non-goals)

- **Auto-posting to social platforms.** Stub adapters in v1. Real API integrations are a future enhancement.
- **Auto-approval.** Every blog post requires human review. No earned autonomy on content approval — the one-gate review is the product's quality control.
- **Multi-language content.** English only in v1.
- **Podcast or audio generation.** Text + image + video only.
- **A/B testing of headlines or content.** One post, one version (after rejection chat iterations). A/B is a v1.1 analytics feature.
- **Subscriber-to-subscriber social features.** No community, no shared content, no public subscriber directory. Each subscriber's engine is isolated.
- **Manual blog editing outside the rejection chat.** All content changes go through Claude via the chat. Direct editing undermines the product's value proposition and bypasses the drift check.
- **Credit note or pro-rata refunds for unused posts.** Unused posts in a billing cycle expire. The tier cap resets on the next cycle.
- **SMS or push notifications for subscribers.** Email only in v1.
- **Win-back sequences for inactive newsletter contacts.** Automated removal is the v1 discipline. Win-back is v1.1.

---

## 19. Phase 5 sizing

7 sessions estimated:

- **Session A:** Data model + keyword research pipeline + rankability scoring + topic queue. Tables, SerpAPI integration, scoring algorithm, content gap analysis, topic queue surface. **Large.**
- **Session B:** Blog generation + review surface + rejection chat + publishing. Two-pass generation, split-pane review, Cloudflare path routing, SEO elements, OG image generation. **Large.** Depends on A.
- **Session C:** Visual generation pipeline. Template system (HTML/CSS + Puppeteer), OpenAI Images API integration, Remotion setup, quality gate, carousel support. **Large.** Can parallel with D after B.
- **Session D:** Newsletter infrastructure. List management, import wizard, embeddable form, permission pass, send scheduling, hybrid format, list hygiene, Resend integration. **Medium-large.** Can parallel with C after B.
- **Session E:** Social drafts. Platform adapters, format selection, Publish flow, carousel preview, visual asset attachment. **Medium.** Depends on C.
- **Session F:** SaaS product integration. productConfig, subscriber portal, onboarding wizard, demo landing page, billing integration, bartender actions, notifications. **Medium-large.** Depends on A + SaaS Billing infrastructure.
- **Session G:** Outreach integration + ranking feedback + fleet overview. Content-match pipeline, Lead Gen queue integration, SerpAPI re-queries, GSC OAuth, `/lite/content/subscribers` overview, cockpit signals. **Medium.** Depends on A + B.

Dependency graph: A → B → (C ∥ D) → E. F after A + SaaS infrastructure. G after A + B. Sessions C and D can run in parallel. F can parallel with C/D/E.
