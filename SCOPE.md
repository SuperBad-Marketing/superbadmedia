# SuperBad Lite — Scope

**Phase 1 output. Locked 2026-04-11. Patched 2026-04-11 and 2026-04-12 via mini-brainstorms — see the four "Additional v1 features" sections below and the updated newsletter non-goal.**

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

## Additional v1 features (added 2026-04-12 mini-brainstorm #3)

One cross-cutting feature added to v1 scope in a third mini-brainstorm on 2026-04-12. Has its own Phase 3 spec session in the backlog and is subject to the same design principles and build disciplines as the core areas. Unlike the other added features, this one is **not a module you visit** — it touches every user-facing surface in Lite.

### 13. Surprise & Delight (cross-cutting voice + hidden eggs)

**Purpose:** make Lite feel like SuperBad wrote it, top to bottom, without burning out the voice. Two layers:

- **80% ambient voice** — always-on dry observational copy in a **closed list** of six surface categories (empty states, error pages, loading copy, success toasts, placeholder text, morning brief narrative). Concentration is what makes it land. Voice wallpaper kills voice magic. Every ambient line is Claude-generated via a new `generateInVoice()` primitive and passes the Brand-Voice Drift Check (Foundations §11.5) against SuperBad's own Brand DNA profile. Andy authors zero lines. Honours `feedback_no_content_authoring` and `feedback_dont_undershoot_llm_capability`.

- **20% hidden eggs** — rare Metal Gear Solid-tradition moments where Lite demonstrates it's been watching. The reward is never content — it's *"oh, Lite noticed."* Rarity is the whole mechanic. One canonical admin egg locked (CRT turn-off after three 2am late-night sessions: *"you've been up until 2am three nights running. I'm pulling the plug."*). Twelve public eggs locked in the spec catalogue, spanning late-night visitors, Sunday researchers, Melbourne public holidays (reuses the `/data/au-holidays.json` from Foundations §11.4), fifth-time visitors, LinkedIn referrals, "cheap/discount" Google intent, rapid scrollers vs deep readers, abandoned tabs, Melbourne rain (Open-Meteo), and a structural public CRT turn-off equivalent that closes the site between 1am–7am Melbourne local.

**Tone asymmetry:**
- **Admin (signed-in Andy or staff)** → roommate voice. Can push into Psycho Mantis territory — fourth-wall, surveillance-adjacent, cheeky — because he's opted in to the platform.
- **Public (marketing site, pre-acceptance quote pages, lead forms)** → bartender voice. Attentive, dry, never accusatory, never reveals invasive knowledge, **never pitches**. Selling kills the magic.
- **Customer portal / SaaS dashboard** → bartender voice with slight opted-in latitude. Never pushes into admin-roommate territory.

**Public knowledge ceiling:** only browser-freely-given data may feed triggers on public or customer surfaces — local time, timezone, referrer, tab state, scroll, cookies, public weather APIs, day-of-week, holiday calendars. Never IP geolocation, ISP, or GPS. **The joke is SuperBad noticing obvious things nobody else notices, not demonstrating forbidden knowledge.**

**Cadence:**
- **Public visitors** — **one guaranteed first-visit egg** (fallback welcome egg fires at session-end if no situational trigger matched), then max 2 per rolling 14-day window.
- **Authenticated users** — max 1 per 7-day rolling window.
- **Crossover preserved** — a public visitor who logs in mid-session keeps their earned egg history (transferred from cookie to user record).

**Context-aware suppression:** hidden eggs are hard-gated during mid-payment, mid-email-compose, quote acceptance, error recovery, wizard steps, first-ever authenticated login, and the first 30 seconds of any session. Fail-closed; ambiguous state = no fire.

**Riddle loop (Q2 path):** hidden eggs are also reachable via social-media riddles. Answer resolves in a public search bar, a dedicated `/say/[answer]` URL, or the admin search bar — **all three surfaces route through a single shared `resolveRiddleAnswer()` resolver**. Logged-in askers get a richer reward with a tiny persistent trace in their account; public askers get a public reward. **Wrong answers get dry micro-responses** — hybrid architecture: 5–7 pre-generated common-wrong responses per riddle + live Claude fallback for novel wrongs, capped at ~100 unique calls per riddle lifetime with a pre-generated catch-all beyond that. Wrong-answer responses also pass the drift check. Riddles and reward content are all Claude-generated; Andy authors none of it.

