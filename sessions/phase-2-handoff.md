# Phase 2 Handoff — Foundations Brainstorm

**Date:** 2026-04-11
**Status:** Complete
**Output:** `FOUNDATIONS.md`
**Next phase:** Phase 3 — Feature Specs (one session per feature)

---

## What was decided

Full detail lives in `FOUNDATIONS.md`. Quick-reference summary of the 10 locked decisions:

1. **Framework** — Next.js App Router (React 19, TypeScript, Tailwind v4)
2. **Hosting** — Reuse HQ's existing Coolify on DigitalOcean. Lite ships as a second Coolify app beside HQ. No Vercel.
3. **URL routing (v1)** — `lite.superbadmedia.com.au` subdomain. Path-based cutover to `superbadmedia.com.au/lite` happens at Phase 6 launch (1–2 hour task, planned in).
4. **Marketing site** — GHL serves `superbadmedia.com.au` today. **Nothing in GHL is worth preserving** — leads already live in HQ. Lite replaces GHL's public surfaces as part of its own build. Marketing site editing from this repo is deferred to Phase 6 cutover.
5. **Database** — SQLite + Drizzle ORM + WAL + FTS5, continuously replicated to Cloudflare R2 via Litestream.
6. **Auth** — Auth.js v5 (NextAuth), magic-link only, Drizzle adapter, single unified `users` table with `admin | client | customer` role field.
7. **Email** — Resend for all three roles: transactional (magic-links, receipts), cold outreach (from isolated subdomain), inbound (webhook parsing into unified inbox).
8. **Payments** — Stripe everything: Payment Element (quote acceptance, embedded), Stripe Billing (SaaS subscriptions), Stripe Billing Portal (self-serve).
9. **Visual system** — Extend the canonical `superbad-visual-identity` skill with a product-appropriate colour ratio (75% cream / 15% charcoal / 5% red / 3% pink / 2% orange). shadcn/ui (Radix + Tailwind, copied into repo) as primitive layer. Framer Motion for choreographed transitions. Lite follows the skill, not the live GHL HTML, where they conflict.
10. **Sound design** — `use-sound` React hook (Howler.js under the hood). 6–8 bespoke sound effects sourced via Freesound API + optional ElevenLabs generation. Near-autonomous pipeline with ~30 seconds of taste approval from Andy per sound via a tiny admin review page.

## Current infrastructure state (snapshot)

- **Registrar:** GoDaddy
- **DNS:** Cloudflare (nameservers `dora.ns.cloudflare.com`, `keaton.ns.cloudflare.com`), proxied mode
- **`superbadmedia.com.au`:** served by GoHighLevel (LeadConnector funnel)
- **`hq.superbadmedia.com.au`:** served by HQ on Coolify / DigitalOcean
- **`lite.superbadmedia.com.au`:** will be served by Lite on the same Coolify instance

## Build-time disciplines locked into `FOUNDATIONS.md`

12 disciplines captured — highlights:

- No HQ code reuse (read HQ for patterns, never copy files)
- Route-relative URLs only — no hardcoded `lite.superbadmedia.com.au` anywhere → cutover to `/lite` is pure config
- One env var (`NEXT_PUBLIC_BASE_URL`) drives all absolute URLs
- Drizzle migrations from day one (no schema drift)
- Litestream running from session 1 (no "we'll add backups later")
- shadcn components copied into repo, never installed as a dependency
- Every third-party integration starts behind an adapter interface (Resend, Stripe, Claude API, SerpAPI, Apollo)

---

## Build risks flagged in Phase 2 reality check

1. **Stripe + webhooks is the real fragility.** Quote → subscription → deal-stage-transition chain must land cleanly or the whole sales pipeline lies. Build this first in Phase 5, before any UI polish.
2. **Resend inbound parsing is the second landmine.** Email inbound webhooks are messy (MIME, threading, contact matching). Allocate generous debugging headroom.
3. **Magic-link auth across three role surfaces.** Admin/client/customer isolation at the data layer is non-negotiable — test boundaries with role fixtures from day one.
4. **Coolify second-app setup.** First time running two apps on the same Coolify. Minor infra work, low risk but non-zero.
5. **Sound sourcing taste loop.** Andy's bar is high; bespoke sound files may need 2–3 iterations per slot before approval. Budget for it.

