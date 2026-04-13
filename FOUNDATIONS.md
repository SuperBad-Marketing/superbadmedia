# SuperBad Lite — Foundations

**Phase 2 output. Locked 2026-04-11.**

This document is the source of truth for the technical foundations of SuperBad Lite — stack, hosting, URL structure, data layer, auth, email, payments, and the visual + sound design system baseline. Every decision below was made deliberately in the Phase 2 brainstorm, with the rationale and cascading consequences checked against the scope in `SCOPE.md`.

Phase 3 spec sessions and Phase 4 build planning must treat this document as canonical. If a feature spec requires changing a foundation decision, stop, flag it explicitly, and spin up a foundations revisit session — do not drift.

---

## Current infrastructure state (as discovered in Phase 2)

- **Registrar:** GoDaddy — owns `superbadmedia.com.au`.
- **DNS:** fully delegated from GoDaddy to **Cloudflare** (`dora.ns.cloudflare.com`, `keaton.ns.cloudflare.com`). All DNS record management happens in Cloudflare, not GoDaddy. Proxied mode (orange cloud) is the default for web-facing records; unproxied for mail / infrastructure records where required (MX, SPF, DKIM, DMARC).
- **Marketing site:** served by **GoHighLevel** (GHL / "LeadConnector") at the root domain. The visible homepage is a fully custom-branded HTML block embedded inside a GHL funnel wrapper — SuperBad's actual look and feel lives in that custom block. Andy edits it via GHL's funnel editor. Nothing in GHL is mission-critical (leads are already imported into the separate HQ build); a future sub-mission will retire GHL entirely.
- **SuperBad HQ:** running on a **Coolify** instance behind Cloudflare at `hq.superbadmedia.com.au`. Separate project from Lite per `CLAUDE.md`. Proven that the Cloudflare → Coolify pipeline works end-to-end on this domain.
- **SuperBad Lite:** does not exist yet. `lite.superbadmedia.com.au` is untaken and reserved for this build.
- **Brand assets already visible in the live site HTML** (for cross-reference against the canonical `superbad-visual-identity` skill):
  - Colours: `#B22848` (SuperBad Red), `#F4A0B0` (Retro Pink), `#F28C52` (Retro Orange), `#1A1A18` (Dark Charcoal), `#FDF5E6` (Warm Cream). The live site also adds a green (`#5DBF8A`) and muted greys (`#6B6B68`) that are **not** in the canonical skill — Lite follows the skill, not the live HTML, where they conflict.
  - Typography: Black Han Sans (display), Righteous (labels / micro-UI), Playfair Display italic (manifesto / pull quotes), DM Sans (body), Pacifico (logo wordmark only).

---

## Decisions locked

### 1. Framework
**Next.js (App Router).** Matches HQ. Every integration in scope (Stripe, Resend, Auth.js v5, Drizzle, Anthropic SDK) has first-class Next.js support. All project skills copied from HQ presume Next.js. Server Components + Server Actions cover the backend; Route Handlers cover webhooks and auth callbacks.

### 2. Hosting
**Reuse the existing Coolify instance that already serves HQ.** Lite ships as a second Coolify app alongside HQ on the same origin server. Same Cloudflare DNS account, same deploy pipeline, same ops model. Zero new dependencies, zero new monthly bills, zero new dashboards to learn.

**Shared-fate mitigation:** if the droplet ever dies, both HQ and Lite are down until a new droplet is spun up from Git. Phase 6 launch checklist includes a mandatory disaster-recovery dry run to verify this is achievable in under an hour with the real backup data (Litestream → R2 — see §5).

### 3. URL routing
**Single subdomain: `lite.superbadmedia.com.au`.** One Coolify app, one Next.js codebase, one host. All three role-facing surfaces (admin dashboard, client portals, SaaS customer dashboards) live under this host and are separated by **route-level auth boundaries enforced in middleware and Server Component auth checks**, not by DNS. Public lead-capture pages (`/get-started` etc.) also live here temporarily — marketing site forms continue to live on GHL until the marketing site migration sub-mission.

**Future migration to path-based `superbadmedia.com.au/lite`** is possible, easy, and explicitly planned-for. Unlocked once the marketing site moves off GHL. Execution:
1. `basePath: '/lite'` in `next.config.js`.
2. Update `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` env vars, redeploy.
3. Cloudflare routing rule for `superbadmedia.com.au/lite/*` → Coolify origin.
4. Update webhook URLs in Stripe and Resend dashboards.
5. Add 301 redirect from `lite.superbadmedia.com.au/*` → `superbadmedia.com.au/lite/*` for any links already in the wild.
6. Redeploy. Users re-authenticate once via magic-link.

Estimated effort: 1–2 hours including verification. Not a rebuild.

