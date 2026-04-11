# SuperBad Lite — Scope

**Phase 1 output. Locked 2026-04-11. Patched 2026-04-11 (mini-brainstorm) — see §"Additional v1 features (added 2026-04-11)" below and the updated newsletter non-goal.**

Lite is a CRM-style operations platform for SuperBad Marketing. Internal-first, beautiful on top, boring underneath. This document captures what's in v1, what's explicitly out, and the design decisions locked during the Phase 1 brainstorm.

---

## The business shape Lite serves

SuperBad operates two arms, both managed through Lite:

1. **Creative Media & Performance Marketing (In-Person Retainer)** — full creative production + performance marketing retainers, priced per-client based on client-specified volume and scope of deliverables. There is no fixed public rate card. Every client gets a custom quote built inside Lite.

2. **Automated Subscription Services (SaaS)** — self-serve subscription products. Not yet built. Specific products are defined in Phase 3 spec sessions, one per product. Lite provides the generic infrastructure only (subscription billing, customer accounts, self-serve dashboards, products admin).

---

## URL structure

- `superbadmedia.com.au/lite` — **internal CRM / admin platform**. SuperBad employees only. Clients and SaaS subscribers never have access to this surface.
- `superbadmedia.com.au/get-started` (and similar public pages) — lead capture, public-facing marketing pages.
- **Client portals** — unique URL per client, containing only their own personal + business info, deliverables, invoices, and messaging with SuperBad.
- **SaaS customer dashboards** — unique URL per subscriber. Each subscriber's dashboard should feel like their own individual tool, not a shared community platform.

DNS, routing, and exactly how these URLs resolve is a Phase 2 Foundations decision and is blocked on resolving where `superbadmedia.com.au` DNS is managed.

---

## Core v1 areas (all in, none deferred)

### 1. Lead generation

**Multi-path ingress** — prospects enter the pipeline through several channels, each dropping them at the appropriate stage:

- **Public lead forms** on the marketing site → Lead stage
- **Paid intro offer** (Stripe Checkout on marketing site) → Conversation stage (pre-qualified by having paid)
- **Calendar booking** (embedded booking widget on marketing site) → Contacted or Conversation
- **Manual outbound entry** in Lite admin after cold outreach → Contacted
- **Referrals** entered manually → Contacted

**Assisted outreach (Claude-generated, Andy-approved):**
- Each prospect profile has a "Generate email" button
- Claude API generates personalised outreach using prospect context (website, industry, Meta ad activity, location, etc.)
- Andy reviews/edits in a modal, sends via **Resend API**
- Sent from a **dedicated subdomain** (e.g. `hi@contact.superbadmedia.com.au`) — never from the primary domain. Non-negotiable cold-email hygiene.
- Unsubscribe link + sender identity auto-appended (legal requirement under Australian Spam Act 2003)
- Activity logged on prospect profile
- Follow-up tracking: if no reply in X days, Lite suggests a follow-up draft

**Discovery + scoring** (optional pipeline filler):
- SerpAPI + Meta Ad Library API + a paid data source (e.g. Apollo.io) find and score qualified prospects
- Lite auto-creates prospect profiles from discovery, with scores surfaced in the admin

