# Content Studio — Brainstorm

**Date locked:** 2026-04-15
**Status:** Foundational decisions locked; full spec TBD post-Lite-launch.
**Phase:** Post-v1.0 launch (own phase, not a v1.1 feature patch).
**Supersedes:** `project_saas_lut_creator.md` and `project_saas_image_editor.md` (consolidated into Content Studio as one product).
**Origin reference:** `docs/brainstorm/marketing-site/grading-comparison.html` — "The Dark Room" defines the LUT-creator UX north star.

---

## What it is (one line)

A standalone SaaS — *Content Studio by SuperBad* — that helps small-business owners and creators make beautiful, on-brand social media posts (the wedge) and build their own visual colour grades / LUTs (the depth feature).

---

## 16 foundational decisions

### Q1 — Structural shape: **Standalone SaaS**
Its own signup, billing, marketing-site presence, 2-tier pricing. Not folded into the main SuperBad SaaS popcorn tiers, not an add-on. Different audience, different funnel, different pitch.

### Q2 — Audience: **A + B (small-biz owners + creators/photographers)**
Same product serves both. Lead with one audience in marketing while the product itself stays welcoming to both. Risk: generic positioning. Mitigation: product is one elegant core, marketing is audience-specific.

### Q3 — Hero feature: **Post creator (LUT is depth)**
Marketing leads with "the most elegant way to make a social post." LUT creator is the "oh wow" Pro-tier depth that pulls in creators and justifies the upgrade. Andy's call (overrode initial recommendation): friction is making posts, not colour grading.

### Q4 — Brand style onboarding: **Hybrid (auto-detect → review → optional Brand DNA mini)**
- Paste website URL → LLM scrapes + infers colours, fonts, voice, mood (instant gratification, lead-magnet doubling).
- User reviews + edits.
- Optional deeper Brand DNA mini (8–12 questions) for users who want more depth.
- Honours `feedback_pre_populated_trial_experience`, `feedback_setup_is_hand_held`, `project_brand_dna_flagship_experience`.
- **IG handle scraping flagged as fragile (Meta ToS) — likely URL-only at build time.**

### Q5 — Post types: **Stills + carousels (+ Remotion motion graphics)**
- No reels, no short-form video, no full video editor.
- Remotion provides programmatic MP4 motion on stills/carousels — fits the Next.js/React stack.

### Q6 — Delivery: **Export + scheduling queue with reminders**
- No direct platform publishing in v1 (Meta App Review friction matches what main SaaS deferred).
- Calendar/queue + push/email reminders at scheduled time; user posts manually from their phone.
- Direct publishing (Buffer-style Meta integration) is a Content Studio v1.1 unlock.

### Q7 — Tier split axis: **Hybrid feature + brand count**
- Studio = small-biz owner: 1 brand, post creator basics.
- Pro = creator/freelancer/agency: multiple brands + power tools.
- Aligns with `project_saas_popcorn_pricing` philosophy (small build jump, big revenue lift).

### Q8 — Captions: **Optional AI draft, both tiers**
- "Draft caption" button, brand voice from Brand DNA mini, exported alongside the asset.
- Captions in both tiers (not gated to Pro — better upgrade reasons exist).
- Routes through `project_llm_model_registry` as a named job (e.g. `content_studio.caption_draft`).

### Q9 — Acquisition: **E + A (free brand profile teaser + 7-day Pro trial, card up front)**
- **Top of funnel:** ungated "paste your URL → see your brand profile in 30 seconds" — viral / SEO / shareable artefact.
- **Conversion:** 7-day full Pro trial, card required up front, auto-converts.
- No freemium with watermarks (clashes with `feedback_takeaway_artefacts_brand_forward`).

### Q10 — Tier feature lines: **Variant C (middle path)**
**Studio ($19/mo):**
- 1 brand profile
- Post creator (stills + carousels)
- 12 curated LUT presets
- Scheduling queue + reminders
- AI caption draft
- Standard exports

**Pro ($49/mo):**
- Everything in Studio, plus:
- Visual LUT *creator* (real-time, dark-room style)
- Batch edit (apply LUT/style to many photos)
- Remotion motion graphics
- Unlimited brand profiles
- Priority / larger exports

Four clean upgrade reasons: build-your-own colour, batch, motion, multi-brand.

### Q11 — Pricing: **Studio $19/mo · Pro $49/mo**
- Annual ~10× monthly (2 months free): $190 / $490.
- $19 sits just above Canva ($13) — wedge needs one or two real differentiators (brand voice, brand auto-detect, elegance).
- Pro 2.6× Studio — industry sweet spot for feature-gated upgrade.
- AU pricing matches USD numerically (AU$19 / AU$49) when localised.

