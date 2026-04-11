# Phase 3 Handoff — Scope Patch Mini-Brainstorm

**Date:** 2026-04-11
**Session type:** Phase 1.5 scope patch (mini-brainstorm reopening locked SCOPE.md to add new features)
**Output:** patched `SCOPE.md`, new `MEMORY.md` entry, 3 new Phase 3 specs added to the backlog
**Next session:** Phase 3 — Lead Generation spec (unchanged — the mini-brainstorm does not change the recommended next session)

---

## Why this session existed

Andy surfaced four new feature requests that weren't in the locked v1 scope:

1. Automated SEO feature generating keyword-optimised blogs with CTAs to SaaS/subscription services
2. Auto-generated email newsletter rewritten from those blogs
3. Social media repurposing of blog content
4. Premium automated client onboarding with in-depth brand analysis + revenue-capture questions for SaaS upsell segmentation

One of these (newsletter) directly contradicted a locked non-goal ("Not an email marketing platform... No bulk campaigns, broadcast lists, or newsletter functionality"). Rather than quietly ignore the conflict or stuff these into existing specs, Andy agreed to run a short mini-brainstorm to formally reopen `SCOPE.md`, redraw the non-goal, and add new Phase 3 specs to the backlog. Source-of-truth discipline — if `SCOPE.md` says X and we build not-X, every future session starts from a lie.

---

## What was decided — 9 locks

### Q1 — Content engine audience

**Locked: A — internal marketing flywheel for SuperBad itself.**

Not a productised SaaS. Drives SuperBad's own top-of-funnel by building organic search, owned-audience newsletter, and social output. CTAs in v1 point at the intro funnel (the $297 trial shoot) and a waitlist for future SaaS products.

Andy asked whether Option C (hybrid — build internal, productise later with `tenant_id` stubs) preserved future optionality better. I pushed back with the actual mechanics: the reusable parts on productisation are LLM prompts + pipeline patterns + UX learnings (none of which depend on the data schema), and the non-reusable parts (data model, auth scope, sending infra) get rewritten regardless of whether we stubbed multi-tenancy or not. Optionality is preserved through **clean module boundaries**, not through speculative schema columns. Andy accepted and locked A.

**The four boundary disciplines baked into the Content Engine spec:**
1. Content engine is its own module with minimal coupling to rest of admin
2. Prompts in version-controlled files, never inlined in routes
3. Generate / review / publish as discrete stages with clean interfaces
4. Document what works as patterns emerge

### Q2 — Content engine channels

**Locked: C — all three channels (blog + newsletter + social), social is draft-only in v1, with forward-compatible Publish button per platform wired through stub channel adapters.**

Adapter pattern reused from the lead gen outreach design — no new primitive. When an adapter gets a real API implementation later, clicking Publish just works. When no adapter exists, Publish is disabled or no-op and Download is always available as the manual path. No Meta app review required in v1.

### Q3 — Review loop shape

**Locked: C — one gate per blog, fan-out is automatic, with Claude-powered rejection chat.**

Binary approve/reject was the original C. Andy upgraded it: rejection opens a Claude chat where Andy types the specific reason ("too corporate, sounds like a LinkedIn thought-leader — pull it back"), Claude regenerates with original prompt + feedback as additional context. Chat thread persists on the draft so iteration history is visible. Claude can ask one clarifying question if feedback is ambiguous. Approval triggers fan-out to newsletter + social drafts without a second gate.

**Pattern reuse:** same Claude chat primitive as the Setup Wizards "Stuck?" helper. No new infra.

### Q4 — Topic strategy

**Locked: Andy overrode my A/B/C options — the engine uses SerpAPI as a keyword research tool, researching keywords SuperBad can realistically rank for, with the explicit goal of semi-autonomously improving SuperBad's SEO ranking.**

Pipeline:
1. Seed keywords from SuperBad's business context (services × verticals × locations)
2. SerpAPI queries each seed, returns SERP data
3. Rankability scoring filters out unwinnable keywords (top 10 dominated by high-authority domains)
4. For each qualifying keyword, Claude generates a blog post using real SERP data as context
5. Post enters review queue (Q3 flow)