**Outreach metrics tracked in v1:**
- Sent (total, per day, per week, per vertical)
- Opens (via Resend's native tracking pixel)
- Clicks
- Replies (via manual "They replied" button; automatic detection deferred)
- Reply rate, conversion rate, time-to-reply
- Per-template performance, per-vertical performance

**Architecture baked in from day one for future extension:**
- **Send mode** parameter (`draft` vs `auto`) — flipping specific flows to autonomous send later is a config change, not a rewrite
- **Pluggable channel adapters** — email (Resend) now, later SMS (Twilio), Instagram DM (Meta), Facebook Messenger (Meta) slot in as new adapters without touching the rest of the system

### 2. Sales pipeline

**Kanban CRM** — deals are cards, dragged between stages. A single "status" field maps directly to the Kanban column; status can be updated by drag, by profile field change, or by automated action triggers.

**Stages (7):**
1. Lead
2. Contacted
3. Conversation
4. Quoted
5. Negotiating
6. Won *(graduates to client in Arm 1)*
7. Lost

**Automatic stage transitions:**
- Prospect created → Lead *(default)*
- "Contacted" button pressed / outreach logged → Contacted
- "They replied" button pressed → Conversation
- Package/quote sent via builder → Quoted *(fully auto)*
- "They came back with changes" button pressed → Negotiating
- Stripe subscription activated (webhook) → Won → graduates to client *(fully auto)*
- Manually marked "Lost" → Lost *(no auto-trigger — always a decision)*

Manual drag override always available.

**Deal card shows:** prospect name, company, vertical, source, stage, deal value (once quoted), last activity date, next action, contact details, notes.

### 3. Package / quote builder

**Andy builds the quote in Lite admin** during or after the sales call. Not self-service for the prospect.

**Catalogue-driven with override:** Andy configures a deliverables catalogue once (e.g. "Shoot day", "Ad creative set of 4", "YouTube episode", "Monthly ad management") with base prices. Building a package picks items from the catalogue × volume, shows a running subtotal. Andy can override any line or the total.

**Templates:**
- Explicit named templates (CRUD)
- Can be saved at quote creation OR retroactively from any client profile
- Starter template set seeded on day one (Medical Aesthetics Starter, Financial Services Starter, Allied Health Starter, etc.)

**Quote output:**
- **Polished web page** at a public URL — the wow surface, adds context and premium feel
- **Auto-generated 1-page PDF** — premium, clean, straight to the point, downloadable from the web page

**Acceptance flow:**
- Embedded **Stripe Payment Element** on the quote page — no redirect to Stripe, fully on-brand
- Tickbox terms agreement enables the Accept button → Payment Element captures card → Stripe subscription created → webhook fires → deal moves to Won → client record auto-created
- **No alternate/fallback UX in the primary flow.** Footer of the quote page has a small *"Issues? Email andy@superbadmedia.com.au"* link. Multi-signatory and edge cases happen off-platform.

### 4. Client management

**Hybrid model:** Lite owns delivery *management* (structure, deadlines, approvals, invoicing, content calendar). External best-of-breed tools (Frame.io, Google Drive, Adobe Premiere, etc.) own creative *production*. Lite is the traffic-control layer, not the creative tool.

**Client record (admin side, at `/lite`):**
- Profile: company, contacts, vertical, source, notes, activity log
- Package: current retainer details (from builder), Stripe subscription status, next billing date
- Deliverables list: monthly shoot days, ad creatives, episodes, etc. with status (scheduled / in progress / awaiting approval / delivered / uploaded)
- Content calendar
- Approvals queue
- Invoices (Stripe billing history)
- **External links section** — Google Drive folder, Frame.io project, gallery URLs (referenced by name in automated emails)
- Messages (from unified inbox)
- Latest comms feed

**Client portal (customer side, unique URL per client):**
- Their package + next billing date
- Upcoming deliverables
- Items awaiting their approval
- Invoice history + self-serve "update card"
- Message thread with SuperBad
- Links to external drives / Frame.io / galleries

**Action-triggered automations subsystem:** state changes inside Lite fire automated client communications. First example: deliverable → "uploaded" sends an email with the relevant folder/gallery link. Welcome on Won, approval requests, shoot reminders follow the same pattern. Exact trigger list + email template editor UI are Phase 3 spec work.

### 5. Daily planning (the cockpit)

**Primary view: narrative morning brief in SuperBad voice.** Generated each morning from underlying data (pipeline state, deliverables due, calendar, clients needing attention, revenue snapshot). 2–3 sentences summarising the state of the business.

**Alternate views** via a view-switcher in the header:
- **Kanban "today" board** — Must Do / Should Do / If Time columns, auto-pulled from deadlines and due dates
- **To-do list** — flat list view

**Design principle:** the today-view is for actionable items only. Full pipeline, client list, revenue totals live on their own screens in the main nav. The narrative brief *references* them but the cockpit doesn't clutter with read-only info tiles.

### 6. SaaS subscription billing (Arm 2 infrastructure)

Generic subscription infrastructure ships in v1 so specific SaaS products can be added in Phase 3 spec sessions without platform rework:

- **Products admin** — Andy configures SaaS products (name, pricing, features, etc.) in Lite admin
- **Subscription billing** via Stripe Billing
- **Customer accounts** with magic-link auth
- **Self-serve customer dashboards** — each subscriber has their own unique URL that feels like their own individual tool, not a shared community platform
- **Self-serve card updates, invoice history, cancellation** via Stripe Billing portal

Specific SaaS products are defined per-product in Phase 3 spec sessions.

---

## Additional cross-cutting features in v1

### Unified communications inbox

**Email-only in v1**, architected with pluggable channel adapters so Instagram DM / Facebook Messenger / SMS can be added in Phase 3 spec sessions without architectural rework.

- Inbox surface at `/lite` with threading, search, filters, per-channel views
- Bidirectional email (send + receive) via Resend (+ inbound webhook or IMAP)
- Contact matching: inbound messages matched to existing prospect/client records
- **"Latest comms" feed** on prospect and client profiles = filtered view of inbox for that contact
- Meta channels (Instagram, Facebook) deferred to Phase 3 due to Meta App review friction
- SMS inbox deferred alongside SMS outreach

### Setup wizards for all integrations

Any integration or configuration task that admins, clients, or SaaS customers need to complete is delivered through a guided, step-by-step wizard — not a raw form. The goal: non-technical users should never be dropped into a "paste your API key here" moment without being walked through exactly where to find it.

**Principle:** wherever setup friction exists, a wizard exists. No one — admin, client, or customer — should ever be stuck wondering "what do I do now?" during setup.

**Audiences and v1 scope:**
- **Admin setup (Andy, one-time):** Stripe, Resend + domain verification, Claude/Anthropic API, SerpAPI, Apollo (or equivalent), Meta Ad Library, DNS records for the cold-email subdomain
- **Retainer client onboarding:** brand kit, contacts, Meta/Google Ad account access grants (when SuperBad manages ads), content archive links
- **SaaS customer onboarding:** profile, payment, and whatever integrations each specific SaaS product requires (per-product in Phase 3)

**Shape of each wizard step (zero ongoing content authoring from Andy):**
1. **Short written instruction in SuperBad voice** — one or two dry, specific sentences. No paragraphs.
2. **OAuth button** wherever the service supports it (Google, Meta, Frame.io, etc.) — one-click.
3. **Direct link to the third party's own docs page** for that exact task (e.g., Stripe's "Find your API keys" doc). Third parties maintain their own screenshots — zero maintenance on our side, always current.
4. **Input field** for the value the user returns with.
5. **"Stuck?" button on every step → Claude-powered chat helper.** Uses the same Anthropic API already in scope for outreach generation. Opens with context ("step 3 of Stripe setup, trying to find your secret key"), answers follow-ups in SuperBad voice, clarifies unfamiliar terms. Scoped system prompt instructs Claude to say "I'm not sure — email andy@..." rather than guess. Small "this answer was wrong" button on every chat reply emails Andy the transcript.