**Kill switch:** Settings → Display → "No tricks" toggle for authenticated users; a small footer "No tricks" link sets a cookie for public. Ambient layer cannot be disabled — ambient IS the voice, and disabling the voice is disabling SuperBad.

**Silent dependency on `brand-dna-assessment.md`:** this spec can be written (it is) but cannot be **built** before Brand DNA Assessment ships AND Andy has taken SuperBad's own assessment (Founder + Business profiles). The drift check grades every voice line against SuperBad's own Brand DNA profile; without the profile, there is nothing to grade against. Phase 3 backlog ordering reflects this — Brand DNA stays ahead of Surprise & Delight; Phase 5 build order is Brand DNA feature → SuperBad's own assessment run → Surprise & Delight build.

**Technical footprint:**
- New tables: `riddles`, `riddle_resolutions`, `hidden_egg_fires`, `ambient_copy_cache`.
- New user columns: `last_hidden_egg_fired_at`, `hidden_egg_tricks_enabled`, `fired_egg_ids_recent`.
- New Claude primitives: `generateInVoice(slot, context, brandDnaProfile)` and `resolveRiddleAnswer(input, context)`.
- Trigger evaluators live in `lib/eggs/triggers/*.ts` — one file per egg, pure functions, deterministic rules over real event data. No ML, no fuzzy derivation, fail-closed, unit-tested against fixture data.
- Cost architecture: Haiku-tier for drift check + ambient generation + novel wrong-answer fallback; Opus-tier only for riddle reward content. Sub-$5/month estimated total.

**Closed-list exemptions:** hidden-layer effects (CRT turn-off motion, rain ambient sound sample) are **explicitly exempt** from the Tier 2 motion closed list in `docs/specs/design-system-baseline.md` and from the sound registry in Foundations §10, because they fire at most once-per-month-per-user. Each exemption is named explicitly in the spec; unnamed hidden effects do not exist.

**New build-time disciplines added by this spec:** 19 (every ambient line routes through `generateInVoice()` + drift check), 20 (triggers read real event data only, fail closed), 21 (every hidden egg fire logs trigger evidence), 22 (singular riddle resolver — one function, many surfaces), 23 (hidden-layer closed-list exemptions are explicit or nonexistent).