### 4. Marketing site strategy
**Deferred entirely.** No attempt to edit the GHL marketing site from this working directory during Lite's build phases. GHL's web UI remains the editing surface for any emergency tweaks between now and a dedicated post-Lite sub-mission that will:
1. Rebuild the marketing site as a Next.js (or static) app in its own Git repo.
2. Deploy it to the same Coolify instance at the root domain.
3. Retire GHL completely.

**Intermediate forms strategy:** when any specific GHL form becomes painful (e.g. the primary `/get-started` lead form), Lite can host a replacement form at `lite.superbadmedia.com.au/api/leads` (or similar) and embed it into the GHL site via iframe or script tag — incrementally replacing GHL piece by piece without blocking on the full site rebuild.

### 5. Database + ORM
**SQLite via Drizzle ORM, file on a Coolify-managed persistent volume, continuously replicated to Cloudflare R2 via Litestream.**

- **Database:** SQLite in WAL mode. One file, mounted into the Coolify container's filesystem via a Coolify persistent volume.
- **ORM:** Drizzle. Type-safe schema definitions in TypeScript. Migrations managed via `drizzle-kit`. Schema is compatible with Postgres if Lite ever outgrows SQLite (unlikely at internal-CRM scale).
- **Backups:** Litestream sidecar process streams every write to a Cloudflare R2 bucket in near-real-time. Recovery point objective (RPO) measured in seconds, not hours. R2 has no egress fees — ideal for backup use cases.
- **Full-text search:** SQLite FTS5 extension (built in). Used for inbox, prospect, and client search. Zero extra infrastructure.
- **Mandatory Phase 5 verification:** before Lite processes any live billing event, an explicit session must nuke the running container, restore SQLite from R2 into a scratch environment, and verify data integrity. This session is a precondition for launch.

### 6. Authentication
**Auth.js v5 (NextAuth), email magic-link as the only provider.** Drizzle adapter. Unified user table with a `role` field (`admin`, `client`, `customer`). One user can hold multiple relationships (e.g. retainer client who also subscribes to a SaaS product) via relationship records, not duplicated accounts.

- **Session duration:** 30 days, "stay signed in" by default. Andy realistically clicks a magic-link maybe once a month.
- **Access boundaries:** enforced in Next.js middleware and Server Component auth checks against the `role` field. Admin surface (`/`, `/admin/*`) requires `admin` role. Client portal (`/portal/[clientSlug]`) requires `client` role scoped to that specific client. SaaS customer dashboard (`/dashboard/[customerSlug]`) requires `customer` role scoped to that specific subscriber. **Data-layer access checks also enforce scope** — never trust middleware alone.
- **Magic-link emails** sent from the primary domain (not the cold-outreach subdomain — different reputation needs). See §7.
- **2FA / passkeys:** deferred. Magic-link is already de-facto 2FA (control of email inbox). Can be added later for admin accounts without touching customer flows.

### 7. Email (transactional, outreach, inbound)
**Resend for all three roles. Two verified domains in Resend. Inbound parsing via webhook.**

- **Transactional sending domain:** primary domain (`hello@superbadmedia.com.au` or similar). Handles magic-link logins, Stripe receipts, welcome emails, automation triggers (deliverable uploaded, approval requests, etc.). Needs *excellent* deliverability — these land in real inboxes and the app breaks if they don't arrive.
- **Cold outreach sending domain:** dedicated subdomain (`hi@contact.superbadmedia.com.au`). Non-negotiable cold-email hygiene — outreach must never contaminate the primary domain's reputation. SPF/DKIM/DMARC records configured in Cloudflare during admin setup wizard.
- **Inbound parsing:** Resend inbound webhook POSTs incoming emails to `lite.superbadmedia.com.au/api/webhooks/inbound-email`. Single handler routes to the unified inbox based on receiving address, matches sender to existing prospect / client records, threads messages correctly.
- **Templates:** React Email components, themed against the Lite design tokens (see §9) so transactional and automated emails are brand-consistent with the product UI.
- **Unsubscribe:** `List-Unsubscribe` header on all cold outreach + visible unsubscribe link in the email template. Unsubscribed prospects are blocked in the "Generate email" UI server-side. Legal requirement under Australian Spam Act 2003.
- **DMARC strictness:** start with `p=quarantine` on both domains, upgrade to `p=reject` once confident. DMARC reports can be ingested in a later phase.
- **Pluggable adapter:** email is one channel. Future SMS (Twilio) and Meta DM adapters implement the same interface. Scope locked in Phase 1.

### 8. Payments
**Stripe for everything. Payment Element (embedded, no redirect) for both retainer quote acceptance and SaaS signup. Stripe Billing for subscriptions. Stripe Billing Portal for customer self-serve.**