**No manual media, ever.** No Looms, no hand-taken screenshots, no tutorial videos. If a task can't be explained with a short written instruction + third-party docs link + AI chat fallback, the task shouldn't exist in a wizard.

**What wizards are not:** not a no-code integration builder, not a marketplace, not a general product tour engine. Specifically for configuration tasks with real friction.

### Authentication & user model

- **Magic-link auth only** (no passwords), via NextAuth / Auth.js v5
- **Unified user table with role field.** Roles in v1: `admin` (Andy + SuperBad employees), `client` (retainer clients), `customer` (SaaS subscribers)
- One user can hold multiple relationships — e.g. a retainer client who also subscribes to a SaaS product — with both visible in their portal experience
- **Strict access boundaries enforced at the data layer:**
  - `/lite` admin surface — only `admin` role (SuperBad employees) can access. Clients and subscribers NEVER see this.
  - Client portal — only the specific client tied to that portal can access their own data
  - SaaS customer dashboard — only the specific subscriber can access their own subscription/dashboard
- Staff permissions (fine-grained access control for future hires) deferred to Phase 3 when first hire happens — no speculative RBAC engine in v1

---

---

## Additional v1 features (added 2026-04-11 mini-brainstorm)

Three features added to v1 scope in a mini-brainstorm on 2026-04-11, patching the original Phase 1 lock. All three are now part of v1, have their own Phase 3 spec sessions in the backlog, and are subject to the same design principles and build disciplines as the core areas.

### 7. Content Engine (internal marketing flywheel)

**Purpose:** a semi-autonomous SEO content engine for **SuperBad itself** — not a SaaS product sold to customers. Drives top-of-funnel for both the retainer arm and the future SaaS arm by building SuperBad's own organic search presence, owned-audience newsletter, and social channel output from a single source-of-truth blog pipeline.

**Channels (all three ship in v1):**
- **Blog** — keyword-optimised SEO posts published to `superbadmedia.com.au/blog/*`, routed through Cloudflare from the root domain to Lite's Coolify origin (same intermediate pattern Phase 2 already blessed for forms). Root-domain hosting is non-negotiable — the entire feature's ranking goal depends on it.
- **Newsletter** — each approved blog post is rewritten as an email for SuperBad's own opted-in subscriber list. Sent via Resend (already in stack). Unsubscribe + sender identity + `List-Unsubscribe` header mandatory (Aus Spam Act 2003).
- **Social drafts** — each approved blog post also generates format-specific drafts for Instagram, LinkedIn, X, and Facebook. **No auto-posting in v1** — drafts live in a review panel with download + copy actions, and a **Publish button per platform wired through a stub channel adapter**. Adapters can be swapped to real API calls later without any UI or data-layer change. No Meta app review required in v1.