**Aligned memories:** `feedback_surprise_and_delight_philosophy` (the canonical philosophy document — source of truth for tone, cadence, and boundaries), `feedback_no_content_authoring` (Andy authors nothing), `feedback_dont_undershoot_llm_capability` (Claude generates ambient + reward content without labelled training data), `feedback_curated_customisation` (closed list of ambient surface categories; closed list of eggs; never user-configurable), `feedback_individual_feel` (eggs make each surface feel noticed rather than processed), `project_brand_dna_as_perpetual_context` (SuperBad's own Brand DNA profile is what the drift check reads against).

**Out of scope for v1:** achievements / streaks / points / levels / badges / collectables / any gamification mechanic, egg discovery surface, multi-language voice treatment, user-configurable eggs, public API for the riddle loop, analytics dashboards beyond the raw `hidden_egg_fires` log, any behavioural surface that rewards frequency of use.

**Follow-up brainstorm owed:** 3–5 additional admin eggs beyond the canonical CRT turn-off, to give Phase 5 enough variety for rotation. Out of scope for this spec; scheduled before Phase 5 build session for this feature.

---

## Additional v1 features (added 2026-04-12 mini-brainstorm #4)

One operational-spine feature added to v1 scope in a fourth mini-brainstorm on 2026-04-12. Has its own Phase 3 spec (`docs/specs/task-manager.md`), is load-bearing for `docs/specs/client-management.md` (deliverables), and is composed by the Daily Cockpit, Client Portal, Comms Inbox, and future entity profile pages.

### 14. Task Manager (+ Braindump primitive)

**Purpose:** Andy's operational spine. A proper task manager with due dates, priorities, checklists, recurrence, filters, and entity links — plus a globally-available braindump primitive that turns messy natural-language capture into parsed, entity-linked, structured tasks via Claude, with in-place human review before commit.

**Two surfaces:**
- **Task Manager module** at `/lite/tasks` — list view with filters (status, kind, priority, due, entity, has-braindump-source), right-side detail drawer, search, bulk delete.
- **Braindump primitive** — globally available floating bottom-right button + `Cmd+Shift+D` shortcut on admin surfaces only. Opens a modal with a textarea → Claude parses on submit → proto-task cards render in-place → user edits / resolves entity ambiguity via `⇄` swap affordance → commits. Raw text persisted in `braindumps` table. Never mounted on customer-facing surfaces (shell-level decision, not URL-based).

**Deliverables are tasks.** Client deliverables move from a hypothetical Client-Management-owned data model to a `kind='client_deliverable'` row in the shared `tasks` table with approval workflow attached. Client Management references this spec rather than defining its own deliverables model. This is the load-bearing architectural decision for downstream specs.

**Entity linking (polymorphic-by-convention):** every task has nullable `entity_type` + `entity_id` columns following the `activity_log` pattern. Linked tasks surface on the entity's profile page (client, lead, prospect, deal). Kind + entity link together determine client portal visibility: only `client_deliverable` and `client_task` with `entity_type='client'` surface to the matching client portal.

**Closed `kind` enum (5 values):** `personal`, `admin`, `prospect_followup`, `client_deliverable`, `client_task`. Additions require a brainstorm gate.

**Closed `status` enum (7 values):** `todo`, `in_progress`, `blocked`, `awaiting_approval`, `delivered`, `done`, `cancelled`. State machine validated in `lib/tasks/transitions.ts`. Kind-aware UI — `awaiting_approval` and `delivered` only valid for `client_deliverable`.

**Approval workflow for deliverables:** dual-entry — tokenised magic-link email (transactional, bypasses Foundations §11.4 outreach quiet window) OR direct portal visit. Single `approveDeliverable(taskId, decision, feedback?)` primitive in `lib/tasks/approve.ts` — the only code path for deliverable approval, forking is a code-review reject. Rejection feedback surfaces as an inbound message in the comms inbox with `source='task_rejection'`. 48h unacknowledged reminder respects the quiet window (one step closer to nagging).

**Recurrence:** preset enum only (`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`) + `recurrence_day` integer. Auto-spawn on completion via `markTaskDone()`, not on calendar cron. Irregular patterns ("first Thursday of month") handled manually in v1. Task templates flagged as v1.1 concept.

**Checklists:** optional inline, stored as JSON column. Parser emits checklists for countable phrasings ("4 instagram posts"). Per-task `checklist_auto_complete` boolean (default true) auto-transitions the task on final-box check. Transition shows a visible Tier 2 toast with a 10s undo window.

**Cockpit integration (locked):** tasks are one of many data sources feeding the Daily Cockpit's existing Kanban columns — cockpit consumes, does not re-derive. Column rules: **Must Do** = overdue OR (due-today AND priority=high); **Should Do** = due today, normal/low priority; **If Time** = due within 7 days AND priority=high. `awaiting_approval` and `blocked` tasks stay **off** Must Do / Should Do / If Time (attention is external, not Andy's) and surface as passive counts in the narrative morning brief. Cockpit is read-only against tasks — no edit, no drag, no create. Clicking a cockpit task card opens the Task Manager drawer.

