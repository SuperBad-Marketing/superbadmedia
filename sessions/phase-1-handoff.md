# Phase 1 Handoff — Scope Brainstorm

**Date:** 2026-04-11
**Status:** Complete
**Output:** `SCOPE.md`
**Next phase:** Phase 2 — Foundations Brainstorm

---

## What was decided

### Shape of the business Lite serves
- Two arms: (1) Creative Media & Performance Marketing in-person retainer, priced per-client inside Lite — **no fixed public rate card**; (2) Automated Subscription Services (SaaS), not yet built, generic infrastructure only in v1
- All legacy fixed retainer/flagship pricing removed from `superbad-business-context` skill
- Specific SaaS products defined one-per-session in Phase 3

### URL structure
- `/lite` — internal CRM for Andy + SuperBad employees only. Clients and SaaS subscribers NEVER see this surface.
- `/get-started` (and similar) — public lead/marketing pages
- **Client portals** — unique URL per client
- **SaaS customer dashboards** — unique URL per subscriber (must feel like their individual tool, not a shared community platform)
- DNS + routing specifics deferred to Phase 2 (blocked on DNS access — see below)

### Six scoped v1 areas (all in — none cut)

1. **Lead generation** — multi-path ingress (public forms, paid intro offer, calendar booking, manual outbound, referrals), assisted outreach (Claude-generated email via Resend from cold subdomain, Andy-approved manual send), optional discovery engine (SerpAPI + Meta Ad Library + Apollo.io), metrics (sent/opens/clicks/replies/rates). Architecture bakes in send-mode parameter and pluggable channel adapters from day one so Twilio SMS / Meta DMs slot in later without rewrite.

2. **Sales pipeline** — 7-stage Kanban (Lead → Contacted → Conversation → Quoted → Negotiating → Won → Lost) with automatic stage transitions driven by user actions and Stripe webhooks. Manual drag override always available.

3. **Package / quote builder** — Andy-built in admin, catalogue-driven with line-item override, explicit templates (saveable at creation OR retroactively from client profile), starter template set seeded on day one. Output: polished web page + auto-generated 1-page premium PDF. Acceptance via embedded Stripe Payment Element (no redirect). No fallback UX — "issues? email andy@" footer link only.

4. **Client management** — hybrid model: Lite owns delivery *management* (structure, deadlines, approvals, invoicing, content calendar), external tools own creative *production* (Frame.io, Google Drive, Adobe Premiere). External links section on client profile. Action-triggered automation subsystem (state changes fire emails — first example: deliverable → uploaded sends auto-email with folder link).

5. **Daily planning (the cockpit)** — narrative morning brief in SuperBad voice as primary view, generated from underlying pipeline/deliverables/calendar data. Alternate views via header switcher: Kanban "today" board + flat to-do list. Today-view is actionable items only — full pipeline/client list/revenue live on their own screens.

6. **SaaS subscription billing infrastructure** — Stripe Billing, products admin (Andy configures SaaS products inside Lite), customer accounts with magic-link auth, self-serve dashboards, self-serve card updates/invoices/cancellation via Stripe portal. Generic infrastructure only — specific SaaS products are Phase 3.

### Cross-cutting features in v1

- **Unified comms inbox** — email-only v1 via Resend (send + receive via webhook/IMAP), threading, search, per-channel filters. Contact matching to existing prospect/client records. "Latest comms" feed on prospect and client profiles = filtered inbox view for that contact. Pluggable channel architecture so Instagram DM / Facebook Messenger / SMS plug in later. Meta channels deferred to Phase 3 (App review friction). SMS inbox deferred alongside SMS outreach.

- **Setup wizards for all integrations** — every configuration or integration task (admin, client, customer) wrapped in a guided wizard. Shape per step: short written instruction in SuperBad voice + OAuth button where supported + direct link to the third party's own docs page for that task + input field + "Stuck?" button → Claude-powered chat helper. **Zero manual media authoring from Andy, ever.** No Looms, no manual screenshots. Third parties maintain their own screenshots via their own docs. Claude-powered chat is the hand-holding mechanism.

- **Authentication** — magic-link only (NextAuth / Auth.js v5), unified user table with `admin` / `client` / `customer` role field. One user can hold multiple relationships (retainer client who also subscribes to a SaaS product, both visible in their portal experience). Strict data-layer access boundaries: `/lite` admin-only, client portal scoped to single client, SaaS dashboard scoped to single subscriber. Fine-grained RBAC deferred until first staff hire.

### Design principles locked (9)

See `SCOPE.md` § "Design principles captured in Phase 1". Key ones to remember:
1. Beautiful on top, boring underneath
2. Individual-feel for customers (not communal)
3. No distracting UX in conversion flows
4. Retainer pricing built per-client
5. Pluggable-by-design for comms
6. Manual approval where quality matters
7. Subdomain isolation for cold email
8. Strict data-layer access boundaries
9. Setup is hand-held, not self-served