**Open items for the Content Engine spec session:**
- Rankability scoring heuristic (first pass: count top-10 results from a curated high-authority domain list, drop if > 5)
- Ranking feedback loop — weekly SerpAPI re-queries vs Google Search Console integration (free, adds one setup wizard)
- Seed keyword bank — Claude generates from business-context skill; Andy reviews/edits once at setup

### Q5 — Newsletter subscriber list

**Locked: B — opt-in form + import wizard, with mandatory permission pass on every imported contact.**

Andy added a second import source: a CSV of prior trial shoot customers. So the import wizard is now a **general contact import primitive** with source adapters — GHL export and CSV upload in v1. Prior trial shoot customers are tagged with `prior_trial_shoot` segment tag (pre-qualified, paid money, strongest inferred-consent basis under Australian Spam Act).

Every imported contact still gets a permission pass ("confirm you want to keep hearing from us"). Only contacts who click confirm join the list. Every subscriber row has `consent_source` (`form_subscribe` / `ghl_import` / `trial_shoot_csv`) and `consented_at` timestamp for audit trail.

**Cross-spec reuse flag:** the contact import wizard is a general primitive that Sales Pipeline can reuse for historical Company/Contact import. Worth calling out when the Client Management / Unified Inbox specs are written.

### Q6 — Blog publishing location

**Locked: C — `superbadmedia.com.au/blog/*` via Cloudflare path routing to Lite origin.**

Phase 2 already sketched this exact pattern for intermediate forms (§4 of FOUNDATIONS). Cloudflare routing rule sends `/blog/*` to Lite's Coolify app; GHL continues serving everything else. Root-domain hosting is non-negotiable — the feature's entire ranking goal depends on it, and subdomains carry a real SEO penalty. Path routing survives both future transitions cleanly:
- When Lite migrates from `lite.superbadmedia.com.au` to `/lite`, `/blog` is unaffected
- When the marketing site rebuild finally retires GHL, `/blog` is already at its final URL — zero migration, zero SEO history loss

Andy noted he's aiming to migrate the marketing site off GHL quickly. That doesn't change v1 — C survives that migration cleanly.