- **Retainer quote acceptance:** embedded Payment Element on the quote page. On accept, Lite creates an ad-hoc `Price` object in Stripe via API (per-client pricing, no fixed rate card), creates a subscription against that price, webhook fires, deal moves to Won, client record auto-created.
- **SaaS signup:** same Payment Element pattern, embedded in a branded signup flow. Pre-configured prices — Andy configures SaaS products in Lite admin, which syncs to Stripe via API (Lite admin is the source of truth for SaaS product configuration).
- **Subscription management:** Stripe Billing handles proration, retries, dunning, invoice generation, credit notes.
- **Customer self-serve:** Stripe Billing Portal for card updates, invoice history, cancellation. "Manage billing" button in both client portal and SaaS dashboard generates a portal session and redirects. Zero code on our side beyond the button.
- **Webhooks:** single endpoint at `lite.superbadmedia.com.au/api/webhooks/stripe`. Handles `checkout.session.completed`, `customer.subscription.created`, `invoice.paid`, `invoice.payment_failed`, and related events. Signature verification non-negotiable. **Idempotency table** in SQLite — processed event IDs are recorded and duplicate deliveries are no-op'd.
- **Stripe Tax:** off by default in v1, flag to enable when SaaS products go live (handles Australian GST and international tax automatically).
- **PCI compliance:** Payment Element is hosted in a Stripe iframe. Card details never touch Lite's servers. Lowest-burden PCI tier (SAQ A). Annual compliance work effectively zero.
- **Test mode vs live mode:** separate Stripe keys per environment. Live keys set manually by Andy at launch, never committed to Git.

### 9. Visual design system
**Extend the canonical brand (from `superbad-visual-identity` skill) into a functional CRM design system. shadcn/ui + Framer Motion. Dark mode is the only mode in v1.**

**Colour system:**
- **Brand tokens** (from the skill): `--brand-red` (`#B22848`), `--brand-cream` (`#FDF5E6`), `--brand-pink` (`#F4A0B0`), `--brand-orange` (`#F28C52`), `--brand-charcoal` (`#1A1A18`).
- **Extended neutral scale** (to be derived in first Phase 5 UI session): ≈8 steps within the Dark Charcoal family — warm near-blacks to mid-greys, never bluish. For dividers, borders, secondary surfaces, disabled states, hover/focus chrome.
- **Semantic tokens:** `--success` (warm green, derived — not in the canonical palette), `--warning` (Retro Orange promoted into this role), `--error` (SuperBad Red doubles up — red is already the "heat" colour), `--info` (warm neutral, not a stock tech blue).
- **Product colour ratio** (distinct from the marketing 60/20/10/6/4): charcoal dominant (~75%) / neutral-scale chrome (~15%) / warm cream for text & highlights (~5%) / SuperBad Red for the single highest-signal CTA per screen (~3%) / pink & orange for mutters, moments, accents (~2%). Marketing surfaces (landing page, quote pages, emails) still use the canonical 60/20/10/6/4 marketing ratio.

**Typography** (from the skill, adapted for UI context):
- **Black Han Sans** — page H1s, empty states, morning brief headline only. Never body or small sizes.
- **Righteous** — eyebrows, section labels, short uppercase micro-UI (button labels, tab labels, column headers).
- **DM Sans** — the workhorse. Body text, form fields, table cells, inbox previews, 95% of the practical UI.
- **Playfair Display italic** — morning brief paragraph and narrative "Lite talking to you in prose" moments only.
- **Pacifico** — logo wordmark only, likely only on marketing surfaces.
- All fonts loaded via `next/font/google` with `display: swap`.

**Component baseline:** **shadcn/ui.** Built on Radix primitives (accessibility for free — keyboard nav, focus management, ARIA) and Tailwind styling. Copy-pasted into the repo, not a dependency. We own every component file we ship. Theme variables map to the extended brand tokens via CSS custom properties.

**Motion library:** **Framer Motion** for interactive and choreographed animation (quote acceptance celebration, Kanban card drop physics, morning brief fade-in, inbox message arrival). Plain CSS transitions for simple hover / focus states.

**Iconography:** Lucide (ships with shadcn). Single icon style, thin strokes harmonise with the typography.

**Tokens live in a single source of truth** — CSS custom properties in `globals.css` + Tailwind `theme.extend.colors` reading those variables + a TypeScript export (`lib/design-tokens.ts`) for any runtime access. Updated once in one place, propagates everywhere.

**Dark mode only in v1.** The brand is dark-first. No light mode toggle unless a specific Phase 3 spec (e.g. the PDF quote output) needs a light variant.

### 10. Sound effects
**`use-sound` React hook (wrapping Howler.js) + hand-curated bespoke sound files. Scarcity is the rule — ~6–8 sounds total for the entire app.**