**Topic strategy:** semi-autonomous keyword-driven SEO improvement.
- **SerpAPI** (already in stack for lead gen) runs keyword research from seed keywords derived from SuperBad's business context (services × verticals × locations from `superbad-business-context` skill).
- Each candidate keyword is **rankability-scored** against the top 10 SERP results — unwinnable keywords (dominated by high-authority domains) are filtered out, leaving only keywords SuperBad can realistically rank for.
- For each qualifying keyword, Claude generates a blog post using the real SERP data as context (competitor angles, search intent, featured snippet opportunity).
- Rankability scoring algorithm + ranking feedback loop (weekly SerpAPI re-queries vs Google Search Console integration) are spec-session decisions.

**Review loop: one gate per blog, fan-out is automatic.**
- Each generated blog post sits in a review queue.
- Andy approves or opens a **Claude-powered rejection chat** — he types a specific reason ("too corporate, pull it back — dry and observational, not motivational"), Claude regenerates using the original prompt + feedback as additional context. Chat thread persists on the draft so iteration history is visible. Same Claude chat primitive as the `setup-wizards` spec — **pattern reuse, no new infra**.
- On approval, the engine automatically generates the newsletter version and the social drafts from the approved blog. No second review gate downstream — one approval covers the whole fan-out.
- Cadence + scheduling are spec-session details.

**Newsletter list sourcing:**
- **Opt-in form** on the marketing site (and CTA inline in generated blog posts) for new subscribers.
- **Contact import wizard** for existing audiences, with two adapters in v1: **GHL export** and **CSV upload**. Prior trial shoot customers get imported via CSV with a `prior_trial_shoot` segment tag.
- **Every imported contact goes through a mandatory permission pass** — a "confirm you want to keep hearing from us" email. Only contacts who click confirm join the list. Legally identical to opt-in; protects sender reputation; respects the existing business relationship.
- Per-row audit trail: `consent_source` (`form_subscribe` / `ghl_import` / `trial_shoot_csv`) and `consented_at` timestamp on every subscriber.
- The contact import wizard is a **general primitive** with pluggable source adapters — the Sales Pipeline CRM can reuse it for historical Company/Contact import.

**Architectural boundaries** (build-time discipline — see `BUILD_PLAN.md` when written):
- Content engine is its own module with minimal coupling to the rest of admin.
- Prompts live in version-controlled files, never inlined in route handlers.
- Generate / review / publish are discrete stages with clean interfaces.
- Channel adapters (publish destinations) are pluggable — swap any stub for a real API without touching the rest of the engine.

### 8. Brand DNA Assessment

**Purpose:** a NASA-style psychological + taste profile of either the founder or the business, designed to be **the most effective brand discovery tool in the market**. Not a questionnaire; an assessment. Builds a profile so rich that downstream LLM-touching features can produce creative work, content, communications, and campaigns that sound authentically like the client *without having to ask them anything at the moment of generation*.

**This is SuperBad's premium retainer differentiator.** Also a load-bearing architectural asset — once completed, the profile becomes the **perpetual reference document** every downstream LLM call reads as context (content engine prompts, automated client communications, ad copy drafts, morning brief narrative tone, etc.). See `project_brand_dna_as_perpetual_context.md` memory.

**Two modes:**
1. **Founder Profile** — deep psychological + personal taste assessment of an individual human (the founder, a key stakeholder, etc.). Surfaces quirks, aesthetic preferences, pace, humour, risk appetite, things they'd never say, things they secretly want to be known for. Indirect-signal questions ("if your business was a film, who'd direct it?" — Wes Anderson / Nolan / Coppola / Gerwig / …). Answers carry invisible **signal tags** (`visual:symmetry`, `mood:whimsy`, `decade:70s`, `pace:patient`, etc.) that aggregate into a structured profile.
2. **Business Profile** — culture, values, positioning, voice, non-negotiables of the organisation as an entity. Distinct question bank from Founder Profile but same assessment architecture.