---

## Build risks flagged in Q7 reality-check

1. **Scope discipline is the real bottleneck.** Scope is coherent but large. Risk is drift during build — "while we're here, let's add X" across 30 sessions adds up fast. Phase 4 build plan must impose tight per-session scope. Velocity ceiling is not the constraint (Opus on max); coherence across sessions is.

2. **Third-party integration hell is underrated.** v1 touches 8 external services (Stripe Payment Element, Stripe Billing webhooks, Resend send, Resend inbound, NextAuth magic-links, Anthropic Claude API, SerpAPI, Apollo, Meta Ad Library). Each has its own failure modes. Integration debugging will eat more time than feature work.

3. **DNS / marketing site access is a hard blocker.** Everything URL-shaped in Lite depends on knowing where `superbadmedia.com.au` DNS is managed and whether Andy can actually access it. If the answer is "locked at a registrar nobody can log into," Phase 2 slows right down.

**Phase 4 ordering recommendation:** riskiest integrations first. Stripe webhooks → Resend inbound → magic-link auth → *then* any pretty UI work. Breaking those breaks the whole product; better to find out early.

---

## What was deferred

### To Phase 2 Foundations
- Tech stack confirmation (Next.js App Router, Drizzle, Auth.js v5, Resend, Stripe expected)
- Database choice (SQLite recommended, confirm explicitly)
- Hosting choice (Vercel recommended)
- **DNS access for superbadmedia.com.au** — THE #1 BLOCKER. Phase 2 must open with this.
- URL routing strategy (path-based vs subdomain vs separate projects)
- Marketing site location and access from this working directory
- Design system baseline (colours, type scale, motion tokens, sound effect approach)

### To Phase 3 spec sessions
- Each specific SaaS product (one session per product)
- Exact automation trigger list + email template editor UI
- Approvals flow UI details
- Content calendar format (calendar vs list vs timeline)
- Inbox Meta channel integration (Instagram, Facebook)
- Full autonomous outreach send mode
- Twilio SMS outreach + SMS inbox
- Automatic email reply detection (inbound parsing)
- Staff role fine-grained permissions (on first hire)
- Package builder detailed UX
- Client portal detailed UX

---

## Open questions for Phase 2

1. **Where is `superbadmedia.com.au` DNS managed, and how do we get access?** *(THE blocker)*
2. Where does the existing marketing site live (separate repo? hosting platform?), and how do we edit it from this working directory without tangling it with Lite?
3. Confirm stack: Next.js App Router + Drizzle + SQLite + Auth.js v5 + Resend + Stripe Payment Element + Stripe Billing?
4. Hosting: Vercel or reuse HQ's Coolify + DigitalOcean?
5. URL routing: path-based (`/lite`, `/get-started`, `/client-portal/:id`) vs subdomain vs separate Vercel projects?
6. Design system baseline — colours, type, motion tokens, sound effect approach for the "Apple-satisfying" feel

---

## Memory files saved during Phase 1

These persist across sessions. Read `~/.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/MEMORY.md` for the full index.

- `feedback_velocity_assumptions.md` — don't scope-cut for build time; Andy runs Opus on max
- `feedback_primary_action_focus.md` — no fallback UX in conversion flows; push edge cases to support email
- `feedback_individual_feel.md` — customer-facing surfaces feel individual, not communal
- `feedback_setup_is_hand_held.md` — every integration wrapped in a step-by-step wizard; no raw forms
- `feedback_no_content_authoring.md` — no Looms, no manual screenshots, no recurring tutorial copy; prefer automation/LLM/third-party-maintained content

Also edited during Phase 1: `~/.claude/skills/superbad-business-context/SKILL.md` — stripped all fixed retainer/flagship pricing, replaced "Two Service Lines" section with "Two Business Arms" structure (per-client pricing inside Lite for Arm 1; SaaS infrastructure placeholder for Arm 2).

---

## For the next session (Phase 2 kickoff)

1. Read in order: `CLAUDE.md` → `START_HERE.md` → this handoff note → `SCOPE.md` → `MEMORY.md`
2. Phase 2 protocol lives in `START_HERE.md § Phase 2`
3. **Open Phase 2 with the DNS / marketing site question.** Do not let any other Phase 2 question proceed until DNS access is resolved — everything URL-shaped depends on it.
4. Then work through stack → database → auth → hosting → design system per the protocol.
5. At the end of Phase 2, copy the relevant project skills from `/Users/Andy/superbad-hq/.claude/skills/` into `./.claude/skills/` per the START_HERE.md Phase 2 step 4 list.
6. Follow the same brainstorm rules: one multiple-choice question at a time, recommendation with rationale, plain English, proactive saves to `FOUNDATIONS.md` as decisions are locked.