**Sourcing:**
- Freesound.org public API for licensed royalty-free candidates.
- Optional: AI sound generation (ElevenLabs sound effects API) for prompts like *"warm wooden thunk, tactile feedback, 300ms, 1970s analog character, no reverb"*. Requires API key in `.env.local`.
- No pre-made sound packs (too recognisable, off-brand). No pure synthesis (too digital, hard to get warm 1970s feel).
- Workflow: Claude Code fetches 2–3 candidates per sound into `/public/sounds/candidates/`. Andy reviews via a small admin "sound review" page (built in Phase 5), plays candidates, clicks Approve on the chosen one. Selected file moves to `/public/sounds/approved/` and the registry is updated.
- **No manual media authoring** required from Andy — this is review, not creation, consistent with `feedback_no_content_authoring` memory.

**Initial sound registry** (locked — any additions require explicit Andy approval, not drive-by during feature builds):
1. **Quote accepted** — celebratory chime, single tone, warm, brief.
2. **Stripe subscription activated** — same or related chime (reinforces positive loop).
3. **Kanban card drop into stage** — soft tactile thunk.
4. **Morning brief fades in** — one-note warm bell.
5. **Inbox new message arrival** — gentle warm pop.
6. **Deliverable marked complete** — subtle ascending tone.
7. **Error toast** — low, warm thud (not harsh).

Hovers, button clicks, modal opens, tab switches: **silent.** Scarcity is what makes the sounds mean something.

**Technical:**
- `use-sound` hook (~1KB) wraps Howler.js. Handles browser autoplay restrictions, cross-browser quirks, lazy loading.
- Typed registry at `lib/sounds.ts` — no string-literal sound keys anywhere else in the app.
- `soundsEnabled: boolean` field on user table (default `true`). Settings toggle in profile.
- Respects `prefers-reduced-motion: reduce` automatically — sounds mute when motion is reduced.
- Licensing: every sound file has recorded license + attribution in `docs/sound-attributions.md`. Royalty-free commercial use only. Non-negotiable.

### 11. Cross-cutting primitives (added 2026-04-12 — upgrades shortlist)

Five primitives integrated from the 2026-04-12 upgrades review (`where-we-are.html` section 4). All fold into the existing architecture without new infrastructure. Treated as locked foundations from this date forward — every Phase 3 spec and Phase 5 session must honour them. Phase 4's build plan must sequence these primitives first so all subsequent sessions can depend on them.

**11.1 Universal audit log.** The append-only activity log pattern locked in `docs/specs/sales-pipeline.md` is generalised to every mutation in the system. A single `activity_log` table at the Drizzle layer captures who/what/when/why for every admin action — card moved, deal edited, email sent, client added, deliverable approved, subscription cancelled, everything. Nullable entity FKs let the same row shape reference any table. Soft-deletes write an `action = 'delete'` row rather than removing data, enabling the "global undo" pattern on top of the same primitive if ever wanted. No feature opts out. **Zero new infrastructure** — one table, one helper, one call at the end of every mutation. The Sales Pipeline spec's existing `activity_log` definition is the reference shape; generalise, don't fork.

**11.2 Safe-to-send gate.** Every outbound email — cold outreach, magic-link logins, Stripe receipts, wizard confirmations, newsletter, deliverable notifications, morning brief, Monday founder PDF, any future channel — flows through a single `canSendTo(recipient, channel, purpose)` check before touching the Resend adapter. The gate consults: suppression list, bounce history, unsubscribe flags, frequency caps per recipient per purpose. Rejected sends log the reason and are either dropped (transactional) or queued for the next safe window (outreach/automations). **Non-negotiable discipline, not a toggleable feature.** No send path imports the Resend client directly — every path imports the gate-wrapped `sendEmail()` from the channel adapter. Protects primary-domain and cold-subdomain reputation forever. Impossible to retrofit if missed early.

**`sendEmail()` signature** (added 2026-04-13 Phase 3.5): `sendEmail({ to, subject, body, classification, purpose, ... })`. The `classification` parameter is a top-level enum that determines which sending domain and reputation pool the send uses, and which gates apply:

- **Base values** (locked): `'transactional' | 'outreach'`. Transactional goes via the primary domain with no quiet-window gate; outreach goes via the cold-outreach subdomain with the §11.4 quiet window applied.
- **Spec-extensible values** (each added by a spec that needs it): `'hiring_invite'`, `'hiring_followup_question'`, `'hiring_trial_send'`, `'hiring_archive_notice'`, `'hiring_contractor_auth'`, `'hiring_bench_assignment'` (Hiring Pipeline, 2026-04-13). Each maps to a domain pool and gate profile inside the adapter — feature code passes the classification, never a domain/pool directly.
- New classification values added in Phase 5 require a one-line adapter update; the classification enum lives in one place (`lib/channels/email/classifications.ts`) and is the single source of truth.

**11.3 Timezone-correct timestamps.** Every timestamp is stored in UTC at the database layer. Every timestamp displayed in the UI is rendered in the viewer's local timezone via a single `formatTimestamp(date, tz)` utility. A `timezone` column lives on the `user` table (default `Australia/Melbourne`, editable in Settings → Display). Email and PDF templates render in recipient-local timezones where recipient identity is known. **No ad-hoc `new Date().toLocaleString()` in component code** — all time display routes through the utility. Cheap to enforce day one, catastrophic to retrofit once clients outside Melbourne start paying invoices.