**Open items for the Content Engine spec session:**
- Marketing visual theme for blog (light, warm, canonical 60/20/10/6/4 marketing ratio — distinct from Lite's dark product theme)
- Canonical URL strategy (hard-pin to root domain)
- `robots.txt` and `sitemap.xml` handling during the GHL co-existence phase

### Q7 — Brand analysis mechanism

**Locked: C — hybrid, LLM pre-fills from public signals, client reviews and adds what Claude can't see.**

Then Andy expanded the scope dramatically. The brand analysis is not just a questionnaire — it is a **NASA-style psychological + taste assessment** designed to be the most effective brand discovery tool in the market. 30+ minutes. 50–100 MC questions per bank with text-override. Indirect signal questions ("if your business was a film, which director?") that surface preferences people can't articulate directly. Invisible signal tags (`visual:symmetry`, `mood:whimsy`, etc.) aggregate into a structured profile. Output is dual-layer: machine-readable signal tags + human-readable prose document (possibly also a visual moodboard).

**This became its own Phase 3 spec, `docs/specs/brand-dna-assessment.md`.** It is no longer a section of "premium onboarding" — it is the load-bearing architectural asset. Once completed, the profile is the **perpetual reference document** every downstream LLM call reads as context. A new memory (`project_brand_dna_as_perpetual_context.md`) captures this principle.

### Q7b — Brand DNA mode relationship

**Locked: C — shape-aware with multi-stakeholder blending.**

Two modes: **Founder Profile** (personal taste + psychology) and **Business Profile** (culture + positioning + voice). Opening wizard asks client type (solo founder / founder-led small team / multi-stakeholder company) and routes accordingly:
- Solo founder → Founder Profile only, complete premium experience
- Founder-led small team → Founder Profile on founder + Business Profile on business
- Multi-stakeholder company → Business Profile on org + optional parallel Founder Profile sessions on N key stakeholders. Final profile is a **blend** — shared business DNA with individual voices layered in. Blending logic is a Claude synthesis prompt reading N sets of signal tags.

Directly serves the `project_client_size_diversity` memory.

### Q8 — SaaS onboarding shape

**Locked: A with dashboard opt-in for Brand DNA.**

SaaS signup is fast — standardised Revenue Segmentation questionnaire (~5 min, ~8 MC questions) → product unlocked. No Brand DNA in the signup path (30+ min assessment at signup would gut conversion).

Brand DNA is offered through the SaaS customer dashboard as a regularly-highlighted opt-in, framed by value ("your [SaaS product] will be dramatically more personal once we know you properly"). **Completion is itself a strong engagement signal** — a SaaS customer who invests 30+ min voluntarily is demonstrating serious intent. They surface in a "hot upsell candidates" filter on the daily cockpit for retainer outreach.

**Double segmentation layer for upsell targeting:**
- Structured: revenue, spend, stage, team size, constraint, goal, vertical, tools
- Behavioural: `brand_dna_status` (`not_started` / `in_progress` with % / `completed`)

Intersection is the targeting layer.

**Starter revenue segmentation question list** (final list locked in the onboarding spec session):
1. Current monthly revenue (range)
2. Business stage
3. Current marketing spend (range)
4. Team size
5. Biggest current constraint (closed list)
6. 12-month goal (closed list)
7. Industry / vertical
8. Tools currently in use

---

## SCOPE.md changes

1. **Header** updated to reflect the 2026-04-11 patch (original lock still stands; this is an explicit patch session).
2. **Newsletter non-goal redrawn** (line ~214). Updated text: "Not a general-purpose email marketing platform." SuperBad's own owned-audience newsletter is in scope as part of the Content Engine. Third-party campaign management, bulk sends to purchased lists, and campaign tools for external entities remain out of scope.
3. **New section: "Additional v1 features (added 2026-04-11 mini-brainstorm)"** added between "Additional cross-cutting features" and "Explicit non-goals". Contains three new feature sections:
   - 7. Content Engine
   - 8. Brand DNA Assessment
   - 9. Premium Onboarding + Revenue Segmentation

The original 6 core areas + cross-cutting features are unchanged.

---

## New Phase 3 specs added to backlog

Three new specs, each to be run as its own Phase 3 session:

1. **`docs/specs/brand-dna-assessment.md`** — THE premium differentiator. Likely the largest spec session in all of Phase 3. Load canonical brand voice + visual identity skills at session start. Question bank design and signal taxonomy are the load-bearing creative work. Must be locked **before** `onboarding-and-segmentation.md` because the onboarding spec composes it.

2. **`docs/specs/onboarding-and-segmentation.md`** — composes Brand DNA + Revenue Segmentation into retainer and SaaS onboarding flows. Defines the Revenue Segmentation primitive (the ~5-min standardised questionnaire), the `brand_dna_status` field and "hot upsell candidates" filter logic, and the dashboard-nudge UX for SaaS customers.

3. **`docs/specs/content-engine.md`** — the semi-autonomous SEO pipeline. Best sequenced after both Lead Gen (reuses Resend cold-outreach patterns, Claude chat primitive, SerpAPI integration plumbing) **and** Brand DNA Assessment (blog generation prompts read Brand DNA profile as context per the new memory).

**Recommended build order** (final ordering is Andy's call per session):

Lead Gen → Intro Funnel → Quote Builder → Branded Invoicing → **Brand DNA Assessment** → **Onboarding + Segmentation** → Client Management → SaaS Subscription Billing → **Content Engine** → Unified Inbox → Daily Cockpit → Setup Wizards → Hiring Pipeline

Reasoning:
- Lead Gen stays recommended-next (unchanged from Sales Pipeline handoff)
- Pipeline-adjacent specs (Intro Funnel, Quote Builder, Branded Invoicing) stay grouped
- Brand DNA Assessment sits before onboarding because onboarding composes it
- Onboarding sits before Client Management because retainer onboarding hands off to client management post-completion
- Content Engine sits late because it benefits from Lead Gen (Resend patterns, Claude chat), Brand DNA (context reading), and SaaS Billing (CTAs point at SaaS products)
- Daily Cockpit sits near the end because it surfaces signals from every other feature

---

## New memory created

**`project_brand_dna_as_perpetual_context.md`** — the principle that Brand DNA is not an onboarding artefact; it is the perpetual reference document every downstream LLM-touching feature reads as context at generation time.

Seven application rules documented in the memory file. Most important: **every spec session for an LLM-touching feature must read the Brand DNA profile as context**. If a spec proposes building prompts without reading the profile, stop and reopen.

Graceful degradation when profile is absent (falls back to canonical brand voice skill + business context skill) is mandatory — never fail hard, always degrade to "generic SuperBad voice."

`MEMORY.md` index updated.

---

## Hardest parts carried forward

1. **Brand DNA question bank authorship.** 50–100 genuinely good indirect-signal questions per mode is real creative work. Biggest single risk to feature quality. Generic questions = pretty form that collapses. Great questions = the most distinctive thing in Lite. The spec session will lean heavily on `superbad-brand-voice` and `superbad-visual-identity` skills.

2. **Signal tag taxonomy.** Every MC option carries invisible tags. Defining the taxonomy (visual vectors, pace vectors, humour vectors, decade vectors, language-register vectors, etc.) is a design problem that must be solved before questions can be written — question options have to map onto it. Non-obvious prerequisite.

3. **Multi-stakeholder blending logic.** Q7b's blending algorithm is a non-trivial Claude synthesis prompt — reads N sets of signal tags from different participants and produces a layered profile (shared org DNA + individual voice layers). Real spec deliverable, not a hand-wave.

4. **Content engine voice drift over time.** Even with the rejection chat loop, LLM output tends toward generic. Brand DNA context helps enormously but prompts still need periodic tuning. Long-term maintenance reality, not a v1 blocker.

5. **Cloudflare routing rule operational risk.** `/blog/*` path routing touches production DNS. Misconfiguration takes down the blog or collides with GHL paths. Mitigation: admin setup wizard for Content Engine includes an explicit "verify routing live" step.

6. **Brand DNA assessment fatigue.** 30+ min is long. Some clients won't finish. Mitigation: save-and-resume mandatory, first 5 minutes must be immediately illuminating ("huh, I've never thought about that" moments early).

7. **"Premium" framing risk.** Psychological profiling of founders is a sensitive line — some will recoil at "why do I need to answer personality questions for a marketing service?" Mitigation: wizard framing is explicit about *why* ("the best creative work is made by people who understand you deeply — this is how we understand you"), every question is skippable with a "profile quality reduced" indicator.

---

## Risks carried forward (new)

1. **SerpAPI cost blowout.** If the content engine queries SerpAPI aggressively for both topic discovery AND weekly ranking measurement, monthly costs can grow. Mitigation: cache aggressively, rate-limit ranking checks to weekly, monthly spend cap in config.

2. **Newsletter permission pass with low conversion.** If GHL import sends permission-pass emails and only 5% confirm, list starts near zero. This is the honest legal cost of doing it right. Not really a mitigation — better than the alternative.

3. **Brand DNA profile invalidation when client business pivots.** Re-run is supported but if the client's brand genuinely changes mid-engagement, downstream content generated against the old profile sounds wrong. Mitigation: versioned profiles, every LLM call reads current version, re-run is a visible affordance.

4. **Image-based question licensing.** Some assessment questions present image grids. Licensing (stock / curated / generated) is a spec-session detail but is a real cost/compliance surface.

---

## Key decisions worth flagging for the next sessions

1. **Brand DNA is perpetual LLM context, not an onboarding artefact.** Every LLM-touching spec must read it. New memory. Non-negotiable.

2. **Channel adapter pattern is reused across lead gen outreach AND content engine publishing.** Keep the adapter interface generic when the Lead Gen spec nails it down — Content Engine spec will reuse, not re-invent.

3. **Claude chat primitive is reused across setup wizards, content engine rejection flow, and probably several more features.** Keep the primitive generic when Setup Wizards or Content Engine spec nails it down.

4. **Contact import wizard is a general primitive with source adapters.** Sales Pipeline CRM can reuse it. Call out when writing Client Management / Unified Inbox specs.

5. **Revenue Segmentation primitive is reusable across retainer onboarding, SaaS onboarding, and potentially lead qualification later.** Keep the primitive generic when the onboarding spec nails it down.

6. **The brand-voice non-goal change is explicit, not implicit.** Newsletter is IN scope for SuperBad's own owned audience. Third-party email marketing campaigns for external entities remain OUT. Don't quietly expand this further without another explicit scope session.

7. **Content Engine spec should not be written without reading the Brand DNA Assessment spec first** — prompts depend on the profile structure. If Content Engine spec is tackled before Brand DNA Assessment (ordering override by Andy), flag this hard dependency.

---

## Open questions deferred to spec sessions

**Content Engine:**
- Rankability scoring heuristic (first pass: curated high-authority domain list)
- Ranking feedback loop (SerpAPI re-queries vs Google Search Console)
- Seed keyword bank generation + Andy-edited setup
- Blog visual theme (marketing surface tokens)
- `robots.txt` + sitemap handling during GHL co-existence
- Canonical URL strategy
- Publishing cadence / scheduler mechanics
- `prior_trial_shoot` segment tag targeting UX

**Brand DNA Assessment:**
- Signal tag taxonomy (THE prerequisite decision)
- Question count per bank (~50–100 is the target)
- Branching logic engine (state machine vs rules engine)
- Image-based question sourcing (stock / curated / generated) + licensing
- Progress persistence UX
- Multi-stakeholder blending synthesis prompt shape
- Profile versioning / re-run mechanics
- Skip question UX with "quality reduced" indicator

**Onboarding + Segmentation:**
- Final Revenue Segmentation question list (starter list in SCOPE §9)
- SaaS dashboard nudge UX (avoid nagging, tie to product value)
- "Hot upsell candidates" filter logic on the daily cockpit
- Retainer onboarding wrapper sequencing (welcome → Brand DNA → revenue → contacts → access grants)
- Upgrade-from-SaaS-to-retainer Brand DNA handoff ritual

None of these block `docs/specs/lead-generation.md` — the Lead Gen session can proceed immediately with the mini-brainstorm as additional read context.

---

## What the next Phase 3 session should do

**Recommended next session: Phase 3 — Lead Generation spec (unchanged).**

The Next Action block in `SESSION_TRACKER.md` is unchanged — Lead Gen remains recommended next. The three new specs from this mini-brainstorm join the backlog after Lead Gen and are sequenced per the "Recommended build order" above.

**Read in order:**
1. `CLAUDE.md`
2. `START_HERE.md`
3. `sessions/phase-3-sales-pipeline-handoff.md` (the spec this session directly builds on)
4. `sessions/phase-3-design-system-baseline-handoff.md`
5. **This handoff** (`sessions/phase-3-scope-patch-handoff.md`)
6. `SCOPE.md` — especially "Lead generation & assisted outreach" AND the new "Additional v1 features (added 2026-04-11 mini-brainstorm)" section
7. `FOUNDATIONS.md`
8. `docs/specs/design-system-baseline.md`
9. `docs/specs/sales-pipeline.md`
10. `~/.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/MEMORY.md` — note the new `project_brand_dna_as_perpetual_context.md` entry

**Brainstorm rules unchanged.** One MC question at a time, recommendation + rationale, closed lists for scarcity decisions, default to splitting if new scope emerges.