Phase 5 ordering recommendation still stands from Phase 1: riskiest integrations first (Stripe webhooks → Resend inbound → magic-link auth → UI polish).

---

## What was deferred

### To Phase 3 spec sessions
- One spec session per v1 feature area (six core areas + cross-cutting features):
  - Lead generation & assisted outreach
  - Sales pipeline (Kanban + auto-transitions)
  - Package / quote builder
  - Client management + automations subsystem
  - Daily planning cockpit (morning brief)
  - SaaS subscription billing infrastructure
  - Unified communications inbox
  - Setup wizards pattern
  - Design system baseline doc (tokens, motion, sound registry)
- Exact automation trigger list + email template editor UI
- Content calendar format
- Approvals flow UI
- Each specific SaaS product (one per session)

### To Phase 6 launch
- Marketing site cutover (replace GHL on `superbadmedia.com.au`)
- Subdomain → path migration (`lite.superbadmedia.com.au` → `superbadmedia.com.au/lite`)
- Cold-email subdomain DNS records (SPF/DKIM/DMARC on `contact.superbadmedia.com.au`)
- Production Cloudflare R2 bucket + Litestream credentials rotation
- Lead data import from HQ (one-off ETL)

---

## Skills copied into `.claude/skills/`

21 skills copied from `/Users/Andy/superbad-hq/.claude/skills/`:

- **Stack:** nextauth, stripe, drizzle-orm, tailwind-v4, nextjs16-breaking-changes, email-nodejs, react-19, framer-motion, nextjs-seo, claude-api, realtime-nextjs
- **Build discipline:** webapp-testing, typescript-validation, test-driven-development
- **UI/UX:** accessibility-aria, data-tables-crm, design-system-architect, recharts, motion-design-principles
- **Niche:** pdf-generation-nextjs, ai-agent-patterns

Global skills (`brainstorming`, `writing-plans`, `spec-driven-development`, `superbad-brand-voice`, `superbad-visual-identity`, `superbad-business-context`, `code-review`, `systematic-debugging`, `context-compression`) auto-load from `~/.claude/skills/` and do not need to be copied.

## Memory files relevant to Phase 2

- `project_ghl_current_stack.md` — GHL is the thing being replaced, nothing worth preserving, leads already in HQ
- `feedback_velocity_assumptions.md` — don't scope-cut for build time
- `feedback_primary_action_focus.md` — no fallback UX in conversion flows
- `feedback_individual_feel.md` — customer surfaces feel individual
- `feedback_setup_is_hand_held.md` — wizards for all integration/config
- `feedback_no_content_authoring.md` — no Looms, no manual screenshots, no tutorial copy

---

## Open questions for Phase 3

1. Which feature spec runs first? Recommendation: **sales pipeline** (because the Kanban stage model is the spine that every other feature plugs into — leads flow in, quotes land deals, clients graduate from it, the cockpit reads from it).
2. How granular should the design system baseline doc be — part of the first feature spec, or its own Phase 3 session? Recommendation: **its own session**, run second, so every subsequent feature spec can reference locked tokens.
3. Do we treat "setup wizards pattern" as a feature spec or a cross-cutting primitive doc? Recommendation: **cross-cutting primitive**, written once, referenced by every admin/client/customer onboarding spec.

---

## For the next session (Phase 3 kickoff)

1. Read in order: `CLAUDE.md` → `START_HERE.md` → this handoff → `SCOPE.md` → `FOUNDATIONS.md` → `MEMORY.md`
2. Phase 3 protocol lives in `START_HERE.md § Phase 3`
3. Confirm ordering decision (sales pipeline first? or design system baseline first?) with Andy — one multiple-choice question
4. Then run the spec brainstorm for whichever comes first, producing `docs/specs/<feature>.md`
5. Same brainstorm rules: one multiple-choice question at a time, recommendation + rationale, plain English, proactive saves.