**11.4 Outreach quiet window.** Automated cold-outreach sends (first-touch, follow-ups, auto-nudges, stale-deal reminders) are gated to **08:00–18:00 Australia/Melbourne local, Monday–Friday, excluding Australian public holidays**. Transactional sends (magic-links, receipts, subscription lifecycle emails) are unaffected — they go whenever they need to. The holiday calendar lives as a static JSON file at `/data/au-holidays.json`, updated annually via a brief scheduled maintenance ticket. Rejected sends queue for the next safe window rather than failing. Gate lives inside the Resend channel adapter and composes naturally with the safe-to-send gate (§11.2). Protects sender reputation, respects recipients, removes Andy's "oh no I sent that at 11pm" anxiety.

**11.5 Brand-voice drift check.** Every LLM-generated artefact destined for external delivery — outreach draft, blog post, newsletter rewrite, social draft, reply draft, morning brief narrative, automated client email — passes a final Claude grading call that reads the relevant Brand DNA profile (the client's own for client-facing output, SuperBad's own for SuperBad-facing output) and scores the draft against its signal tags. Drafts scoring below the drift threshold are regenerated once automatically with the drift feedback included in the prompt; a second failure surfaces a visible "voice drift flagged" warning on the review surface rather than blocking. One extra Claude call per generation, Haiku-tier (cheap), composes with the "Brand DNA as perpetual context" pattern already locked in memory (`project_brand_dna_as_perpetual_context.md`) and the "two perpetual contexts" principle (`project_two_perpetual_contexts.md`). Zero new infrastructure. The difference between a platform that generates content and a platform that generates **your** content.

**11.6 LLM model registry + external-call observability** (added 2026-04-13 Phase 3.5 per `project_llm_model_registry.md`). Every LLM call in Lite routes through a central registry at `lib/ai/models.ts` that maps **job names** (`outreach-writer`, `reply-classifier`, `brand-dna-generator`, `icp-scorer`, `finance-narrative`, `hiring-brief-synthesize`, etc.) to current model IDs. Feature code asks for a job, never for a model ID directly. The registry is the single point of configuration for:

- **Job → model mapping** (e.g. `outreach-writer → claude-sonnet-4-6`). A model deprecation or upgrade is a one-file edit.
- **External-call logging.** Every call writes a row to `external_call_log` (job name, model id, input tokens, output tokens, cost tuple, latency ms, timestamp, request id). Source of truth for the Cost & Usage Observatory.
- **Integration read jobs** beyond Anthropic (`stripe-balance-read`, `stripe-balance-transactions-read`, etc.) follow the same pattern and log to the same table.
- **Quarterly review ritual** (Phase 6 operational cadence): re-read Anthropic's model page, update mappings, run the cost diff. AUTONOMY_PROTOCOL.md must include a "things that drift over time" section covering models, Stripe API versions, Resend SDK, Meta/Google Ads APIs — each with a review cadence and the registry/config file that owns it.
- **Build-time discipline:** no feature file imports `@anthropic-ai/sdk` directly. The ESLint rule enforcing this lands in the foundation session. Found bypass = refactor task, not a patch.

Phase 3.5 patch: the `cost-usage-observatory.md` §7 model registry lists every known job name across all 21 specs; new specs extend it rather than forking.

**11.7 Stripe identity primitive** (added 2026-04-13 Phase 3.5 Step 11). Every Stripe-touching code path — Intro Funnel PaymentIntent, Quote Builder Checkout, Branded Invoicing draft + send, SaaS Subscription Billing, one-off project invoices — calls `ensureStripeCustomer(contactId): Promise<string>` before creating any Stripe object. The helper:

- Reads `contacts.stripe_customer_id`. If non-null, returns it.
- If null, calls `stripe.customers.create({ email, name, metadata: { contact_id } })` using the canonical email + name from `contacts`, persists the returned ID to `contacts.stripe_customer_id` (unique index enforces one Stripe Customer per contact), returns it.

**Creation is lazy — a Stripe Customer exists only for contacts who have actually paid.** Abandoned leads never hit Stripe. The same contact across multiple deals (trial shoot → retainer → SaaS add-on) shares one Stripe Customer ID forever. `deals.stripe_customer_id` remains a denormalised mirror for subscription-state-machine reads (§12) but the canonical identity is `contacts.stripe_customer_id`.

**No feature code imports `stripe.customers.create` directly.** Every Stripe create path goes through this helper. ESLint rule in the foundation session enforces this — same pattern as the LLM model registry (§11.6).