**Notifications (minimal + gated morning digest):**
- Client-facing: approval request email (transactional, instant), 48h reminder (respects quiet window), approval outcome email to Andy (transactional, instant).
- Andy-facing: zero push notifications on his own tasks; cockpit is the primary surface.
- **Morning digest** at 08:00 Melbourne, gated by two conditions (both required): (1) Andy has not signed in to `/lite` between 00:00 and 08:00 that day, (2) there is something to report (≥1 overdue, ≥1 due-today, OR ≥1 new approval outcome since yesterday's digest). Terse bucketed list (Overdue / Today / Approval news), no prose, subject line via `generateInVoice()`, static dry fallback pre-Brand-DNA. Toggle in Settings → Display, default on.
- Braindump ingestion: silent. Review modal IS the notification.

**Technical footprint:**
- New tables: `tasks`, `braindumps`.
- New Claude primitive: `parseBraindump(rawText, surfaceContext?)` — Haiku-tier, single call per commit, returns typed `ParsedBraindump` with confidence scores and entity candidate arrays for ambiguity resolution. Reads Brand DNA profile, today's date, Andy's timezone, and recent contacts/clients for entity matching.
- New Claude primitive: `approveDeliverable(taskId, decision, feedback?)` — single code path for deliverable approval, validates session/token binding, transitions status, fires cockpit signal + inbox message on rejection, idempotent.
- New helper: `lib/tasks/transitions.ts` — state machine validator.
- New helper: `lib/tasks/queries.ts` with `getTasksForClientPortal(clientId, sessionContactId)` — data-layer filtering, never trust caller.
- New helper: `lib/tasks/notifications.ts` — thin module for the two client-facing sends, cockpit signal wiring, and the 08:00 digest cron.
- New helper: `lib/tasks/digest.ts` — Cloudflare cron at 08:00 Melbourne, applies gate conditions, generates + sends digest via `generateInVoice()`.

**Build-time disciplines added by this spec (24–29):**
- **24.** Task state transitions go through `lib/tasks/transitions.ts` — bypassing is a code-review reject.
- **25.** Deliverable approval goes through `approveDeliverable()` only — one function, multiple surface bindings.
- **26.** Braindump ingestion goes through `parseBraindump()` only — no second parser.
- **27.** Braindump is never rendered on customer-facing surfaces — mount decision is shell-level, not URL-based.
- **28.** Client portal task visibility goes through `getTasksForClientPortal()` only — authorisation is data-layer, not caller-layer.
- **29.** Every task-related email send declares its `classification` ('transactional' | 'outreach') at the send gate call site — missing classification is a runtime error.

**Foundations §11 patch owed (Phase 5):** `sendEmail()` gate (§11.2) gains a required `classification: 'transactional' | 'outreach'` parameter. Transactional bypasses §11.4 outreach quiet window; outreach respects it. Formalises the rule that approval request emails fire instantly regardless of time of day while reminder-to-action nudges respect the window.

**Cross-spec flags:**
- **Client Management (#8)** — deliverables are tasks via this spec. Do not define a separate `deliverables` table; reference `tasks` filtered by `kind='client_deliverable' AND entity_type='client' AND entity_id=:client_id`. The approval workflow is the one defined here. Flag in the backlog entry.
- **Daily Cockpit (#12)** — Task Manager joins the cockpit's data sources list. Column rules above are the contract; cockpit consumes, does not re-derive. Flag in the backlog entry.
- **Comms Inbox (#11)** — gains a nullable `linked_task_id` column and a new `source` value `'task_rejection'`. Rendering treatment for that source flagged for the comms-inbox spec.
- **Client Portal** (rolled into Client Management #8 until/unless split) — renders portal-visible tasks as read-only except for the Approve / Reject action on `awaiting_approval` rows. Flag when that surface is specced.
- **Intro Funnel (LOCKED)** — potential retrofit for post-shoot reflection follow-up actions to become auto-generated `client_task`/`client_deliverable` rows. Out of scope now; flag for future retrofit session.
- **Sales Pipeline (LOCKED)** — Pipeline Deal cards could render a task-count badge via `WHERE entity_type='deal' AND entity_id=:deal_id`. Out of scope now; flag for Phase 5 build integration.

**Aligned memories:** `feedback_no_content_authoring` (Andy authors nothing — braindump parser + digest subject via `generateInVoice()`), `feedback_curated_customisation` (closed enums for kind + status + recurrence, no sliders or pickers for notification preferences), `feedback_primary_action_focus` (drawer not modal on list page, no alternate UX paths), `feedback_dont_undershoot_llm_capability` (braindump parser ships in v1, no "wait for training data" deferral), `feedback_individual_feel` (client portal deliverable cards feel like the client's own work, not a shared task board), `project_brand_dna_as_perpetual_context` (parser + digest subject read Brand DNA).

**Out of scope for v1:** task templates (flagged v1.1), subtasks (checklist replaces), task dependencies (blocking chains), shared-assignee / team tasks (single operator), time tracking / estimates, per-task notification preferences, drag-and-drop reordering, calendar integration beyond manual due-date set, irregular recurrence patterns ("first Thursday of month" handled manually), bulk edit UI beyond bulk delete, AI task suggestions ("Claude thinks you should do this" surface — Lite responds to Andy's intent, doesn't generate its own agenda).

**Voice & delight treatment per S&D cross-cutting rule:** empty states, loading copy, placeholder text, morning brief narrative (passive task counts), and the braindump modal placeholder all use `generateInVoice()`. Success toasts are silent except on the checklist-auto-complete undo window. No new hidden eggs proposed. **Sprinkle claimed from `docs/candidates/sprinkle-bank.md`:** §2 browser tab title (dynamic — `"SuperBad Lite — 4 overdue"` vs `"SuperBad Lite — nothing's on fire"`). Mark `[CLAIMED by task-manager]`.

**Silent dependencies:** none hard. Task Manager can be built as soon as Phase 5 starts — it has no un-shipped prerequisite. `generateInVoice()` falls back to static dry lines pre-Brand-DNA and pre-S&D. Task Manager should be high-priority in Phase 5 ordering because five downstream specs consume it.

---

## Additional v1 features (added 2026-04-12 mini-brainstorm #5)

### 15. Finance Dashboard (operator-only)

**Purpose:** Andy's financial visibility surface. P&L, projections, expenses, and reporting — all in one place inside Lite, so he never needs to open a spreadsheet or log into Stripe's dashboard to understand the business's financial position.

**Operator-only for v1.** No client-facing financial views. Client-facing spend/ROI reporting is a natural v1.1 add once the data's flowing.

**Data sources:** Stripe billing data (subscriptions, invoices, payments), quote values from the Quote Builder, manual expense entry for costs Stripe doesn't see (software subscriptions, contractor costs, equipment, etc.).

**Core surfaces (Phase 3 spec session will lock the detail):**
- **P&L view** — revenue vs expenses over time, filterable by period
- **Projections** — forward-looking revenue based on active retainers, subscriptions, and pipeline deals
- **Expense tracking** — manual entry for non-Stripe costs, categorised
- **Reporting** — exportable summaries for BAS/tax time, per-client revenue breakdowns

**Sequencing note:** best specced after Branded Invoicing (#4) and SaaS Subscription Billing (#9) are locked, since those specs define the revenue data model this feature reads from.

---

## Additional v1 features (added 2026-04-13)

### 16. Cost & Usage Observatory (operator-only)

**Purpose:** Andy's cost-attribution surface. Every external API/LLM call (Anthropic, Stripe, Resend, Meta/Google Ads, SerpAPI, Pixieset, Graph API, etc.) logs a cost tuple at the call site. The Observatory aggregates and visualises that data so Andy can see where tokens and API spend are going, and decide whether a background task is runaway, a feature is unexpectedly expensive, or a subscriber/client is disproportionately costly.

**Operator-only for v1.** No client-facing usage views beyond what SaaS Subscription Billing already surfaces to subscribers (their own usage against their tier cap).

**Split dimension — INTERNAL vs EXTERNAL:**
- **Internal** — Andy's own operations: outreach writer, ICP scoring, reply classification, Brand DNA runs for SuperBad itself, admin-side LLM calls, ad spend on SuperBad's own campaigns.
- **External** — costs attributable to a specific client or SaaS subscriber: per-client Brand DNA assessments, Content Engine runs per subscriber, per-client email sends, per-client ad campaign spend.

**Core surfaces (Phase 3 spec session will lock the detail):**
- Total cost over time, split internal vs external
- Drill-down by job name (what code path is spending) — uses the LLM model registry job keys + analogous keys for non-LLM APIs
- Drill-down by actor (which client/subscriber accumulated what cost)
- Anomaly flags — runaway background task, feature cost per run exceeds expected band, a subscriber's usage cost approaching or exceeding their tier revenue
- "Where is the money going" summary — plain-English narrative for the morning cockpit

**Plumbing dependency:** requires a FOUNDATIONS.md patch that generalises the LLM model registry logging into a broader external-call observability primitive — every API wrapper must log `{job, actor_type: internal|external, actor_id, units, estimated_cost_aud, timestamp}` at the call site. Retroactive patch across every locked integration spec (they currently don't require actor attribution).

**Sequencing note:** spec after Daily Cockpit locks (Cockpit may want to surface a cost-anomaly signal — cheap to build in now, expensive to bolt on later). Phase 3.5 backward reconciliation must diff every locked spec for missing call-site actor-attribution.

---

## Additional v1 features (added 2026-04-13 — Phase 3.5 SCOPE reconciliation)

These four features had full Phase 3 specs but were never promoted to first-class SCOPE entries. Resolved at the Phase 3.5 Batch A stop point.

### 17. Branded Invoicing

**Purpose:** invoice generation and delivery for manual-billed clients (those paying via bank transfer / occasional Stripe one-off rather than Stripe's standard subscription flow). Owns the full invoice lifecycle: generation (auto or manual), pre-send review window, delivery (email + branded web view), overdue tracking, reminders, mark-as-paid, and the monthly self-perpetuating task chain that keeps invoices firing without Andy touching anything.

**Shape:** an invoice in Lite is "a branded financial document that happens to comply with tax law", parallel to Quote Builder's "a premium branded document that happens to transact". Web view + auto-generated PDF + inline Stripe payment.

**Directly downstream of Quote Builder** — consumes the `scheduled_tasks` worker primitive (Quote Builder's `manual_invoice_generate` + `manual_invoice_send` two-step chain). See `docs/specs/branded-invoicing.md`.

### 18. Intro Funnel (paid $297 trial shoot)

**Purpose:** SuperBad's customer-facing acquisition surface for the paid $297 trial-shoot offer. Covers the entire journey from first landing-page visit through the trial shoot itself and on to the retainer/SaaS decision. The primary acquisition surface for Arm 1 (retainer).

**Shape:** landing page → 3-section questionnaire (branched by business shape) → Stripe Checkout → booking flow → 60-minute on-site shoot → Pixieset gallery delivery → reflection questionnaire → retainer-fit recommendation → 60 days of portal access for non-converters. Drops cards directly at the Pipeline's **Trial Shoot** stage via `createDealFromLead()`. Supersedes the single "Paid intro offer" bullet under §1 Lead Generation.

**Delivers three artefacts per paying prospect:** 1× short-form video, 10 edited photographs, 6-week marketing plan *(see #19)*. See `docs/specs/intro-funnel.md`.

### 19. Six-Week Plan Generator

**Purpose:** produces the bespoke week-by-week marketing plan that ships as a trial-shoot deliverable alongside the video + photos. Framed as "what we'd implement if we were your agency" — the prospect can self-run it if they don't convert, or take it forward as the live retainer strategy if they do.

**Shape:** two-stage autonomous Opus generation (outline → weekly detail), reviewed and approved by Andy before any prospect sees the plan. On retainer conversion, the plan migrates as-is into Client Context as the client's active strategy — it is the retainer plan, just self-run until conversion. See `docs/specs/six-week-plan-generator.md`.

### 20. Hiring Pipeline

**Purpose:** parallel CRM for headhunting — tracking candidates through sourced, invited, trial, hired, bench, archived stages. Reuses the Sales Pipeline's `KanbanBoard` + `activity_log` primitives. Ships in v1.0 so the infrastructure is ready the moment a first-hire trigger fires, and so the outreach / ICP / reply-intelligence patterns already built for Lead Gen are reusable for recruiting without a later retrofit.

**Shape:** sourced → invited → trial → hired, with bench + archive side-stages. Shares the Unified Inbox `hiring_invite` reply-dispatch table, Cost Observatory's 8 hiring jobs, and Finance Dashboard's contractor-payments rollup. See `docs/specs/hiring-pipeline.md`.

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

## v1.1 / post-launch roadmap (not in v1.0 scope)

Features deliberately parked for v1.1 or later. Explicitly **not** in v1.0 scope — but captured here so Phase 4 doesn't accidentally fold them in, and so v1.1 planning has a starting list.

### v1.1 (post-launch, priority-ordered)

1. **Trial shoot pricing + framing revisit.** Revisit the $297 trial-shoot price with real v1.0 conversion data in hand. Two axes to review together — they're one decision, not two:
   - **Number:** test $297 vs $397 (same autonomous-approval bucket for >$500k target businesses; materially better margin + positioning if conversion holds). Only move the number after framing moves below are in place.
   - **Framing:** make the no-brainer visible on the outreach email + landing page — component-level value breakdown (shoot ≈ $400-600, bespoke 6-week plan ≈ $800-1500, 60-day AI planning portal), product-grade naming (not "trial"), and real scarcity tied to Andy's actual monthly capacity. Goal: preserve autonomous close (no sales call) while the price reads as serious rather than promotional.
   - Trigger: first ~30-50 paid trial shoots completed, so conversion-to-retainer rate is measurable per framing/price variant. Added 2026-04-15.
2. **Self-serve help / support surface** (client-facing). A help/FAQ page + guided support request flow for retainer clients so they aren't defaulting to emailing Andy for every question. Unified Inbox still routes channels; this is the missing *destination* for client-originated help. Added 2026-04-13 after honest day-in-life review.
3. **Editable autonomy rules surface** (admin). Admin UI to edit the per-feature autonomy thresholds currently stored as defaults in the `settings` table (invoice pre-send window length, outreach earned-autonomy thresholds, which AI drafts auto-send vs require review, reply-draft auto-send threshold, etc.). Foundation session in v1.0 provisions the `settings` table with defaults so v1.0 features read from it; v1.1 just builds the editor on top. Added 2026-04-13.
4. **Daily debrief capture** (admin, end-of-day). Guided 3–5 minute capture of offline events and conversations (calls made, in-person meetings, creative decisions, gut-feel notes) — writes into both perpetual LLM contexts (Brand DNA + Client Context Engine) so the offline layer doesn't leave the data model stale. Cockpit surfaces it as an optional end-of-day tile. Added 2026-04-13 after honest day-in-life review.
5. **Lite → personal calendar mirror.** One-way sync from Lite's native calendar (shoots, scheduled comms, key dates) into Andy's personal Gmail calendar so the "Lite is my only calendar" rule doesn't leave him blind on his phone outside Lite. One-way only (Lite → Gmail); reverse direction stays out of scope. Added 2026-04-13.
6. **Twilio voice integration.** Click-to-call from a contact/client profile, recorded + transcribed + auto-logged into activity feed and Client Context Engine. SMS via Twilio is already in v1.0 (Intro Funnel). Voice extends the same vendor — adapter, not a new integration. Added 2026-04-13.
7. **Video call integration** (Zoom / Teams / Google Meet). Schedule, join, and auto-log meetings into activity feed + Client Context Engine. Transcription + summary via existing LLM plumbing. Separate from Twilio voice because vendor surface is completely different. Added 2026-04-13.
8. **Shoot planner.** End-to-end planning surface for shoots — shotlists, storyboards, briefs, strategy + rationale write-ups — producing both internal working docs (crew/Andy) and client-facing artefacts (pre-shoot brief, on-the-day call sheet, post-shoot rationale). Reads both perpetual LLM contexts (Brand DNA + Client Context Engine) so plans are grounded in who the client is and where they are. Take-away artefacts follow `feedback_takeaway_artefacts_brand_forward` (named, branded, cover pages); in-platform surfaces follow `feedback_individual_feel`. Added 2026-04-15.

### Content Studio (own post-v1.0 phase, not a v1.1 patch)

**Content Studio by SuperBad** — a standalone 2-tier SaaS product (Studio $19/mo, Pro $49/mo) for small-business owners and creators/photographers to make beautiful, on-brand social posts (the wedge) and build their own visual colour grades / LUTs (the depth feature). Mobile-first PWA + web dashboard. Bundled with retainer (Pro) and main SaaS (Studio) subscriptions; sold standalone otherwise. Replaces the previously-parked SaaS placeholders for LUT creator and image editor, which are now consolidated into this single product.

**Treated as its own post-v1.0 phase, not a v1.1 feature patch** — sixteen foundational decisions (locked 2026-04-15) add up to a v2-scale product (4–6 build waves of its own). Kickoff gated on main Lite being live and stable with paying customers; not built in parallel.

Full brainstorm: `docs/brainstorm/content-studio-brainstorm.md`. Added 2026-04-15.

### Prospecting & sales automation cluster (v1.1+)

Added 2026-04-14. A group of outreach/sales-intelligence features that extend the v1.0 outreach engine once it's running with real reply data. All read from both perpetual LLM contexts (Brand DNA + Client Context) and write findings back into the Contacts/Outreach data model — no standalone dashboards.

- **Buying signal monitor.** Watches verticals for new clinic openings, "marketing manager" job ads, Google review score drops, and competitor client losses. Fires warm prospects into the outreach queue with the trigger captured as context.
- **Ad Library spy.** Scrapes Meta Ad Library for businesses in target verticals running ads — especially ones running them badly. Prospects already have budget; the bad ads become the outreach hook.
- **Google Business auditor.** Pulls GMB data (review score, response rate, photo quality) to build an instant digital-health snapshot before outreach. Feeds the dossier + the observation hook.
- **Dossier builder.** One-click assembly of a complete prospect brief — principals, revenue signals, ad spend estimate, team size, recent news — ready for outreach or a call. Consumes the monitors above.
- **LinkedIn connection script.** Generates personalised connection requests + follow-up messages from the prospect's profile, recent posts, and business context. Subject to `feedback_outreach_never_templated` — end-to-end LLM per prospect.
- **Case study matcher.** Detects a lead's vertical and auto-serves the most relevant case study / social proof at the right nurture-sequence moment. Plugs into the v1.0 reply-intelligence router.
- **Objection content sender.** Monitors lead behaviour (link clicks, page views) to infer objections, then triggers the right piece of content — ROI article, FAQ, testimonial — automatically. Passive-channel delivery only per `feedback_passive_vs_active_channels`.
- **Pre-call prep kit.** Thirty minutes before a call, pulls everything known about a prospect into a one-page brief: gaps, goals, likely objections, recommended positioning. Earned-CTA moment per `feedback_earned_ctas_at_transition_moments`.
- **Proposal auto-writer.** From call notes / CRM data, writes a bespoke proposal in SuperBad voice — pain points, solution, pricing, ROI case. Dual-quote strategy per `project_dual_quote_strategy`. Take-away artefact rules per `feedback_takeaway_artefacts_brand_forward`.

### Already-parked items (referenced from memory / earlier scope)

- **Strategic planning feature** — goal setting + live progress tracking; needs real operational data to be valuable (memory `project_strategic_planning_postlaunch.md`).
- **Web buildouts as a service** — retainer add-on only; powered by Brand DNA + Client Context; v1.1+ (memory `project_web_buildouts_service.md`).
- **Ad campaign builder** (dual-use, LTV-based ROAS) — parked until ad builder brainstorms (memories `project_ad_builder_dual_use_and_creative.md` + `project_ad_campaign_builder_ltv_roas.md`).
- **Task templates + irregular recurrences** — v1.1 concept per Task Manager scope.
- **Client-facing spend/ROI reporting** — natural v1.1 add once Finance Dashboard data is flowing.
- **Staff RBAC** — fine-grained permissions deferred until first hire; v1 has a single role field only.
- **Meta channel integration** (Instagram / Facebook) — deferred past v1 due to Meta App review friction.
- **Full autonomous outreach send mode** — v1.0 gates outreach behind earned autonomy per track; full autonomy without manual approval is a later unlock.
- **Automatic inbound email reply detection** — v1.0 uses manual "They replied" button; automatic detection deferred.

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