### Q12 — Surface: **Mobile-first PWA + web dashboard**
- Phone is the primary surface (where you actually post from).
- Web dashboard for power tasks: LUT building, batch editing, brand profile setup, scheduling overview.
- Designed mobile-first from first mockup — different discipline from rest of Lite/HQ.
- Native iOS/Android apps deferred to Content Studio v1.1 if PWA conversion proves the App Store push is needed.
- Stack: Next.js + PWA patterns (`next-pwa` or App Router PWA).

### Q13 — Empty state ("make a post"): **AI-first proposals + template library escape hatch**
- Default: user names intent ("showing off a new menu item") → Studio generates 3–4 layout proposals already brand-styled.
- Escape hatch: "browse templates" — same brand-aware engine, library entry point.
- Templates are *layouts* (where photo/text/brand mark go), not finished designs.
- Honours `feedback_curated_customisation`, `feedback_pre_populated_trial_experience`, `feedback_setup_is_hand_held`.

### Q14 — Storage: **Hybrid (hosted brand kit + posts, ephemeral source 30-day)**
- Hosted forever: brand kit (logo, colours, fonts), saved/scheduled posts, exported assets.
- Ephemeral: source uploads expire after 30 days unless saved as part of a post.
- UI signal: "source photo expires in 12 days — save as part of a post to keep it."
- Posts must embed/copy source photo so they're self-contained after source expires.
- Both tiers marketed as "unlimited posts, unlimited brand assets."

**Cancellation lifecycle (folded into Q14):**
- Cancel → 30-day grace, read-only, exports still work.
- Day 31 → archived, kept 12 months in cold storage for reactivation.
- Then deleted.

### Q15 — Relationship to SuperBad: **Shared data + bundled inclusion**
- Shared SuperBad account architecture — Content Studio brand profile is a *subset* of full Brand DNA schema. Upgrading to retainer/main SaaS auto-fills Brand DNA from the Studio profile (no re-asking).
- Honours `project_brand_dna_as_perpetual_context` and `project_two_perpetual_contexts`.
- **Bundled inclusion:**
  - Retainer clients → Content Studio Pro included (no extra fee).
  - Main SaaS subs → Content Studio Studio included; Pro at a discount.
  - Standalone Content Studio buyers → pay normally.
- Honours `feedback_no_lite_on_client_facing` — UI says "SuperBad — Content Studio" or "Content Studio by SuperBad," never "Lite."

### Q16 — Remotion motion scope: **B (Ken Burns + fades + animated text reveal)**
- Pan/zoom on stills, fade between carousel slides.
- Animated text reveal (slide-in, type-on, fade-in) using brand fonts.
- **No audio.** Silent MP4 only.
- Animated logo bumpers, shape transitions → v1.x.
- Curated royalty-free music library → v1.x (real licensing/legal lift).
- User-uploaded audio → never (DMCA risk).

---

## Honest reality check

**This isn't a v1.1 feature. It's a v2 product.**

Sixteen decisions add up to: standalone SaaS, mobile-first PWA, brand-profile auto-detect engine, real-time visual LUT creator, Remotion render pipeline, content calendar + scheduling + reminders, AI caption generation, multi-brand support, bundled-with-retainers billing logic, marketing-site brand-profile teaser, new pricing SKUs in Stripe, cancellation/grace/archive lifecycle. Conservatively 4–6 build waves of its own.

### Three hardest parts
1. **Visual LUT creator.** "Real-time, dark-room elegant" is a high bar. If mediocre, Pro doesn't sell.
2. **Brand profile auto-detect quality.** The teaser → trial conversion depends on this *feeling* right. Generic output collapses the funnel.
3. **Mobile-first PWA design discipline.** Different from web-first design used everywhere else in Lite/HQ.

### What could derail it
- **Margin on Studio at $19/mo.** Storage + LLM caption calls + Remotion render compute on heavy users could eat the tier. Per-user cost monitoring from day one.
- **Meta IG scraping** for brand profile auto-detect is against ToS / fragile. Likely drop the IG-handle path; keep URL-only.
- **Building Content Studio while iterating Lite.** Splitting attention tanks both. Needs a clean "Lite is stable, has paying customers" gate before kickoff — not parallel.

### Verdict
Doable as its own phase, after main Lite is live and stable with paying customers. Not as a v1.1 patch.

---

## Open items deferred to spec phase

- Exact LUT preset count (12 was placeholder)
- Exact font handling (curated set vs Google Fonts library)
- Marketing site shape + brand profile teaser placement
- Onboarding wizard sequence specifics
- Analytics surface (no publishing API = limited data; what can/should we show?)
- Support model
- Stripe SKU + bundling logic spec
- Brand profile data-model contract with full Brand DNA
- Mobile-first design system (own design pass, not adapted from Lite)
- Per-user cost monitoring + tier-margin guardrails spec