**Business-lifecycle separation (terminology lock).** The Stripe `Customer` object is a payment-attachment identity only. It has no relationship to SuperBad's business lifecycle. A contact can hold a Stripe Customer ID while still being a **Lead/Prospect** in SuperBad's business sense (e.g. they've paid for a trial shoot but haven't converted to retainer). Only a signed retainer promotes the business-lifecycle status to **Client**. The Phase 3.5 step 8 glossary pass (pending) codifies this as a canonical term separation: `stripe.Customer` (Stripe's payment identity) ≠ **Client** (SuperBad's retainer-holding contact) ≠ **customer** (never used alone — avoid in specs and code to prevent collision).

**11.8 First-Login Brand DNA Gate** (added 2026-04-13 Phase 3.5 Step 11 Stage 2 — F2.b resolution). Lite refuses to operate without its perpetual SuperBad Brand DNA context. A Next.js middleware runs on every admin route and checks for a `brand_dna_profiles` row with `subject_type = 'superbad_self'` AND `status = 'complete'`. If absent, every admin route 302-redirects to `/lite/onboarding`, which mounts the standard Brand DNA Assessment with Andy as the subject (Founder mode per Brand DNA Assessment §3.1). No skip option exists in the UI.

**Why a hard gate, not a nudge.** Per project memories `project_brand_dna_as_perpetual_context.md` and `project_two_perpetual_contexts.md`, every downstream LLM call on behalf of SuperBad reads this profile. Without it, every Brand-DNA-consuming feature (Intro Funnel synthesis, retainer-fit recommendation, Lead Gen drafts, Outreach reply intelligence, brand-voice drift checks, Cockpit briefs) would either fail or fall back to lower-quality output. The platform makes a stronger commitment by refusing to operate without its perpetual context, rather than tolerating a degraded mode. **No stub primitive exists** — consumer prompts read the profile directly.

**Implementation safety net.** A `BRAND_DNA_GATE_BYPASS=true` env var (off by default; not surfaced in any UI) lets Andy bypass the gate manually if a bug in the gate ever locks him out of his own platform. Foundation session implements; documented in INCIDENT_PLAYBOOK.md (Phase 6).

**Phase 4 build-order constraint.** Brand DNA Assessment (at minimum the SuperBad-self path + the gate middleware) must build before any Brand-DNA-consuming feature can ship. Specifically blocks: Intro Funnel synthesis (§13.3) + retainer-fit (§13.4), Lead Gen draft generation, Outreach reply intelligence, brand-voice drift checks (§11.5 above), Cockpit briefs that reference perpetual voice. The full client-facing Brand DNA Assessment surface can ship later in Phase 5 — only the SuperBad-self slice is gating.

**Owner.** Brand DNA Assessment §11.1 owns the gate semantics; the foundation session owns the middleware implementation + env-var bypass.

---

## 12. Canonical subscription state machine (added 2026-04-13 — Phase 3.5 step 10)

Every spec that touches subscription state — Quote Builder, SaaS Subscription Billing, Branded Invoicing, Client Management, Intro Funnel — references the state machine below. No spec re-describes it. Any spec whose transitions conflict with this machine is the spec that must be patched.

**States:**

- `trial_pending` — trial shoot paid ($297 via Stripe Checkout), shoot not yet happened.
- `trial_active` — trial shoot happened; prospect in the post-shoot window (has portal access, has six-week plan, has not yet accepted retainer or SaaS subscription).
- `trial_completed_awaiting_decision` — retainer-fit recommendation delivered to Andy's cockpit; quote not yet sent.
- `quote_draft` — draft quote exists, not sent.
- `quote_sent` — quote sent, awaiting prospect action.
- `quote_accepted` — prospect accepted; payment setup in flight.
- `active_current` — subscription live, payments current (Stripe or manual).
- `past_due` — payment failed (Stripe auto-retry in progress) OR manual invoice ≥30 days overdue.
- `paused` — SaaS pre-term pause (one per commitment, 1 month max). Retainer clients cannot pause.
- `cancel_scheduled_preterm` — customer requested cancel within committed term; continues paying through `committed_until_date`, then auto-ends.
- `cancelled_buyout` — customer paid the buyout fee to end the commitment immediately. Subscription ends now.
- `cancelled_paid_remainder` — `cancel_scheduled_preterm` reached `committed_until_date` without reversal. Terminal.
- `cancelled_post_term` — customer cancelled after the committed term expired. Terminal, no fee.
- `ended_gracefully` — commitment completed, no action taken, auto-converts to month-to-month OR ends per product rules. Terminal.

**Canonical persistence:** `deals.subscription_state` (enum above) is the single source of truth, denormalised alongside:
- `deals.committed_until_date` (date, nullable — null for month-to-month SaaS)
- `deals.pause_used_this_commitment` (boolean, SaaS only, anti-stack)
- `deals.billing_cadence` (enum: `monthly | annual_monthly | annual_upfront`)
- `deals.stripe_subscription_id` + `deals.stripe_customer_id` (text, nullable — Stripe-billed path only)