**Shape-aware delivery (directly serves the `project_client_size_diversity` memory):**
- Opening wizard question asks client type: **solo founder** / **founder-led small team** / **multi-stakeholder company**.
- **Solo founder** → Founder Profile only. Complete premium experience for that shape, never framed as "the lesser option."
- **Founder-led small team** → Founder Profile (on the founder) + Business Profile (on the business), sequentially. Save-and-resume.
- **Multi-stakeholder company** → Business Profile on the organisation **plus** optional Founder Profile sessions for however many key stakeholders the client wants to include. Each stakeholder takes their own session on their own unique link. Final profile is a **blend** — shared business DNA with individual voices layered in. Blending logic is a Claude synthesis prompt that reads N sets of signal tags and produces a layered profile document.

**Format:**
- **Multiple choice with text-override** on every question. MC is the primary signal (indirect questions surface preferences people can't articulate when asked directly); text-override is a safety valve.
- **~50–100 questions per bank**, with **vast branching and conditional logic** — early answers unlock later paths, narrow options, and open alternate question trees. Every client's journey is different.
- **Image-based questions** on some items — grid of images, pick the one that feels most like you. Image sourcing (licensed stock / curated moodboard / generated) is a spec-session detail.
- **Target duration: 30+ minutes**, premium over quick. Save-and-resume is mandatory.
- **Skippable questions** but with a visible "profile quality is reduced" indicator — never force, but make the cost of skipping visible.

**Output (dual-layer):**
- **Structured signal tag profile** — machine-readable, fed as context to every downstream LLM call for that client. The perpetual reference document.
- **Rich prose profile document** — human-readable, something the client can read, share internally, and feel proud of. Possibly also an aspirational **visual moodboard** assembled from public image sources matching the signal vectors.

**Re-run and versioning:** the profile can be re-taken annually or when the client's business evolves. Versioned, not destructive.

**Aligned memories:** `feedback_curated_customisation` (closed-list MC options, never sliders), `feedback_individual_feel` (genuinely unique per client), `feedback_no_content_authoring` (one-time spec-session authorship of the question bank, then autonomous), `project_client_size_diversity` (shape-aware delivery is the direct implementation of this memory).

### 9. Premium Onboarding + Revenue Segmentation

**Purpose:** the wrapper experience that composes Brand DNA, contact intake, access grants, and revenue segmentation into audience-specific onboarding flows.

**Two composable primitives:**
- **Brand DNA Assessment** (feature #8 above) — a standalone primitive reused across onboarding flows.
- **Revenue Segmentation** — a standardised short questionnaire (~5 min, ~8 MC questions) capturing structured fields for upsell targeting: current monthly revenue (range), business stage, current marketing spend (range), team size, biggest current constraint (closed list), 12-month goal (closed list), industry vertical, current tools. Final question list and closed-list options locked in the spec session.

**Retainer client onboarding (premium):**
- Triggered when a Deal transitions to `Won` via `won_outcome = 'retainer'`.
- Composes: **welcome ritual** → **Brand DNA Assessment** (required, shape-aware per §8) → **Revenue Segmentation** (required) → **contact intake** (existing setup-wizards work) → **ad account access grants + content archive links** (existing setup-wizards work).
- Feels premium end-to-end. No fallback UX in the primary flow — issues escalate to `andy@superbadmedia.com.au` per the `feedback_primary_action_focus` memory.

**SaaS customer onboarding (standardised, fast):**
- Triggered after Stripe Payment Element success on any SaaS product signup.
- Composes: **Revenue Segmentation** (required, same primitive) → **per-product configuration** (specific to each SaaS product, spec'd per product) → **product unlocked**.
- **Brand DNA Assessment is NOT in the SaaS signup flow.** SaaS signup is fast and conversion-sensitive.

**Brand DNA as a SaaS dashboard opt-in (upsell signal):**
- SaaS customer dashboards include a **prominent, regularly-nudged invitation** to complete the full Brand DNA Assessment through the dashboard — framed by value ("your [SaaS product] will be dramatically more personal once we know you properly"), never by guilt.
- `brand_dna_status` field on customer records: `not_started` / `in_progress` (with % complete) / `completed`.
- **Completion is a strong engagement signal.** A SaaS customer who voluntarily invests 30+ min in a deep assessment is demonstrating serious intent — they get surfaced in a "hot upsell candidates" filter on the daily cockpit for retainer upsell outreach.
- When a SaaS customer upgrades to retainer, any previously completed Brand DNA profile transfers directly into the retainer onboarding (no redo); if not previously completed, the upgrade flow triggers it as part of the premium onboarding ritual.

**Double segmentation layer for upsell targeting:**
- **Structured data:** revenue, spend, stage, team size, constraint, goal, vertical, tools.
- **Behavioural:** Brand DNA completion status + % progress + time invested.
- Intersection is the targeting layer — e.g. "$20K+/mo revenue AND completed Brand DNA AND 12-month goal = scaling → priority retainer pitch today."

**Reuse notes:** both primitives (Brand DNA, Revenue Segmentation) are designed to plug into any future onboarding flow — lead qualification, event signups, partner onboarding — without rewrite. Onboarding wrappers are thin compositions.

---

## Additional v1 features (added 2026-04-12 mini-brainstorm)

One feature added to v1 scope in a mini-brainstorm on 2026-04-12, patching the Phase 1 lock further. Has its own Phase 3 spec session in the backlog and is subject to the same design principles and build disciplines as the core areas.

### 10. Client Context Engine

**Purpose:** a per-contact always-on Claude engine that invisibly stores all relevant context about a prospect or client (comms, activity, action items, deal state, delivery status, invoices, Brand DNA profile), generates a living human-facing summary on the profile, and on-demand produces channel-aware draft follow-ups and replies.

**Paired with Brand DNA. Brand DNA answers *who they are at their core*. The Context Engine answers *where you are in the conversation with them right now*.** Together, every generated draft is authentically them AND in context. See the `project_two_perpetual_contexts` memory — neither context alone is sufficient and every LLM call touching a contact must read both.

**This is a v1 primitive, not a feature.** It's composed by at least four other specs (Sales Pipeline, Unified Inbox, Brand DNA Assessment, Lead Generation). Building it once as a shared primitive means the "generate reply" button appears the same way on every profile surface in the platform — no drift, no re-implementation. Lead Generation's "generate email" button becomes a special case of this primitive (empty-history cold draft).

**Audience scope:** prospects AND clients, single primitive. The moment a prospect replies to outreach they have comms history worth summarising, and the difference between a prospect and a client is a Stripe webhook, not a conversation shape. When a Deal converts to Won, the entire context history transfers to the client record with zero work — it's the same table underneath.

**Context breadth:** the engine reads from:
- Comms (email threads in Unified Inbox; SMS threads when Twilio lands)
- Activity log (Sales Pipeline's append-only log of stage changes, outreach sends, button presses, etc.)
- Action items (auto-extracted, see below)
- Deal state (current stage, last move, value if quoted)
- Delivery status (for clients: deliverables queue, approval status, content calendar state)
- Invoice state (for clients: Stripe billing history, overdue flags, next billing date)
- Brand DNA profile (as perpetual LLM context — see `project_brand_dna_as_perpetual_context.md` memory)

**Explicitly excluded:** private notes. Any note Andy writes about a contact marked as "private" stays strictly human-readable and is never passed to Claude. Hard boundary — even a strict system-prompt instruction cannot fully prevent tone bleed-through from private notes into drafts, and Andy's private observations may contain things that should never influence outgoing communications. Enforced at the query layer, not just the prompt layer.

**Engine posture — active summaries, reactive drafts:**
- **Summaries** are regenerated automatically when material events happen on the contact: new inbound / outbound comms, deal stage change, invoice paid, action item completed, deliverable approved, etc. Uses a fast cheap model (Haiku-tier) for cost efficiency. The summary is always fresh when Andy lands on the profile — no waiting, no loading spinner.
- **Drafts** are strictly human-initiated. The "Generate follow-up / reply" button is the only way a draft is produced. Uses Opus-tier model where creative quality matters most.
- **The engine does not raise its own attention flags.** Instead it emits structured signals (last contact age, action item status, relationship health score) that the Daily Cockpit consumes as one of its input streams. One attention surface (the cockpit), many data sources feeding it. Avoids the competing-surface problem.

**Action items — auto-extracted with manual override:**
- Every inbound and outbound message is read by Claude after delivery and any commitments are extracted as action items, each tagged with an **owner** ("you" vs "them") and a due date.
- Extracted items appear on the contact profile under a dedicated action items panel.
- Manual add is available for offline commitments (phone calls, coffee meetings, hallway conversations).
- Edit and dismiss controls for Claude's extractions — the safety valve when Claude misreads ambiguous language.
- **Spec-session flag:** distinguishing ownership cleanly ("I'll send the brief Tuesday" = them; "We'll get back to you with the quote Friday" = you) is a non-trivial prompt-engineering problem and should be a load-bearing part of the extraction prompt design.

**Draft interaction — hybrid one-shot with optional nudge field:**
- Click "Generate follow-up / reply". A draft appears in a one-shot surface (not a chat) — editable plain text, ready to send.
- Below the draft is a single "nudge it" text box, normally invisible or subdued. When the draft isn't quite right, Andy types "less formal" or "mention the shoot Thursday" and Claude regenerates with that feedback as added context.
- **Reuses the Content Engine's rejection-chat primitive** (locked 2026-04-11) — same Claude chat component, same regeneration pattern, same thread persistence model. Zero new infra.

**Channel routing — auto-pick with switcher:**
- The button auto-picks the channel based on the last successful channel with that contact. Email is the default when there's no history.
- A one-click channel switcher sits on the draft surface — if the engine guesses wrong, Andy switches and the same draft reformats for the new channel without losing the nudge context.
- **v1 is email-only** (Twilio integration is post-launch). The primitive is architected for channels from day one via the pluggable channel adapter discipline locked in Phase 2 Foundations. Adding SMS later is an adapter, not a rewrite.

**Invisible context store pattern:** raw data (threaded comms, event history, etc.) is hidden by default on the profile. The summary is the primary interface. A drill-down surface exists for when Andy needs to see the raw material, but it's not the main view. Keeps profiles calm and information-dense without being overwhelming.

**Cost architecture:** Haiku-tier for summary regeneration and action-item extraction, Opus-tier for drafts, per-action token caps, daily budget monitor, kill-switch wired into the Phase 4 Autonomy Protocol. Estimated baseline cost: sub-$100/month at current scale, scaling linearly with activity. Budget monitoring is mandatory.

**Aligned memories:** `project_brand_dna_as_perpetual_context` (Brand DNA is the complementary "who they are" context — both are read on every LLM call), `project_two_perpetual_contexts` (the pairing principle — neither context alone is sufficient), `feedback_no_content_authoring` (auto-extract over manual logging), `feedback_setup_is_hand_held` (no raw forms for action items — auto-extract is the default), `feedback_individual_feel` (each profile feels like its own engine, not a shared dashboard), `project_client_size_diversity` (context engine supports multi-contact companies — summaries roll up across a company's contacts).

**Composed-by and depends-on (for Phase 4 build plan):**
- **Depends on:** Sales Pipeline (locked), Unified Inbox (for comms schema), Brand DNA Assessment (as perpetual context), activity log schema (locked), Resend adapter.
- **Composed by:** Lead Generation's "generate email" button (becomes a call to this primitive with empty-history cold fallback), Client Management's profile surface (primary summary + draft tile), Daily Cockpit (consumes emitted signals), Sales Pipeline card hover (two-tier hover card uses summary as the primary text).

---

## Additional v1 features (added 2026-04-12 — upgrades shortlist)

Two features folded in from the 2026-04-12 upgrades review (`where-we-are.html` section 4). **Neither adds a new spec session to the backlog** — both fit cleanly inside existing planned specs. When those specs are written, reference this section rather than re-scoping from scratch. The other five upgrades from the same review are foundation-level primitives, not features, and live in `FOUNDATIONS.md § 11`.

### 11. Sentiment-aware reply drafts (Unified Inbox module)

**Folds into:** `docs/specs/unified-inbox.md` (when written — spec #11 in the Phase 3 backlog).

Every inbound prospect or client reply is read by Claude after arrival. The engine tags the reply's register (`warm` / `cold` / `curious` / `objection` / `excited` / `neutral`) and drafts a matching reply in the same register, surfaced inline in the thread view as a **suggested reply, never auto-sent**. Andy clicks Accept, Edit, or Dismiss. The feature collapses the "what do I say back" friction that kills momentum on live leads.

**Composes with:** the Client Context Engine (supplies the full contact context — conversation history, deal state, Brand DNA profile — that the draft prompt reads from) and the Brand-Voice Drift Check primitive (§11.5 in Foundations — every suggested reply passes the drift grader before being shown). No new Claude infrastructure — same primitive as outreach generation, Content Engine drafting, and Context Engine replies.

**Out of scope for v1:** sentiment over time, per-contact mood graphs, auto-send ever, proactive suggestion before Andy opens the thread.

### 12. One-click client data export (Client Management)

**Folds into:** `docs/specs/client-management.md` (when written — spec #8 in the Phase 3 backlog).

A single button on every client record: **"Export everything Lite knows about [Client Name]."** Output is a branded ZIP bundle containing:

- CSVs of comms history, deliverables, invoices, contacts, deal history, action items, and Brand DNA profile
- Branded PDFs of every invoice and quote that client has received (via the already-planned Puppeteer pipeline)
- A manifest listing linked external folders (Google Drive, Frame.io, galleries) by label and URL

**Purpose served:** trust signal for contract-end conversations, migration safety net, receipt of how well SuperBad handles the client's business. Doubles as a GDPR-style "data you hold on me" response if ever requested, with zero additional work.

**Architecturally:** pure composition of existing queries, the Puppeteer PDF generator (already earmarked in stack), and a `JSZip`-equivalent bundling step. **No new data models**, no new infrastructure, zero architectural risk. One admin handler, one download endpoint, one button.

**Out of scope for v1:** scheduled recurring exports, client-self-serve export (clients request via email for now), encrypted/password-protected ZIPs, selective-field export UI.

---

## Explicit non-goals for v1

- **Not a creative production tool.** No video editing, design surfaces, or Frame.io replacement.
- **Not a deep project management tool.** No Gantt charts, task hierarchies, or Asana replacement.
- **Not a general-purpose email marketing platform.** Outreach is one-to-one with manual approval. Lite does not act as a campaign manager for third-party entities, does not send to purchased lists, and does not offer broadcast-campaign tools for external use. *(Updated 2026-04-11 mini-brainstorm: SuperBad's own owned-audience newsletter — derived from Content Engine blog posts and sent to explicitly opted-in subscribers — is now in scope as part of the Content Engine feature. See §"Additional v1 features".)*
- **Not an SMS marketing platform.** SMS deferred to post-launch entirely.
- **Not a Meta-integrated app (yet).** No Instagram/Facebook channels in v1 — deferred to Phase 3.
- **Not a LinkedIn scraping tool.** Discovery uses legitimate paid data providers (Apollo or similar) — no scraping.
- **Not a multi-stakeholder approval workflow.** No multi-sig quote flow. Edge cases go to email.
- **Not a published rate card.** Retainer pricing is built per-client in Lite. No fixed public tiers.
- **Not a no-code automation builder.** Triggers are hardcoded with editable email templates. Zapier-style configurable triggers deferred.
- **Not a full RBAC permissions engine.** Role field exists; fine-grained permissions deferred until the first staff hire.

---

## Deferred to Phase 2 Foundations

- Tech stack confirmation (Next.js App Router, Drizzle, Auth.js v5, Resend, Stripe expected — locked in Phase 2)
- Database choice (SQLite recommended, confirm)
- Hosting choice (Vercel recommended, confirm)
- Domain + DNS access — **who manages `superbadmedia.com.au` DNS currently, and how do we get access?** Blocks everything URL-related.
- URL routing strategy (`/lite`, `/get-started`, client portals, customer dashboards — path-based? subdomain? separate projects?)
- Marketing site access from this working directory
- Design system baseline (colours, typography, motion tokens, sound effects for the "Apple-satisfying" feel)

## Deferred to Phase 3 spec sessions

- Each specific SaaS product (one spec per product)
- Exact automation trigger list + email template editor UI
- Approvals flow UI details
- Content calendar format (full calendar vs list vs timeline)
- Message thread vs email passthrough decision
- Inbox Meta channel integration (Instagram DM, Facebook Messenger)
- Full autonomous outreach send mode
- Twilio SMS outreach + SMS inbox
- Automatic email reply detection (inbound parsing)
- Staff role fine-grained permissions (when first hire happens)
- Package builder detailed UX
- Client portal detailed UX

---

## Design principles captured in Phase 1

1. **Beautiful on top, boring underneath.** Proven tech, minimal dependencies, maximum polish on user-facing surfaces.
2. **Individual-feel for customers.** Every customer-facing surface should feel like their own tool, not a shared community platform.
3. **No distracting UX in conversion flows.** Primary action is primary. Edge cases get a support contact, not an alternate path in the UI.
4. **Retainer pricing built per-client.** No fixed rate card. Every package custom.
5. **Pluggable-by-design for comms.** Send modes and channel adapters from day one.
6. **Manual approval where quality matters.** Generated content (outreach emails etc.) reviewed by Andy before send — quality and relevance over volume.
7. **Subdomain isolation for cold email.** Never send cold from the primary domain.
8. **Strict data-layer access boundaries.** Admin surface, client portals, and SaaS customer dashboards are isolated — no surface shows data across boundaries.
9. **Setup is hand-held, not self-served.** Any integration or configuration task is wrapped in a step-by-step wizard with guidance appropriate to a non-technical user. No one is ever dropped into a raw form without context.