**Two billing paths, one state machine:**
- **Stripe-billed:** `Stripe.Subscription` is authoritative for billing cycle; Lite enforces commitment via the cancel flow, NOT Stripe Phases.
- **Manual-billed:** `invoices` table + `scheduled_tasks` chain (`manual_invoice_generate` → `manual_invoice_send` per cycle). Chain stops the moment `deals.subscription_state != 'active_current'`.

**Trigger table:** see each spec's own transition callers. Canonical transition owners:
- `createDealFromLead()` → `trial_pending`: Intro Funnel.
- `trial_active` → `trial_completed_awaiting_decision`: Intro Funnel post-shoot reflection.
- `quote_draft` → `quote_sent`: Quote Builder.
- `quote_accepted` → `active_current`: Quote Builder (+ Stripe checkout.session.completed OR manual first-invoice paid).
- `active_current` → `past_due`: Branded Invoicing (overdue threshold) OR SaaS Subscription Billing (Stripe `invoice.payment_failed`).
- `active_current` → `paused`: SaaS Subscription Billing.
- `active_current` → `cancel_scheduled_preterm` / `cancelled_buyout` / `cancelled_post_term`: Quote Builder (cancel flow at `/lite/portal/subscription`).
- `cancel_scheduled_preterm` → `cancelled_paid_remainder`: scheduled task at `committed_until_date`.

**Cross-cutting rule:** every state exit that ends billing writes an `activity_log.kind = 'subscription_state_changed'` row with the old/new state + reason. The same write path feeds Daily Cockpit's `maybeRegenerateBrief('subscription_event', payload)`.

---

## Build-time disciplines (non-negotiable during Phase 5)

Consolidated from across Phase 2 decisions. Every build session must honour these:

1. **Never hardcode `lite.superbadmedia.com.au`** anywhere in code. Always read from `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` env vars. Enables the future `/lite` path migration without a rewrite.
2. **Always use Next.js `<Link>` and relative paths** for internal navigation. Never absolute self-URLs.
3. **All webhook / callback URLs stored in env vars**, never inlined. Includes Stripe webhook URL, Resend inbound URL, Auth.js callback URL.
4. **Stripe webhook handlers must be idempotent** — check `event.id` against a processed-events table before acting. Double delivery is a when, not an if.
5. **Stripe webhook signatures must be verified** on every incoming event. Reject any that don't verify.
6. **Data-layer access checks** enforce scope, not just middleware. Never trust the URL — always check `session.user.id` / `session.user.role` against the requested resource inside the query.
7. **Design tokens live in one place** — `globals.css` CSS custom properties, consumed by Tailwind theme + TypeScript export. No ad-hoc colour literals in component code.
8. **Red is scarce** — maximum one SuperBad Red CTA per screen. Red anywhere else must earn it (destructive action, error state, key metric).
9. **Sound registry is locked** after initial 6–8 entries. New sound = explicit Andy approval, not drive-by.
10. **Respect accessibility** — shadcn/Radix gives us ARIA / keyboard for free; we must not break it. `prefers-reduced-motion: reduce` mutes sounds and disables non-essential Framer Motion animations.
11. **All integrations delivered via setup wizards** per `feedback_setup_is_hand_held` — no raw "paste your API key here" forms.
12. **No manual media authoring from Andy** per `feedback_no_content_authoring` — no Looms, no hand-taken screenshots, no tutorial copy. Third-party-maintained docs links + Claude chat helper are the help mechanism.
13. **Universal audit log on every mutation** (§11.1). No write to the database bypasses the `logActivity()` helper — `(actorId, action, entityType, entityId, before, after, metadata)` — called at the end of every mutation inside the same transaction. Enforced at code review; a bypass found in Phase 5 spawns an immediate refactor task. Soft-deletes write `action = 'delete'` rows, never destructive removes.
14. **No direct Resend imports** (§11.2). The Resend client is instantiated once inside the channel adapter. Every send path in the codebase imports `sendEmail()` from the adapter, never `resend.emails.send()` directly. The `canSendTo()` gate is wrapped inside `sendEmail()` — impossible to bypass. Applies to transactional, outreach, newsletter, automations, morning brief, Monday PDF, wizard confirmations, every path without exception.
15. **All timestamps UTC in storage, local in display** (§11.3). No `new Date().toLocaleString()`, no `toISOString()`, no `dateFns.format()` in user-facing rendering. Always route through the `formatTimestamp(date, tz)` utility with an explicit timezone. Schema defaults to `timestamp_ms` integer columns (UTC epoch). A `timezone` column on `user` is required before the first display surface ships.
16. **Automated cold outreach honours the quiet window** (§11.4). Any code path that enqueues automated cold-outreach sends imports `isWithinQuietWindow()` from the outreach adapter. Rejected sends enqueue for the next safe window, never fail silently. Transactional paths are exempt and must not import this helper — the separation is the discipline.
17. **All external-facing LLM output passes the drift check** (§11.5). Every generation site — Lead Gen outreach, Content Engine blog/newsletter/social drafts, Client Context Engine draft replies, Morning Brief narrative, automated client emails, any future LLM output destined for a real human inbox — routes the draft through `checkBrandVoiceDrift(draft, brandDnaProfile)` before the result is shown to Andy or sent. Applies whether the Brand DNA profile is the client's or SuperBad's own. Internal-only LLM output (signal extraction, action-item tagging, summary regeneration) is exempt.
18. **Lite's local dev server runs on port 3001, not 3000.** HQ already occupies `localhost:3000` on Andy's Mac. Lite is locked to `localhost:3001` via `"dev": "next dev -p 3001"` in `package.json` from the first Phase 5 session that initialises the Next.js project. Both projects can run simultaneously in side-by-side Terminal tabs without interference. Production URLs (`lite.superbadmedia.com.au`, later `superbadmedia.com.au/lite`) are unaffected — this rule is local-dev-only.

---

## Phase 2 reality check

### Hardest parts
1. **Third-party integration sequencing.** ~12 external services touched: Stripe (Payment Element + Billing + Billing Portal + webhooks + optional Tax), Resend (transactional + cold + inbound + 2 verified domains), Auth.js v5, Anthropic, SerpAPI, Apollo, Meta Ad Library, Cloudflare DNS + R2, Coolify, Freesound / ElevenLabs. Phase 4 must sequence **riskiest integrations first** — Stripe webhooks → Resend inbound → magic-link auth → Litestream backup verification → everything else.
2. **SQLite + Litestream operational verification.** Litestream is mature but has subtle failure modes. **Mandatory Phase 5 restore-from-R2 verification session** before any live billing event is processed. Non-negotiable.
3. **Coolify as shared infrastructure with HQ.** Shared fate with HQ on the same droplet. **Phase 6 launch checklist must include a disaster-recovery dry run** to prove the "redeploy from Git to a new droplet" recovery works in under an hour.
4. **Design system colour science in first Phase 5 UI session.** Risk: burn 90 minutes fiddling with tokens instead of shipping. **Phase 4 must sequence a standalone "design tokens + base layout + component primitives" session** as the first UI work, separate from feature sessions.
5. **Sound effect scope discipline.** Registry is locked; additions require explicit approval. Phase 5 temptation to add "just one more sound" must be refused.

### What could go wrong
- Resend cold-outreach deliverability degrades (shared-IP risk) → dedicated IP upgrade or adapter swap.
- Stripe webhook idempotency bug → processed-events dedup table + rigorous first Phase 5 webhook session.
- Auth.js v5 version drift → pin versions, read release notes, test end-to-end after every bump.
- Cloudflare SPF/DKIM/DMARC misconfiguration → setup wizard pattern with `dig` + DMARC checker verification.
- SQLite write contention during outreach bursts → WAL mode handles it; transaction batching is the fix if ever visible.
- Litestream silent replication failure → restore-verification session catches this.

### Is this actually doable
**Yes.** The stack is conventional. Every integration has first-class Next.js support. The skills library covers almost all of it. Nothing is novel or experimental. The real risk is **coherence across ~20–30 build sessions**, not any single technical piece. Phase 4's build plan must impose tight per-session scope; compaction between sessions is non-optional.

**Go/no-go: green light.** No Phase 2 blockers. Phase 3 can start immediately.

---

## Skills copied from HQ

Per `START_HERE.md § Phase 2 step 4`. Copied from `/Users/Andy/superbad-hq/.claude/skills/` into `./.claude/skills/` at the close of Phase 2:

**Core stack skills (from START_HERE.md initial list):**
- `nextauth`, `stripe`, `drizzle-orm`, `tailwind-v4`, `nextjs16-breaking-changes`, `email-nodejs`, `react-19`, `framer-motion`, `nextjs-seo`, `webapp-testing`, `typescript-validation`

**Added based on Phase 2 decisions:**
- `accessibility-aria` — required for shadcn/Radix work and WCAG compliance
- `data-tables-crm` — Kanban, tables, pipeline views (core Lite surfaces)
- `design-system-architect` — extending brand into functional design system (§9)
- `pdf-generation-nextjs` — quote PDFs per SCOPE.md
- `claude-api` — Anthropic integration for outreach generation + wizard chat helper
- `realtime-nextjs` — inbox updates, Kanban reactivity
- `recharts` — dashboard data visualisation
- `motion-design-principles` — choreographed animation for the "Apple-satisfying" feel
- `test-driven-development` — quality discipline across Phase 5
- `ai-agent-patterns` — wizard chat logic + outreach generation patterns

Total: 21 skills. Additional skills (e.g. `twilio` for deferred SMS, `google-calendar` for a Phase 3 booking integration) may be copied later as specific specs require them.
