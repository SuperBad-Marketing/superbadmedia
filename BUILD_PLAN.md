# BUILD_PLAN.md — SuperBad Lite

**Phase:** 4 — Build Plan.
**Locked:** 2026-04-13.
**Ordering:** Dependency-strict producers → consumers → aggregators last (Andy's call per Phase 4 Q1).
**Scope:** 22 locked specs + 1 legal-pages spec drafted inline in Foundation-B. Broken into ~162 atomic build sessions across 23 waves + 2 addendum waves. Foundation split A/B per Phase 3.5 exit handoff. **Patched 2026-04-18:** Free Audit Tool spec added, 3 Lead Gen spec patches (case snippets, retargeting pixel, autonomy adjustment), referral surface added to Client Management. Wave 13b + CM-E added. Patch mop-up wave (13c) added: 7 orphaned patches slotted into named sessions (Settings Display UI, design-system-baseline revisit, realtime channel, subscription state naming, invoke.ts system-role refactor, visual remediation discipline, LG queue edit/nudge buttons).

AUTONOMY_PROTOCOL.md and LAUNCH_READY.md are separate artefacts in the same Phase 4 output set (produced in the next session per mid-session context-budget discipline — see §23).

---

## Table of contents

1. Pre-build spike (Wave 0)
2. Foundation A — Core infrastructure (Wave 1, sessions A1–A8)
3. Foundation B — Safety + compliance (Wave 2, sessions B1–B3)
4. Brand DNA — perpetual context (Wave 3, BDA-1..5)
5. Setup Wizards primitive (Wave 4, SW-1..6)
6. Sales Pipeline — CRM spine (Wave 5, SP-1..9)
7. Quote Builder — critical flow (Wave 6, QB-1..8 + QB-E2E)
8. Branded Invoicing — critical flow (Wave 7, BI-1..7 + BI-E2E)
9. SaaS Subscription Billing — critical flow (Wave 8, SB-1..12 + SB-E2E)
10. Unified Inbox — primitives first (Wave 9, UI-1..13 + UI split)
11. Client Management — critical flow (Wave 10, CM-1..12 + CM-E2E)
12. Onboarding + Segmentation (Wave 11, OS-1..3)
13. Content Engine (Wave 12, CE-1..13)
14. Lead Generation (Wave 13, LG-1..10)
14b. Lead Gen addendum + Free Audit Tool (Wave 13b, LG-11 + AT-1..2)
14c. Patch mop-up (Wave 13c, PM-1..7)
15. Intro Funnel — critical flow (Wave 14, IF-1..4 + IF-E2E)
16. Six-Week Plan Generator (Wave 15, SWP-1..10)
17. Client Context Engine (Wave 16, CCE-1..3)
18. Task Manager (Wave 17, TM-1..9)
19. Hiring Pipeline (Wave 18, HP-1..19)
20. Finance Dashboard (Wave 19, FD-1..14)
21. Surprise & Delight (Wave 20, SD-1..14)
22. Cost & Usage Observatory — aggregator (Wave 21, COB-1..11)
23. Daily Cockpit — aggregator (Wave 22, DC-1..8)
24. Settings Audit Pass + dry-run (Wave 23)
25. Consolidated cron table (§C)
26. Shared-primitive registry (owner vs consumer) (§R)
27. Critical-flow E2E suites (§E)

---

## Ordering principles (what this plan enforces)

1. **Foundation first, everywhere downstream depends on it.** A/B-split because the full list in `START_HERE.md § Phase 4 step 4` is too big for one session. A lands runtime primitives consumers need; B lands safety/compliance/backups — needed before Launch, not strictly before feature work, so it runs in parallel-safe mode.
2. **Producers before consumers.** Every shared primitive (table, helper, URL path, prompt slug, cron) is defined in one owner session. Consumers import, never redefine.
3. **Aggregators last.** `daily-cockpit`, `cost-usage-observatory` ship at the very end, reading from real, tested, live producers. `unified-inbox` is partially aggregator (classifiers read many surfaces) and partially producer (owns `messages`/`threads` tables) — its producer slice (UI-1) lands mid-plan so downstream specs can consume the schema; its aggregator slice (UI-2..UI-13) lands after all producers.
4. **Critical-flow E2E suites land the session their flow goes live.** No retrofitting. Five critical flows: trial shoot booking (IF-E2E), quote accept (QB-E2E), invoice pay (BI-E2E), subscription signup (SB-E2E), portal auth (CM-E2E).
5. **Brand DNA gating constraint (F2.b, FOUNDATIONS §11.8).** SuperBad-self assessment + gate middleware must complete before any Brand-DNA-consuming feature (Intro Funnel synthesis, Lead Gen drafts, Outreach reply intelligence, brand-voice drift-checks, Cockpit briefs). Gate middleware itself lands as BDA-4, immediately after BDA-3 completes Andy's profile.
6. **Setup Wizards before Intro Funnel (F1.d).** `WizardDefinition` primitive and step-type library must exist before the Intro Funnel questionnaire consumes them.
7. **Puppeteer lands on first consumer.** Quote Builder S3 adds the dependency + ships `renderToPdf()`. Branded Invoicing S2, Six-Week Plan S8, and Content Engine S8 consume it.

---

## Wave 0 — Pre-build spike

**Status: CLOSED 2026-04-13 — outcome B (on-brand link-out) locked.** See `sessions/p0-pixieset-spike-handoff.md`.

The Pixieset API spike (F2.c) ran as a one-session deliverable-independence check. Pixieset exposes no public developer API, no webhook, and no iframe embedding. Path A (inline native gallery) is structurally impossible; Path B (on-brand link-out + manual URL paste trigger) was v1.0. Alternatives mop-up declined (Pic-Time / Cloudspot / ShootProof share the same closed posture).

**⚠ SUPERSEDED 2026-04-18:** Pixieset replaced by **Cloudinary** for media delivery. Cloudinary has a full API — Path A (inline native gallery in portal) is now the path. The gallery page renders natively inside the portal via Cloudinary SDK, no link-out. Interim delivery via Dropbox until the Cloudinary pipeline is built. SW-5's Pixieset wizard (already shipped) will be replaced by a Cloudinary wizard in CLD-1. See Wave 10 addendum.

| ID | Type | Context | Purpose | Status |
|---|---|---|---|---|
| P0 | SPIKE | small | Pixieset API capability check (private gallery access, image-URL fetch, auth model, rate limits). | CLOSED — outcome B |

**Rollback:** n/a (research only, no code change).
**Settings keys:** none.

---

## Wave 1 — Foundation A (infrastructure primitives)

Every session from Wave 3 onward depends on Foundation-A completing. Sessions A1–A8 sized to one conversation each.

### A1 — Project initialisation
- **Type:** INFRA · **Context:** medium · **Model tier:** Sonnet
- **Builds:** Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn scaffolding + base layout shell + port 3001 (`next dev -p 3001`) + env/secrets scaffolding (`.env.example`, loud boot validation) + `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` wiring.
- **Owns:** app shell, base `app/layout.tsx`, env validator.
- **Consumes:** nothing.
- **Settings keys:** none.
- **Rollback:** git-revertable (no data shape).
- **Preconditions:** none.
- **Skills:** `nextjs16-breaking-changes`, `tailwind-v4`, `react-19`, `typescript-validation`.

### A2 — Design system tokens + theme/typeface presets
- **Type:** UI · **Context:** large · **Model tier:** Sonnet
- **Builds:** Design System Baseline S1 — CSS custom properties in `app/globals.css` + Tailwind theme + TypeScript export at `lib/design-tokens.ts`; 3 theme presets (standard/late-shift/quiet-hours); 3 typeface presets (house/long-read/dispatch); 6 user preferences (sounds, motion, density, text size, theme, typeface) seeded as columns on `user`; Settings → Display UI; `/lite/_design` reference route (admin-only).
- **Owns:** 40+ CSS vars, `user.{sounds_enabled, motion_preference, density_preference, text_size_preference, theme_preset, typeface_preset, first_signed_in_at}` columns, `lib/design-tokens.ts`, `/lite/_design` route.
- **Consumes:** A1 shell.
- **Settings keys:** none (defines preferences as user columns).
- **Rollback:** git-revertable; themes/typefaces are CSS+font-bundle swaps.
- **Skills:** `tailwind-v4`, `design-system-architect`, `baseline-ui`.

### A3 — Design system primitives (shadcn + custom wrappers)
- **Type:** UI · **Context:** large · **Model tier:** Sonnet
- **Builds:** Design System Baseline S2 — copy 14 shadcn/ui components into `components/ui/`; build custom wrappers: `AdminShell`, `BrandHero`, `SkeletonTile`, `EmptyState`, `Tier2Reveal`, `ThemeProvider`, `MotionProvider`, `SoundProvider`. Verify 10 accessibility variants (reduced-motion, sounds-off, large-text, compact, contrast, keyboard, focus-visible, screen-reader labels, aria-live for toasts, `prefers-reduced-motion: reduce` parity).
- **Owns:** component primitives under `components/ui/` + `components/lite/`.
- **Consumes:** A2 tokens.
- **Rollback:** git-revertable.
- **Skills:** `accessibility-aria`, `baseline-ui`.

### A4 — Motion + sound registry
- **Type:** UI · **Context:** medium · **Model tier:** Sonnet
- **Builds:** Design System Baseline S3 — `houseSpring` Framer preset in all transitions; 7 locked Tier 2 choreographies named and slotted; `use-sound` (Howler.js) integration with registry at `lib/sounds.ts` (7-item locked registry); reduced-motion fallbacks; OS `prefers-reduced-motion` integration; motion:`pdf_render_overlay` Tier 1 token per F3.b.
- **Owns:** `houseSpring` preset, 7 named Tier 2 choreographies, `lib/sounds.ts`.
- **Consumes:** A3 primitives.
- **Rollback:** feature-flag-gated (`motion_preference = 'reduced'` disables non-essential motion; `sounds_enabled = false` mutes all).
- **Skills:** `framer-motion`, `motion-design-principles`, `design-motion-principles`.

### A5 — Settings + permissions + kill-switches + ESLint rules
- **Type:** INFRA · **Context:** medium · **Model tier:** Sonnet
- **Builds:** `settings` table + `settings.get(key)` helper + seed migration from `docs/settings-registry.md` (60+ keys across Finance/Wizards/Plan/Portal/Hiring + any Wave-added keys from Foundation A7/A8/B3). Permissions module (`lib/auth/permissions.ts`) derived from Phase 3.5 access matrix (admin/client/prospect/anonymous/system roles). Kill-switch layer (`lib/kill-switches.ts`) — central feature flags for outreach / scheduled tasks / LLM calls / anything risky. Glossary TypeScript types (`lib/types/glossary.ts`) from FOUNDATIONS §13 (`Lead`, `Prospect`, `Client`, `Subscriber`, `Contact`, `Company`, `Deal`, `Quote`, `Invoice`, `Candidate`, `Hire`). ESLint no-direct-import rules: `@anthropic-ai/sdk`, `stripe.customers.create`, `resend.emails.send()` all blocked from feature code.
- **Owns:** `settings` table, `settings.get()`, `lib/auth/permissions.ts`, `lib/kill-switches.ts`, `lib/types/glossary.ts`, ESLint custom rules.
- **Consumes:** A1.
- **Settings keys:** seeds all 60+ registered keys.
- **Rollback:** migration reversible.
- **Skills:** `drizzle-orm`, `typescript-validation`, `nextauth`.

### A6 — activity_log + scheduled_tasks + formatTimestamp + LLM model registry + external_call_log + messages/threads schema
- **Type:** INFRA · **Context:** large · **Model tier:** Sonnet
- **Builds:** `activity_log` table + `logActivity()` helper (§11.1) with consolidated 166-value `kind` enum (from Phase 3.5 Batch A step 2a). `scheduled_tasks` table + background worker (§11-tier primitive per PATCHES_OWED row 29) with 31-value `task_type` enum. `formatTimestamp(date, tz)` utility + timezone column on `user` (§11.3). LLM model registry at `lib/ai/models.ts` (§11.6) — job names → model IDs. `external_call_log` table (source of truth for Observatory). `messages` + `threads` tables (producer-slice of Unified Inbox lands here because 4+ specs consume the schema before UI full stack ships).
- **Owns:** `activity_log`, `scheduled_tasks`, `external_call_log`, `messages`, `threads`, `logActivity()`, `scheduled_tasks` worker, `formatTimestamp()`, `lib/ai/models.ts`.
- **Consumes:** A1, A5.
- **Settings keys:** none.
- **Rollback:** migration reversible.
- **Skills:** `drizzle-orm`, `claude-api`.

### A7 — Email adapter + canSendTo + quiet window + drift check + Stripe helper + renderToPdf stub
- **Type:** INFRA · **Context:** large · **Model tier:** Sonnet
- **Builds:** Resend channel adapter with `sendEmail({ to, subject, body, classification, purpose, ... })` (§11.2). Classification enum seeded with full Phase 3.5 set: `transactional | outreach | portal_magic_link_recovery | deliverables_ready_announcement | six_week_plan_invite | six_week_plan_followup | six_week_plan_delivery | six_week_plan_revision_regenerated | six_week_plan_revision_explained | six_week_plan_expiry_email | hiring_invite | hiring_followup_question | hiring_trial_send | hiring_archive_notice | hiring_contractor_auth | hiring_bench_assignment`. `canSendTo(recipient, classification, purpose)` suppression/bounce/frequency gate. `isWithinQuietWindow()` (§11.4, Australia/Melbourne 08:00–18:00 Mon–Fri excluding public holidays from `/data/au-holidays.json`). `checkBrandVoiceDrift(draftText, brandDnaProfile)` (§11.5 — Haiku grader, full TS signature). `renderToPdf(htmlOrReactTree, opts)` wrapper stub (Puppeteer dependency lands with first consumer at QB-3). `ensureStripeCustomer(contactId)` (§11.7). `internal-only` JSDoc marker + ESLint-adjacent discipline (F2.d). Seeds `legal_doc_versions` reference table.
- **Owns:** `lib/channels/email/*`, `lib/ai/drift-check.ts`, `lib/stripe/customer.ts`, `lib/pdf/render.ts` stub, `/data/au-holidays.json`.
- **Consumes:** A5 (settings), A6 (activity_log, external_call_log).
- **Settings keys (NEW — add to registry in A5 seed):** `email.quiet_window_start_hour`, `email.quiet_window_end_hour`, `email.drift_check_threshold`, `email.drift_retry_count`.
- **Rollback:** feature-flag-gated via kill-switches (`outreach_send_enabled`, `drift_check_enabled`).
- **Skills:** `email-nodejs`, `claude-api`, `stripe`.

### A8 — Portal-guard primitive + Brand DNA Gate middleware
- **Type:** INFRA · **Context:** medium · **Model tier:** Sonnet
- **Builds:** `portal_magic_links` table (columns per Intro Funnel §10.1, generalised with nullable `submission_id` + new `client_id` column so Client Management reuses it). Portal-guard primitive: session-cookie check with magic-link-recovery fallback form. First-Login Brand DNA Gate middleware (§11.8) — `brand_dna_profiles.subject_type = 'superbad_self' AND status = 'complete'` check on every admin route; redirects to `/lite/onboarding` if missing; `BRAND_DNA_GATE_BYPASS=true` env-var escape hatch. Critical-flight middleware layering — Brand DNA gate runs first, `hasCompletedCriticalFlight(user)` runs second; both self-terminate per user on completion.
- **Owns:** `portal_magic_links` table, `lib/portal/guard.ts`, `middleware.ts` (Brand DNA gate + critical flight).
- **Consumes:** A5, A6, A7.
- **Settings keys:** `portal.magic_link_ttl_hours`, `portal.session_cookie_ttl_days`.
- **Rollback:** env-var bypass is the rollback (documented in INCIDENT_PLAYBOOK.md, owed Phase 6).
- **Skills:** `nextauth`.

**Foundation-A exit:** typecheck green, `npm test` green, dev server boots on :3001, `/lite/_design` renders, `settings.get('portal.magic_link_ttl_hours')` returns 48, `logActivity()` writes a row, `sendEmail()` is wired but gated behind `outreach_send_enabled = false`. Handoff written.

---

## Wave 2 — Foundation B (safety + compliance)

Can run in parallel with Wave 3 (Brand DNA) if scheduling warrants, but must complete before Wave 5 (Sales Pipeline) because B1's Sentry + `reportIssue()` footer lives on every admin surface. Keeping it sequential for autonomy-safety — parallelism adds coordination overhead that the autonomous build loop doesn't need.

### B1 — Sentry + reportIssue + cost alerts
- **Type:** INFRA · **Context:** medium · **Model tier:** Sonnet
- **Builds:** Sentry SDK (client + server + edge runtimes) with fingerprint-based dedupe; `lib/support/reportIssue(context)` primitive callable from every client-facing surface; "Report an issue" footer button global; `support_tickets` table (id, user_id, surface, page_url, description, session_replay_url, sentry_issue_id, status, created_at, resolved_at); `/lite/admin/errors` triage dashboard; Anthropic / Stripe / Resend cost-alert thresholds wired (email Andy when daily cap exceeded).
- **Owns:** `support_tickets`, `lib/support/reportIssue.ts`, `/lite/admin/errors` route.
- **Consumes:** A6 (`external_call_log` for cost aggregation), A7 (`sendEmail()` for alerts).
- **Settings keys (NEW):** `alerts.anthropic_daily_cap_aud`, `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold`. Added to registry in A5 seed patch.
- **Rollback:** feature-flag-gated (Sentry is read-only at boundary; disabling stops event send but doesn't affect app).

### B2 — Backups + DR + credential vault
- **Type:** INFRA · **Context:** medium · **Model tier:** Sonnet
- **Builds:** Litestream → Cloudflare R2 continuous replication; **mandatory restore-from-R2 verification** (not skippable per FOUNDATIONS reality-check); 7-year retention policy note in FOUNDATIONS §5 (ATO compliance); credential vault `lib/crypto/vault.ts` with `vault.encrypt(plaintext, context)` / `vault.decrypt(ciphertext, context)` (AES-256-GCM, key from `CREDENTIAL_VAULT_KEY`, AAD = context scope). No feature code imports raw crypto libraries.
- **Owns:** `lib/crypto/vault.ts`, Litestream config, DR runbook (seeds INCIDENT_PLAYBOOK.md stub).
- **Consumes:** A5 (settings for key locations), env vars.
- **Rollback:** Litestream can be disabled; vault is backwards-compatible with new-only encryption.

### B3 — Legal pages + cookie consent
- **Type:** FEATURE · **Context:** large · **Model tier:** Sonnet
- **Builds:** drafts the owed `docs/specs/legal-pages.md` spec inline (Stop 14 L1) + implements: `/lite/legal/{terms,privacy,acceptable-use,cookie-policy,index}` static MDX pages (LLM-drafted from template + Andy approve-once per `feedback_no_content_authoring`); `legal_doc_versions` reference table (version hash + effective_date per document); GDPR cookie-consent banner (geo-gated: MaxMind lookup → EU IPs get full reject-all/accept-all/manage-categories banner, everyone else gets a permanent footer "We use cookies — details" link to `/lite/legal/cookie-policy`); `cookie_consents` audit table for EU traffic; consent state in localStorage + echo to DB. Evaluates Klaro vs rolled-your-own inside the session and picks (technical call, no Andy question).
- **Owns:** `docs/specs/legal-pages.md`, `legal_doc_versions`, `cookie_consents`, `/lite/legal/*` routes.
- **Consumes:** A2 (design tokens for legal page styling), A3 (primitives), B1 (Sentry for consent-banner error telemetry).
- **Settings keys (NEW):** `legal.dsr_email`, `legal.dsr_response_days`. Added to registry.
- **Rollback:** git-revertable; cookie banner is client-only rendering.

**Foundation-B exit:** typecheck/test green, Sentry captures an intentional throw, Litestream restore drill completes, vault round-trips a test secret, `/lite/legal/privacy` renders for logged-out visitors, GDPR banner shows from a spoofed EU IP. Handoff written.

---

## Wave 3 — Brand DNA Assessment (perpetual context — hard gating constraint)

Per F2.b + FOUNDATIONS §11.8, SuperBad-self slice must complete before any downstream Brand-DNA-consuming feature. Andy completes his own assessment at the end of BDA-3; the gate middleware (already implemented in A8) flips from "redirect to onboarding" to "clear" once his profile lands `status = 'complete'`.

| ID | Type | Context | Owns | Consumes | Settings keys | Rollback |
|---|---|---|---|---|---|---|
| BDA-1 | FEATURE | medium | `brand_dna_profiles`, `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites`, invite-token flow | A5, A6, A7 | none | migration reversible |
| BDA-2 | FEATURE | medium | card UI per question + save/resume + between-section shimmer (Haiku insight calls) + visual environment per section | A3, A4, BDA-1, A7 (`checkBrandVoiceDrift`) | none | feature-flag-gated |
| BDA-3 | FEATURE | large | Opus prose portrait + first-impression + company blend + reveal choreography (Tier 2 motion slot 1) + `sound:brand_dna_reveal` | BDA-2, A4 | none | feature-flag-gated |
| BDA-4 | FEATURE | small | SuperBad-self completion flips gate middleware to "clear"; `hasCompletedCriticalFlight()` check continues to Setup Wizards critical flight on next admin nav | BDA-3, A8 | none | env-var bypass |
| BDA-5 | FEATURE | medium | client-facing paths: portal gate + multi-stakeholder blends + retake comparison flow. **⚠ SKIPPED — not built when Wave 3 advanced past BDA-4. Scheduled for catchup after Wave 13 (LG) completes, before CM-8.** | BDA-4 | none | feature-flag-gated per client |

**Critical-flow tag:** none directly (Brand DNA gates downstream critical flows indirectly).
**E2E:** none at this wave (not a critical flow).
**Prompt files:** 5 Opus prompts in `lib/ai/prompts/brand-dna-assessment/*.ts`.

---

## Wave 4 — Setup Wizards (WizardDefinition gating — F1.d)

Must ship before IF-1. Admin critical-flight (SW-4) depends on Brand DNA complete (Wave 3).

| ID | Type | Context | Owns | Consumes |
|---|---|---|---|---|
| SW-1 | INFRA | medium | `wizard_progress`, `wizard_completions`, `integration_connections`, shell chrome, `WizardDefinition` interface | A3, A5, A6 |
| SW-2 | FEATURE | large | 10 step-types: form, oauth-consent, api-key-paste, webhook-probe, dns-verify, csv-import, async-check, content-picker, review-and-confirm, celebration | SW-1 |
| SW-3 | FEATURE | small | vendor manifest + Observatory registration contract + completion-contract enforcement | SW-2 |
| SW-4 | FEATURE | medium | Admin critical-flight (Stripe → Resend → Graph API → capstone) + middleware from A8 | SW-3, A8 |
| SW-5 | FEATURE | large | Admin integration wizards (Stripe, Resend, Graph API, ~~Pixieset~~ → Cloudinary (CLD-1 replaces), Meta Ads, Google Ads, Twilio, generic API-key+OpenAI+Anthropic+SerpAPI+Remotion) | SW-4, B2 (vault) |
| SW-6 | FEATURE | medium | `wizard_resume_nudge` (24h), `wizard_expiry_warn` (29d), `wizard_auto_expire` (30d); voice & delight treatment | SW-5, A6 (`scheduled_tasks`), A7 (`sendEmail`) |

**Settings keys:** `wizards.expiry_days`, `wizards.resume_nudge_hours`, `wizards.max_resume_count`, `wizards.admin_idle_banner_days`.
**Crons owned:** `wizard_resume_nudge`, `wizard_expiry_warn`, `wizard_auto_expire`.

---

## Wave 5 — Sales Pipeline (CRM spine)

Owns `companies`, `contacts`, `deals`. Every revenue spec consumes.

| ID | Type | Context | Purpose |
|---|---|---|---|
| SP-1 | INFRA | medium | Schema: `companies` + `companies.shape` canonical column (F1.b) + `contacts` + `contacts.stripe_customer_id` + `deals` + `deals.{subscription_state, committed_until_date, pause_used_this_commitment, billing_cadence, stripe_subscription_id, stripe_customer_id, won_outcome}` + `activity_log.kind` enum final state (166 values). `createDealFromLead()` with contact dedupe (email + phone fallback). |
| SP-2 | FEATURE | small | 8-stage state model + `validateDeal()` + `transitionDealStage()` |
| SP-3 | UI | large | Kanban board (8 columns, card compact/hover views, drag-to-transition, Tier 1 motion) |
| SP-4 | UI | small | Stale-deal halo + snooze affordance |
| SP-5 | FEATURE | small | Trial Shoot panel + `trial_shoot_status` sub-machine |
| SP-6 | FEATURE | small | Won/Lost flows + `billing_mode` field + loss-reason modal |
| SP-7 | INFRA | medium | Stripe webhook handlers (`checkout.session.completed`, `payment_intent.succeeded`) + idempotent `stripe_processed_events` table |
| SP-8 | INFRA | medium | Resend inbound webhook + bounce/complaint handling + stage rollback + `do_not_contact` flag |
| SP-9 | UI | medium | Voice + delight (empty states, Tier 2 Won flavour, sprinkle claims per S&D registry) |

**Settings keys:** `pipeline.stale_thresholds.lead_days`, `pipeline.stale_thresholds.contacted_days`, … (one per stage), `pipeline.snooze_default_days`.
**Crons:** none (event-driven).
**Rollback:** SP-1 migration reversible; SP-7/SP-8 webhook handlers feature-flag-gated; SP-3 UI git-revertable.

---

## Wave 6 — Quote Builder (critical flow: Quote Accept)

Lands Puppeteer dependency + `renderToPdf()` real implementation in QB-3.

| ID | Type | Context | Purpose |
|---|---|---|---|
| QB-1 | INFRA | small | `quotes`, `quote_templates`, `catalogue_items`, `quote_number` sequence; scheduled_tasks handlers slot. |
| QB-2 | UI | large | Two-pane editor + live preview + catalogue picker + template CRUD |
| QB-3 | INFRA+UI | medium | **Puppeteer dependency lands here** + `renderToPdf()` full implementation + quote PDF + send-email composition (Claude-drafted, drift-checked) |
| QB-4 | UI | large | Client web page (scroll-snap) + intro-paragraph synthesis (Opus) + view tracking + Payment Element reveal (Tier 2 motion) + tickbox for ToS/privacy (per Stop 14 L4) |
| QB-5 | FEATURE | medium | Deal stage transitions (Conversation → Quoted → Won) + confirmation screen branching (Stripe vs manual-billed) + first-cycle `manual_invoice_generate` enqueue (per Branded Invoicing refinement) + `ensureStripeCustomer()` call before Checkout |
| QB-6 | INFRA | medium | Scheduled-task handlers: `quote_reminder_3d`, `quote_expire`, `manual_invoice_generate`, `manual_invoice_send` chain |
| QB-7 | FEATURE | small | Supersede (new row, old void) + withdrawal + expired/withdrawn URL states |
| QB-8 | FEATURE | small | Early-cancel flow skeleton (data shape only; UI in CM-wave) |
| QB-E2E | TEST | small | **Playwright E2E suite: deal → quote → accept → pay.** Mandatory critical flow. |

**Settings keys:** `quote.default_expiry_days`, `quote.setup_fee_monthly_saas`, `portal.magic_link_ttl_hours`.
**Crons owned:** `quote_reminder_3d`, `quote_expire`, `manual_invoice_generate`, `manual_invoice_send`.
**Rollback:** migration reversible; feature-flag-gated at Send + at Accept.

---

## Wave 7 — Branded Invoicing (critical flow: Invoice Pay)

| ID | Type | Context | Purpose |
|---|---|---|---|
| BI-1 | INFRA | small | `invoices` table + `manual_invoice_generate`/`manual_invoice_send` handlers (consume QB-6 worker) + `invoice_number` sequence |
| BI-2 | UI | medium | ATO-compliant invoice PDF (single page, ABN, "Tax Invoice" title, itemised GST, globally unique number) via `renderToPdf()` |
| BI-3 | UI | medium | Admin invoice detail + index + company billing tab + summary cards (Outstanding, Overdue, Paid) |
| BI-4 | UI | large | Client web view (two-section scroll-snap: invoice + payment) + Stripe Payment Element inline reveal + bank transfer details |
| BI-5 | FEATURE | medium | Email composition (Claude-drafted, PDF attached, "View online" link, drift-checked) + overdue-reminder automation (3d post-due, warm tone) |
| BI-6 | FEATURE | small | Manual one-off invoice entry (Deal/Company profile) + edit-after-send supersede (void + new) |
| BI-7 | INFRA | small | Stripe webhook `payment_intent.succeeded` handler + mark-as-paid admin action + chain-stop on deal exit |
| BI-E2E | TEST | small | **Playwright E2E: retainer → first invoice → pay.** Mandatory critical flow. |

**Settings keys:** `invoice.payment_terms_default_days`, `invoice.review_window_days`, `invoice.overdue_reminder_days_after_due`.
**Crons owned:** invoice overdue transition, `handleInvoiceOverdueReminder`.
**Rollback:** migration reversible; feature-flag-gated at Send.

---

## Wave 8 — SaaS Subscription Billing (critical flow: SaaS Signup)

| ID | Type | Context | Purpose |
|---|---|---|---|
| SB-1 | INFRA | small | `saas_products`, `saas_tiers`, `usage_records` + Stripe Product/Price sync |
| SB-2 | FEATURE | large | Product admin via wizard shell (SW-5 integration) — name, dimensions, tiers, pricing, feature flags, demo config, publish |
| SB-3 | UI | medium | Public pricing page `/get-started/pricing` + Full Suite positioning |
| SB-4 | UI | large | Per-product interactive demo landing pages (optional; skip per product if time-tight) |
| SB-5 | UI | medium | Checkout page + commitment toggle + Stripe Payment Element + tickbox for ToS/privacy (Stop 14 L4) |
| SB-6 | FEATURE | medium | Stripe Subscription creation (3 cadences) + setup fee (`add_invoice_item`) + deal creation at Won + `ensureStripeCustomer()` |
| SB-7 | FEATURE | medium | `checkUsageLimit()` + `recordUsage()` + sticky bar + approaching-cap prompts + hard-cap blocks |
| SB-8 | FEATURE | medium | Tier change (upgrade immediate + pro-rated; downgrade end-of-period) + product switch (Stripe Subscription item mutations) |
| SB-9 | FEATURE | medium | Payment failure sequence (lockout + card update form + 7–10d escalation + data-loss warning) |
| SB-10 | FEATURE | large | Subscriber portal (locked before payment, unlocked post-Brand-DNA, chat context tier-aware) |
| SB-11 | FEATURE | small | Multi-subscription tracking + per-subscription cancel flow |
| SB-12 | FEATURE | small | Setup-fee mechanics (not charged on switch/reactivate; closes resubscribe loophole) |
| SB-E2E | TEST | small | **Playwright E2E: pricing → checkout → payment → Brand DNA → unlocked.** Mandatory. |

**Settings keys:** `billing.saas.monthly_setup_fee_cents`, `portal.chat_calls_per_day_pre_retainer`, `portal.chat_calls_per_day_retainer`, `portal.magic_link_ttl_hours`.
**Crons owned:** `saas_subscription_usage_reset_on_period`, `payment_failure_escalation_initial`, `payment_failure_escalation_warning`, `saas_pause_reminder`.
**Rollback:** migration reversible; feature-flag-gated at public signup + at portal unlock.

---

## Wave 9 — Unified Inbox (producer slice — `messages`/`threads` schema already landed in A6)

UI's full stack ships here. Producer slice (tables) was pulled up to A6 so CCE-1, CM-10 can consume the schema without reaching forward.

| ID | Type | Context | Purpose |
|---|---|---|---|
| UI-1 | INFRA | medium | Graph API client wrapper + M365 sync layer + OAuth via SW-5 Graph API wizard |
| UI-2 | FEATURE | medium | Inbound router classifier (Haiku) + contact resolution + auto-create |
| UI-3 | FEATURE | small | Notification triage classifier (Haiku) + push vs silent gate |
| UI-4 | FEATURE | small | Signal/noise classifier (Haiku) + auto-delete cron (daily 23:00) |
| UI-5 | FEATURE | medium | Thread draft generation (Opus) + cached-draft retrieval |
| UI-6 | FEATURE | medium | Compose-new + "draft this for me" intent-to-draft |
| UI-7 | FEATURE | small | Refine-chat sidecar (Opus instruction-based rewrite) |
| UI-8 | UI | medium | Desktop three-column + thread list + thread detail |
| UI-9 | UI | small | Per-contact Conversation view (flattened thread history) |
| UI-10 | FEATURE | small | support@ ticket overlay + type classifier + status workflow |
| UI-11 | UI | medium | Mobile PWA bottom-tab + offline queue |
| UI-12 | FEATURE | medium | History import wizard + 12-month backfill + progress tracking |
| UI-13 | FEATURE | small | Daily 08:00 digest email + voice |

**Settings keys:** `inbox.signal_noise_signal_only_default`, `inbox.auto_delete_noise_days`, `inbox.auto_delete_transactional_days`, `inbox.auto_delete_spam_days`, `inbox.history_import_months`, `inbox.draft_cache_ttl_hours`.
**Crons owned:** `inbox_daily_digest` (08:00 Mel), `inbox_auto_delete_purge` (daily 23:00), `inbox_graph_sync` (every 5 min), `inbox_history_import_backfill` (on-demand).
**Rollback:** feature-flag toggles M365 vs Outlook; Graph sync is read-side only; deletions have 14d grace bin.

---

## Wave 10 — Client Management (critical flow: Portal Auth)

| ID | Type | Context | Purpose |
|---|---|---|---|
| CM-1 | INFRA | small | `portal_chat_messages` + portal auth wiring (consumes A8 guard + `portal_magic_links`) |
| CM-2 | UI | large | Admin company profile (7 tabs: Overview / Deliverables / Billing / Brand DNA / Comms / Portal Chat / Activity) |
| CM-3 | UI | large | Admin contact profile (5 tabs) — Context Engine tile stubs (CCE wires later) |
| CM-4 | UI | medium | Clients index + global search (Cmd+K) — admin-only keyboard shortcut |
| CM-5 | FEATURE | large | Portal chat home (bartender Opus) + rate-limited chat |
| CM-6 | FEATURE | medium | Portal menu + navigation + retainer-mode gate |
| CLD-1 | INFRA | medium | Cloudinary integration: vendor manifest (replaces Pixieset), admin wizard (API key + cloud name), `lib/cloudinary/` module (upload, list, transform URLs), replace `pixieset_gallery_url` with `cloudinary_gallery_folder` on `deals` schema. Removes/replaces: `lib/integrations/vendors/pixieset.ts`, `lib/wizards/defs/pixieset-admin.ts`, `actions-pixieset.ts`, `pixieset-admin-client.tsx`, `tests/pixieset-admin-wizard.test.ts`. |
| CLD-2 | UI | large | Portal gallery page at `/portal/[token]/gallery` — native Cloudinary-powered image/video grid. Pulls from `deals.cloudinary_gallery_folder` via Cloudinary SDK. Per-item download button + "Download all" ZIP trigger. Responsive masonry layout. Empty state in bartender voice. `deliverables_viewed` activity log on page mount. |
| CM-7 | UI | medium | Bundled first-visit hub (Gallery + Plan tiles) — F3.a + `motion:bundle_reveal`. Gallery tile routes to internal `/portal/[token]/gallery` (CLD-2), not external link-out. Plan tile routes to `/portal/[token]/plan`. |
| CM-7b | UI | small | Portal deliverables page — inline preview panel per deliverable (expand card to see content + checklist + approve/reject in place). Per-deliverable download button for delivered items. Download button on individual checklist items where applicable. |
| CM-8 | FEATURE | small | Portal retainer-mode kickoff (Brand DNA gate + bartender kickoff variant) — F4.b |
| CM-9 | INFRA | medium | Data export primitive (background ZIP via `scheduled_tasks`, 7d expiry) |
| CM-10 | FEATURE | medium | Comms threading (consumes UI `messages`) + Portal Chat tab (read-only admin view + escalation flagging) |
| CM-11 | FEATURE | small | Private notes (Visible to AI toggle) |
| CM-12 | UI | small | Portal polish + responsive + dark-mode + S&D ambient slots |
| CM-E | FEATURE | small | **Referral surface** (added 2026-04-18). Portal menu "Know someone?" item + 2-field form + `createDealFromLead(source:'referral')` + Opus follow-up draft referencing referrer by name + portal chat acknowledgement + contextual milestone prompt (deliverable approved / reflection submitted / 90-day mark) with 30-day suppression. `referral_from_company_id` + `referral_from_contact_id` on deals. Spec: `client-management.md §24`. |
| CM-E2E | TEST | small | **Playwright E2E: magic link → session cookie → unlocked portal.** Mandatory. |

**Settings keys:** `portal.chat_calls_per_day_pre_retainer`, `portal.chat_calls_per_day_retainer`, `portal.data_export_zip_ttl_days`, `portal.magic_link_ttl_hours`, `portal.session_cookie_ttl_days`.
**Crons owned:** `data_export_generate`, `portal_archive_non_converter`.

---

## Wave 11 — Onboarding + Segmentation

| ID | Context | Purpose |
|---|---|---|
| OS-1 | medium | Company auto-creation + 7-column `companies` patch + `onboarding_welcome_seen_at` + `getOnboardingState()` + retainer/SaaS welcome screens + welcome-email Opus prompt (drift-checked) |
| OS-2 | medium | Revenue Segmentation UI (5-question card-per-question) + practical setup steps + upsell layer |
| OS-3 | small | Token portal auth (reuses A8) + credential creation + non-start nudge cadence |

**Crons:** `onboarding_nudge_email`, `practical_setup_reminder_email`.

---

## Wave 12 — Content Engine

Sessions CE-1..CE-13 per group 3 breakdown. Depends on: SW-5 (domain-verify wizard), A7 (`sendEmail` + drift check), LG wave for content-to-outreach matching (CE-13 consumes Lead Gen queue).

**Settings keys:** `content.tier`, `content.send_window_day`, `content.send_window_hour`, `content.max_posts_per_month`, `content.max_subscribers_per_tier`.
**Crons:** `content_keyword_research` (weekly per owner), `content_generate_draft` (continuous, tier-paced), `content_fan_out` (on approval), `content_newsletter_send` (configurable window), `content_ranking_snapshot` (weekly per post), `content_outreach_match` (on publish).

---

## Wave 13 — Lead Generation

Sessions LG-1..LG-10 per group 3. Depends on SW-5 (integration wizards for SerpAPI/Hunter.io/etc.), A7 (warmup ramp in email adapter), A8 for DNC enforcement surface, Wave 5 SP-1 for `createDealFromLead()`, BDA-4 for drafts that read Brand DNA.

**Settings keys:** `lead_generation.daily_search_enabled`, `lead_generation.daily_max_per_day`, `lead_generation.dedup_window`, `lead_generation.location_radius`, `lead_generation.category`, `lead_generation.standing_brief`, `lead_generation.run_time`, plus `warmup.daily_cap_week_N` series.
**Crons:** `lead_gen_daily_search` (03:00 daily), `sequence_scheduler`, `engagement_tier_evaluator`, Resend webhook handlers (bounce, complaint, opens, clicks).

---

## Wave 13b — Lead Gen addendum + Free Audit Tool (added 2026-04-18)

Wave 13 (LG-1..LG-10) is closed. These sessions add three spec patches to existing Lead Gen infrastructure plus the new Free Audit Tool. All dependencies are already built: LG enrichment pipeline, scoring engine, PDF renderer (QB-3), `sendEmail()` (A7), `createDealFromLead()` (LG-1), Brand DNA gate (BDA-4).

| ID | Type | Context | Purpose |
|---|---|---|---|
| LG-11 | FEATURE | medium | **Case snippets + retargeting pixel + autonomy adjustment.** `case_snippets` table + migration. Shoot-completion trigger (handler fires on `intro_funnel_reflection_completed` activity — handler exists from day one, fires once IF is built). 90-day retainer trigger via `scheduled_tasks` (enqueued on Deal Won). 48h auto-approve handler. Outreach prompt patch: query best-matching snippet by vertical, include in §8.2 inputs. Outreach link wrapping: redirect endpoint at `/api/outreach/click` with HMAC validation + Meta/Google pixel firing + `retargeting.meta_pixel_id` / `retargeting.google_conversion_id` settings. Autonomy graduation threshold 10→5 migration. Material/minor edit classifier (`classifyEdit()` with Levenshtein + ratio heuristic). `approval_kind` enum extension (`minor_edit_manual`, `edited_manual`). Spec: `lead-generation.md §17, §18, §18b`. |
| AT-1 | FEATURE | large | **Free Audit Tool backend.** Form handler with Turnstile + honeypot + IP rate limit + daily cap validation. Enrichment orchestration (reuses LG-2/LG-3 pipeline with social-handle overrides). Audit scoring engine (`scoreAuditCategory` × 5 categories + `scoreAuditOverall`). Per-category Haiku explanations. Deal creation via `createDealFromLead(source:'audit_tool')` + domain dedup. Opus follow-up draft referencing weakest category. PDF generation via shared `renderToPdf()`. Report delivery email. SSE endpoint for processing progress. `audit_submissions` + `audit_rate_limits` tables + migration. Lead gen cross-pollination: daily search reuses audit viability profiles within 90d + `audit.scoring_boost` (+8). Spec: `docs/specs/free-audit-tool.md`. |
| AT-2 | UI | large | **Free Audit Tool frontend.** Form page at `/get-started/audit` with progressive disclosure for optional social handles. Cloudflare Turnstile widget. Cinematic processing reveal: SSE consumer with per-signal status lines (house spring transitions) → 1.5s beat → overall grade reveal (large type + scale-up + `score-reveal` sound) → category build-in (staggered 200ms fade-up). Results page with colour-coded grades + explanations. Graceful degradation (<3 categories = simplified results). Spec: `docs/specs/free-audit-tool.md`. |

**Settings keys (new):** `audit.daily_cap`, `audit.rate_limit_per_ip`, `audit.scoring_boost`, `audit.profile_reuse_days`, `snippet.auto_approve_hours`, `retargeting.meta_pixel_id`, `retargeting.google_conversion_id`, `autonomy.graduation_threshold`, `autonomy.minor_edit_char_threshold`, `autonomy.material_edit_ratio_threshold`.
**Crons:** `case_snippet_auto_approve` (48h after creation), `case_snippet_retainer_90d` (90 days after Deal Won).
**Rollback:** LG-11 git-revertable (additive schema). AT-1/AT-2 feature-flag-gated via `audit.daily_cap` = 0.

---

## Wave 13c — Patch mop-up (added 2026-04-18)

Orphaned patches identified by cross-referencing PATCHES_OWED.md against BUILD_PLAN.md. Each item references a session type that no existing wave covers. Sequenced here as a lightweight mop-up wave; sessions are independent and can run in any order. All dependencies already built.

| ID | Type | Context | Purpose |
|---|---|---|---|
| PM-1 | UI | small | **Settings → Display UI panel.** Build `app/lite/admin/settings/display/page.tsx` — 6-control preferences panel (sounds, motion, density, text size, theme, typeface) reading/writing the `user` table columns seeded in A5. Consumes A2 tokens, A3 primitives, A8 auth. PATCHES_OWED: line 233 (`post-A8 UI session`). |
| PM-2 | UI | medium | **Design-system-baseline revisit.** Reconcile 4 deferred patches: (a) `motion:pdf_render_overlay` Tier 1 token formalisation (PATCHES_OWED line 183); (b) `motion:bundle_reveal` Tier 2 candidate registration (line 196); (c) Won card outcome badge — 9th BHS location or swap (line 41); (d) sound registry name reconciliation `sp9_sound_registry_name_map` — map spec slots `chime-bright`/`tick-warm`/`urgent-thud` to registry entries (line 484). Update `docs/specs/design-system-baseline.md` + `lib/motion/choreographies.ts` + `lib/sounds.ts` as needed. |
| PM-3 | INFRA | medium | **Realtime channel (SSE push layer).** Build server-sent-events infrastructure for admin surfaces. Wires 3 deferred patches: (a) `sp9_bounce_rollback_toast` — admin toast on contact bounce with `urgent-thud` sound (line 482); (b) `sp9_payment_failed_urgent_toast` — admin toast on `invoice.payment_failed` (line 483); (c) `qb4c_sound_quote_accepted_emit` — `quote-accepted` sound on public quote page confirmation (line 497). Minimal SSE: event bus + `/api/admin/events` endpoint + `useAdminEvents()` client hook + toast consumer. |
| PM-4 | INFRA | small | **Subscription state naming reconciliation.** Rename `DEAL_SUBSCRIPTION_STATES` enum values to match FOUNDATIONS §12 canonical names: `active` → `active_current`, `pending_early_exit` → `cancel_scheduled_preterm`, plus any other drifted values. Migration + cascade through all consumers (PI-succeeded writer, cancel flow, SaaS headline signals, subscription webhooks). PATCHES_OWED: `qb_subs_subscription_state_naming_drift` (line 496). Gate said "pre-Wave 7 cleanup" — Wave 7 closed without it. |
| PM-5 | INFRA | small | **`invoke.ts` system-role plumbing.** Add optional `system` parameter to `invokeLlmText()` in `lib/ai/invoke.ts`, route via Anthropic SDK `system` field. Migrate all callers: `draft-reply.ts`, `compose-draft.ts`, `refine-draft.ts` (and any others). Closes the composition-layer-vs-wire-layer gap logged across UI-5/6/7 (`ui_5_invoke_system_role_plumbing`, `ui_6_invoke_system_role_plumbing_still_owed`, `ui_7_invoke_system_role_plumbing_still_owed`). **Must land before CCE-1 (Wave 16)** — CCE payload will be richer and the system/user split becomes load-bearing. |
| PM-6 | DISCIPLINE | — | **Visual remediation discipline patch.** Not a build session — a brief-writing discipline update. Extend AUTONOMY_PROTOCOL.md §G0 preconditions: every net-new portal/funnel/cockpit UI session must cite its `mockup-*.html` in §2a of the brief, or cut a surface-specific mockup first. Covers `bdapolish1_visual_remediation_backlog` (PATCHES_OWED line 490). Portal, Intro Funnel, and Cockpit surfaces are still unbuilt — their build sessions (CM-5+, IF-1+, DC-1+) will naturally pick up the discipline if this patch lands before their briefs are written. |
| PM-7 | UI | small | **LG queue edit/nudge buttons.** Add inline draft editing + nudge-chat button to the approval queue at `/lite/admin/lead-gen`. Edit: opens draft body in editable textarea, saves via existing `updateOutreachDraftAction`. Nudge: opens nudge-chat sidecar (Opus instruction-based rewrite, same pattern as UI-7 refine). PATCHES_OWED: `lg_7_edit_nudge_buttons` (line 715). |

**Sequencing:** PM-1 through PM-5 and PM-7 can run any time after Wave 13 completes and before their downstream consumers (PM-5 strictly before CCE-1). PM-6 should land before CM-5's brief is written (i.e., immediately — CM-5 is next in the queue). Recommend running PM-6 first (zero code, just a doc patch), then PM-4 and PM-5 (small infra), then PM-1/PM-2/PM-3/PM-7 (UI work) interleaved with Wave 10 sessions as context allows.

**Settings keys:** none new (PM-1 reads existing user columns; PM-4 is a rename).
**Crons:** none.
**Rollback:** PM-1/PM-2/PM-7 git-revertable. PM-3 feature-flag-gated via kill-switch. PM-4 migration reversible. PM-5 git-revertable (additive parameter). PM-6 doc-only.

---

## Spec Patch — SPEC-PATCH-IF-CLD (Intro Funnel: Pixieset → Cloudinary)

**Scheduled after LG-10, before Wave 14 begins.**

Single session. Rewrites the intro-funnel spec to replace all Pixieset references with the Cloudinary delivery model decided in the Client Management wave (CLD-1/CLD-2). Key changes:

- §15 rewritten: gallery is a native in-portal page via Cloudinary SDK, not a Pixieset link-out.
- Data model: `pixieset_gallery_id` / `pixieset_gallery_url` → `gallery_asset_folder` (or similar Cloudinary-native key). Bundle gate trigger becomes Cloudinary upload completion, not URL paste.
- §7.6 setup wizard: Pixieset credential step removed (Cloudinary credentials already covered by CLD-1).
- §20.6 `parsePixiesetUrl()` utility dropped.
- PATCHES_OWED.md: stale Pixieset entries updated or closed.
- §21 risk register: Pixieset retention risk replaced with Cloudinary-appropriate risks.

No code changes — spec-only patch to unblock Wave 14 builds against the correct integration.

---

## Wave 14 — Intro Funnel (critical flow: Trial Shoot Booking)

| ID | Context | Purpose |
|---|---|---|
| IF-1 | large | Landing + questionnaire (SW-2 step-types) + Stripe Payment Element + `createDealFromLead()` + `ensureStripeCustomer()` |
| IF-2 | large | Calendar booking + confirmation + reminders + shoot-day portal view + reflection form + on-brand "Your gallery is ready" launch card. (P0 outcome B superseded 2026-04-18: Cloudinary replaces Pixieset. CTA routes to internal `/portal/[token]/gallery` via CLD-2. `deliverables_viewed` fires on gallery page mount. Tier-2 reveal lives on the launch card.) |
| IF-3 | large | Retainer/SaaS offer + synthesis Opus (reads Brand DNA via BDA-4 gate) + quote recommendation + abandon tracking + drift check |
| IF-4 | medium | Portal-guard recovery flow (consumes A8) + OTT magic-link embedding at every send point |
| IF-E2E | small | **Playwright E2E: landing → questionnaire → booking → payment.** Mandatory. |

**Settings keys:** `trial_shoot.price`, `intro_funnel.reflection_delay_hours_after_deliverables`, plus the 8 F2.e sweep keys (abandon cadence, advance notice, per-week cap, reschedule limit, refund window, SMS/email quiet hours, shoot duration).
**Crons:** `intro_funnel_abandon_check` (daily), `intro_funnel_booking_reminder` (per booking, 24h/2h before), `intro_funnel_reflection_reminder` (post-shoot).

---

## Wave 15 — Six-Week Plan Generator

Sessions SWP-1..SWP-10 per group 2. Requires IF-2 (shoot-day notes entry point), BDA-4 (Brand DNA read), A7 (drift check), A6 (`scheduled_tasks`), CCE tables (SWP-9 migrate-on-Won to `active_strategy`).

**Settings keys:** `six_week_plan.max_regens_per_plan_24h`, `plan.expiry_email_days_before_archive`, `plan.extend_portal_days_on_manual_override`, plus the full Plan section (10 keys total).
**Crons:** `six_week_plan_generate` (enqueued on shoot-day-notes submit), `six_week_plan_migrate_on_won`, `six_week_plan_expiry_email` (day 53), `six_week_plan_non_converter_expiry` (day 60 archive).

---

## Wave 16 — Client Context Engine

CCE sits late because it reads from every producing surface: `messages` (UI), `deals` (SP), `tasks` (TM), `invoices` (BI), `brand_dna_profiles` (BDA), `companies` (SP), activity_log (A6).

| ID | Context | Purpose |
|---|---|---|
| CCE-1 | medium | `context_summaries`, `action_items`, `private_notes`, `llm_usage_log` + `assembleContext()` + `computeHealthScore()` rule engine + `getSignalsForContact()` + `getActionItems()` |
| CCE-2 | medium | Summary regen + action-item extraction (Haiku) + dedup + event-to-section mapping |
| CCE-3 | large | Draft drawer UI (Tier 2 motion) + draft generation (Opus) + nudge/reformat + channel switcher + unsent draft persistence + cold-prospect fallback |

**Crons:** `context_summary_regenerate`, `context_action_item_extract` (both via `scheduled_tasks`).
**Rollback:** feature-flag-gated per contact; no data shape change.

---

## Wave 17 — Task Manager

Sessions TM-1..TM-9 per group 3. Depends on CCE for morning-digest narrative context (though digest can render without CCE — graceful fallback).

**Settings keys:** `tasks.morning_digest_enabled`, `tasks.morning_digest_time`, `tasks.deliverable_approval_token_ttl_days`.
**Crons:** `task_morning_digest` (08:00 Mel daily), recurrence-spawn handler.

---

## Wave 18 — Hiring Pipeline

Sessions HP-1..HP-19 per group 4. Depends on Wave 12 CE (claimable-backlog contract), SW-5 (Role Brief + onboarding wizard shells), UI (reply routing), TM (bench availability contract).

**Settings keys (28):** all `hiring.apply.*`, `hiring.discovery.*`, `hiring.invite.*`, `hiring.trial.*`, `hiring.brief.*` keys per registry.
**Crons:** `hiring_discovery_run`, `hiring_invite_followup_check`, `hiring_bench_pause_ending`, `hiring_role_brief_regenerate`.

---

## Wave 19 — Finance Dashboard

Sessions FD-1..FD-14 per group 4. Depends on BI (invoices), SB (subscriptions), SP (deals), COB (external_call_log roll-up — but COB ships after FD, so FD-5 cost roll-up is stubbed and wired live when COB lands).

**Settings keys:** `finance.income_tax_rate`, `finance.bas_reminder_days_ahead`, `finance.eofy_reminder_days_ahead`, `finance.overdue_invoice_threshold_days`, `finance.outstanding_invoices_threshold_aud` (11 keys total).
**Crons:** `finance_snapshot_take` (06:00 Mel), `finance_narrative_regenerate` (on-demand), `finance_recurring_expense_book` (06:15), `finance_observatory_rollup` (06:10), `finance_stripe_fee_rollup` (06:12).

---

## Wave 20 — Surprise & Delight

Sessions SD-1..SD-14 per group 4. Depends on BDA (drift check substrate), CCE (milestone extraction), all surfaces (ambient slots). S&D is voice/ambient-layer *inside* existing surfaces — not a new surface itself. Content track (SD-15 in group 4 summary) is a separate content mini-session.

**Settings keys:** `surprise.hidden_eggs_enabled`, `surprise.public_egg_cadence_per_days`, `surprise.admin_egg_cadence_per_days`, `surprise.ambient_copy_refresh_interval_days`, `surprise.riddle_wrong_answer_fallback_budget_per_riddle`.
**Crons:** `ambient_copy_generate`, `hidden_egg_fire_cleanup`, `riddle_answer_fallback_budget_monitor`.

---

## Wave 21 — Cost & Usage Observatory (aggregator)

Sessions COB-1..COB-11 per group 4. Reads from `external_call_log` (owned by A6); aggregates every wave's LLM + API spend. Emits banners into DC via `getHealthBanners()`.

**Settings keys:** `observatory.monthly_threshold_1_aud`, `observatory.monthly_threshold_2_aud`, `observatory.monthly_threshold_3_aud`, `observatory.projection_alert_enabled`.
**Crons:** `cost_hard_threshold_detector` (sync+async 5min), `cost_rate_detector` (1min), `cost_learned_band_detector` (15min), `cost_anomaly_diagnose` (on anomaly).

---

## Wave 22 — Daily Cockpit (aggregator, last)

Sessions DC-1..DC-8 per group 4. Reads from EVERY other spec via `getWaitingItems()` + `getHealthBanners()` contracts. Ships last so every source contract is real, not stubbed.

**Settings keys:** `cockpit.quiet_slot_cost_threshold`, `cockpit.material_event_debounce_minutes`, `cockpit.waiting_items_rail_cap`.
**Crons:** `cockpit_brief_morning` (06:00 Mel), `cockpit_brief_midday` (12:00), `cockpit_brief_evening` (18:30), `cockpit_brief_regenerate` (event-triggered + debounced).

---

## Wave 23 — Final gates

| ID | Type | Purpose |
|---|---|---|
| SAP | INFRA | **Settings Audit Pass.** Grep full codebase for numeric/string literals in autonomy-sensitive paths (review windows, timeouts, thresholds, confidence cutoffs, ramp durations, retry counts, expiry periods, cadences). Convert stragglers to `settings.get()`. Verify every `docs/settings-registry.md` key maps to a real `settings` row with registered default. Verify every consumer spec reads what the registry says. **Net under the whole settings discipline.** |
| DRY | TEST | **Synthetic-client dry-run.** Full arc on staging: fake prospect → outreach touch → simulated reply → trial shoot booking → Brand DNA → retainer quote → invoice → portal. Every handoff verified manually. Feeds LAUNCH_READY.md. |

---

## §C — Consolidated cron / scheduled-task view

Every recurring job in the platform. Columns: job name · cadence · owner wave · handler · what it touches · kill-switch.

| Job | Cadence | Owner | Touches | Kill-switch |
|---|---|---|---|---|
| `wizard_resume_nudge` | 24h post-start | SW-6 | `wizards`, email | `wizards_enabled` |
| `wizard_expiry_warn` | 29d post-start | SW-6 | email | `wizards_enabled` |
| `wizard_auto_expire` | 30d post-start | SW-6 | `wizard_progress` | `wizards_enabled` |
| `quote_reminder_3d` | 3d post-send | QB-6 | email | `quote_automations_enabled` |
| `quote_expire` | on `expires_at` | QB-6 | `quotes`, `activity_log` | `quote_automations_enabled` |
| `manual_invoice_generate` | monthly per cycle | QB-6 + BI-1 | `invoices` draft | `invoice_automations_enabled` |
| `manual_invoice_send` | monthly per cycle | QB-6 + BI-1 | email, `invoices` | `invoice_automations_enabled` |
| invoice overdue transition | on `due_at` passage | BI-7 | `invoices`, `deals` | `invoice_automations_enabled` |
| `handleInvoiceOverdueReminder` | 3d post-due | BI-7 | email | `invoice_automations_enabled` |
| `saas_subscription_usage_reset_on_period` | billing cycle anniversary | SB-7 | `usage_records` | `saas_billing_enabled` |
| `payment_failure_escalation_initial` | 1st failure | SB-9 | email | `saas_billing_enabled` |
| `payment_failure_escalation_warning` | 3rd failure in 7d | SB-9 | email | `saas_billing_enabled` |
| `saas_pause_reminder` | before pause end | SB-9 | email | `saas_billing_enabled` |
| `inbox_daily_digest` | 08:00 Mel daily | UI-13 | email | `inbox_digest_enabled` |
| `inbox_auto_delete_purge` | 23:00 daily | UI-4 | `messages` (trash) | `inbox_purge_enabled` |
| `inbox_graph_sync` | every 5 min | UI-1 | `messages`, Graph API | `inbox_sync_enabled` |
| `inbox_history_import_backfill` | on-demand | UI-12 | `messages` | `inbox_sync_enabled` |
| `data_export_generate` | on-demand | CM-9 | ZIP + `scheduled_tasks` | — |
| `portal_archive_non_converter` | 60d post-shoot | CM-? + SWP-10 | portal, email | — |
| `onboarding_nudge_email` | per-audience cadence | OS-3 | email | `onboarding_nudges_enabled` |
| `practical_setup_reminder_email` | 24h/72h/weekly | OS-3 | email | `onboarding_nudges_enabled` |
| `content_keyword_research` | weekly per owner | CE-2 | `content_topics`, SerpAPI | `content_automations_enabled` |
| `content_generate_draft` | tier-paced | CE-4 | `blog_posts`, Opus | `content_automations_enabled` |
| `content_fan_out` | on approval | CE-6 | `social_drafts` | `content_automations_enabled` |
| `content_newsletter_send` | configurable window | CE-7 | email (bulk) | `content_newsletter_enabled` |
| `content_ranking_snapshot` | weekly per post | CE-9 | `ranking_snapshots`, SerpAPI | `content_automations_enabled` |
| `content_outreach_match` | on publish | CE-13 | lead queue | `content_outreach_enabled` |
| `lead_gen_daily_search` | 03:00 daily | LG-4 | `lead_candidates`, SerpAPI | `outreach_send_enabled` |
| `sequence_scheduler` | engagement-gated | LG-9 | email, `outreach_sequences` | `outreach_send_enabled` |
| `engagement_tier_evaluator` | on cooloff roll | LG-9 | `lead_candidates` | `outreach_send_enabled` |
| `intro_funnel_abandon_check` | daily | IF-3 | `intro_funnel_submissions` | `intro_funnel_enabled` |
| `intro_funnel_booking_reminder` | 24h/2h pre | IF-2 | email, SMS | `intro_funnel_enabled` |
| `intro_funnel_reflection_reminder` | post-shoot | IF-2 | email | `intro_funnel_enabled` |
| `six_week_plan_generate` | on shoot-day-notes submit | SWP-3 | `six_week_plans`, Opus | `plan_automations_enabled` |
| `six_week_plan_migrate_on_won` | on deal Won | SWP-9 | Client Context `active_strategy` | — |
| `six_week_plan_expiry_email` | day 53 | SWP-10 | email (PDF attached) | `plan_automations_enabled` |
| `six_week_plan_non_converter_expiry` | day 60 | SWP-10 | portal archive | `plan_automations_enabled` |
| `plan_revision_review_queue` | on revision request | SWP-7 | `plan_revisions` | `plan_automations_enabled` |
| `context_summary_regenerate` | event-driven | CCE-2 | `context_summaries`, Haiku | `context_automations_enabled` |
| `context_action_item_extract` | event-driven | CCE-2 | `action_items`, Haiku | `context_automations_enabled` |
| `task_morning_digest` | 08:00 Mel daily | TM-8 | email | `tasks_digest_enabled` |
| task recurrence-spawn | on `markTaskDone()` | TM-6 | `tasks` | — |
| `hiring_discovery_run` | weekly per Role | HP-6 | `candidates`, Sonnet, SerpAPI | `hiring_discovery_enabled` |
| `hiring_invite_followup_check` | 7d post-invite | HP-11 | email, `candidates` | `hiring_invites_enabled` |
| `hiring_bench_pause_ending` | 2d pre-end | HP-17 | email | — |
| `hiring_role_brief_regenerate` | on archive + material event | HP-15 | `role_briefs`, Sonnet | — |
| `finance_snapshot_take` | 06:00 Mel daily | FD-2 | `finance_snapshots` | — |
| `finance_narrative_regenerate` | on-demand | FD-4 | narrative, Haiku | — |
| `finance_recurring_expense_book` | 06:15 Mel daily | FD-7 | `recurring_expenses` | — |
| `finance_observatory_rollup` | 06:10 Mel daily | FD-5 | `finance_snapshots` | — |
| `finance_stripe_fee_rollup` | 06:12 Mel daily | FD-5 | `finance_snapshots` | — |
| `ambient_copy_generate` | on-demand / refresh | SD-3 | `ambient_copy_cache`, Haiku | `surprise_ambient_enabled` |
| `hidden_egg_fire_cleanup` | 30d retention | SD-9 | `hidden_egg_fires` | — |
| `riddle_answer_fallback_budget_monitor` | monthly | SD-10 | `riddles` | — |
| `cost_hard_threshold_detector` | sync on insert + 5min sweep | COB-4 | `cost_anomalies` | `observatory_detectors_enabled` |
| `cost_rate_detector` | every 1min | COB-5 | `cost_anomalies` | `observatory_detectors_enabled` |
| `cost_learned_band_detector` | every 15min | COB-6 | `cost_anomalies` | `observatory_detectors_enabled` |
| `cost_anomaly_diagnose` | on anomaly insert | COB-8 | `cost_anomalies.diagnosis_json`, Opus | `observatory_detectors_enabled` |
| `cockpit_brief_morning` | 06:00 Mel | DC-2 | `cockpit_briefs`, Opus | `cockpit_briefs_enabled` |
| `cockpit_brief_midday` | 12:00 Mel | DC-2 | `cockpit_briefs`, Opus | `cockpit_briefs_enabled` |
| `cockpit_brief_evening` | 18:30 Mel | DC-2 | `cockpit_briefs`, Opus | `cockpit_briefs_enabled` |
| `cockpit_brief_regenerate` | event-driven + debounced | DC-3 | `cockpit_briefs`, Opus | `cockpit_briefs_enabled` |

| `case_snippet_auto_approve` | 48h post-creation | LG-11 | `case_snippets` | — |
| `case_snippet_retainer_90d` | 90d post-Deal Won | LG-11 | `case_snippets`, Haiku | — |

**Stampede check:** no two daily/sub-hourly jobs fire at the same minute. 06:00 (Finance + Cockpit morning) — both touch different tables, no contention. 08:00 (Inbox digest + Task digest) — both email paths, share `canSendTo()` rate-limit inherently.

---

## §R — Shared-primitive registry (owner wave → consumers)

Every primitive is owned by exactly one wave. Consumers import; never redefine. Any accidental duplication found in Phase 5 spawns a refactor task.

**Tables (owner → consumers):**
- `user` → A2, A5, all
- `settings` → A5, all
- `activity_log` → A6, all (writes via `logActivity()`)
- `scheduled_tasks` → A6, QB-6 handlers, every spec with a cron
- `external_call_log` → A6, COB, FD
- `messages`, `threads` → A6 (schema) + UI (full stack), CCE-3, CM-10
- `contacts`, `companies`, `deals` → SP-1, QB, BI, SB, IF, CM, OS, LG, SWP, CCE
- `stripe_processed_events` → SP-7, BI-7, SB-6
- `portal_magic_links` → A8, IF-4, CM-1
- `support_tickets` → B1, DC (error-triage waiting item)
- `legal_doc_versions` → B3, QB-4 acceptance, SB-5 acceptance
- `cookie_consents` → B3
- `brand_dna_profiles`, `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` → BDA, CCE (read), IF (read), LG (read), SD (read)
- `wizard_progress`, `wizard_completions`, `integration_connections` → SW-1, SB-2, CE-12, IF-1
- `quotes`, `quote_templates`, `catalogue_items` → QB
- `invoices` → BI, CM (billing tab), FD
- `saas_products`, `saas_tiers`, `usage_records` → SB, CM (subscriber portal)
- `intro_funnel_submissions`, `intro_funnel_bookings`, `intro_funnel_reflections` → IF, SWP, CM-7
- `six_week_plans`, `plan_revisions` → SWP, CM (portal plan), CCE (migrate)
- `context_summaries`, `action_items`, `private_notes`, `llm_usage_log` → CCE, CM-3
- `tasks`, `braindumps` → TM, CM (deliverables)
- `candidates`, `role_briefs`, `trial_tasks`, `candidate_archives` → HP
- `content_topics`, `blog_posts`, `social_drafts`, `newsletter_subscribers`, `newsletter_sends`, `ranking_snapshots`, `content_engine_config` → CE, HP (claimable backlog)
- `finance_snapshots`, `expenses`, `recurring_expenses` → FD
- `ambient_copy_cache`, `hidden_egg_fires`, `riddles`, `riddle_resolutions` → SD
- `cost_anomalies`, `deploy_events`, `observatory_settings` → COB
- `cockpit_briefs` → DC
- `lead_candidates`, `outreach_drafts`, `outreach_sends`, `outreach_sequences`, `resend_warmup_state`, `dnc_emails`, `dnc_domains` → LG
- `case_snippets` → LG-11, consumed by LG outreach drafts (§8.2)
- `audit_submissions`, `audit_rate_limits` → AT-1
- `portal_chat_messages` → CM-1

**Functions:**
- `settings.get(key)` → A5
- `logActivity(...)` → A6
- `formatTimestamp(date, tz)` → A6
- `sendEmail(...)`, `canSendTo(...)`, `isWithinQuietWindow()` → A7
- `checkBrandVoiceDrift(...)` → A7
- `renderToPdf(...)` → A7 (stub) + QB-3 (real impl)
- `ensureStripeCustomer(contactId)` → A7
- `portal-guard` → A8
- `createDealFromLead(contact, source)` → SP-1, consumed by IF-1, LG-9, AT-1, CM-E
- `transitionDealStage()` → SP-2, consumed by QB-5, SB-6, BI-7
- `validateDeal()` → SP-2
- `assembleContext(contactId)` → CCE-1, consumed by UI-5, CM-3
- `computeHealthScore()` → CCE-1
- `getSignalsForContact()`, `getActionItems()` → CCE-1
- `getWaitingItems()` → DC-4 aggregation contract; every spec emits its own block
- `getHealthBanners()` → DC-5; every spec emits its own block
- `maybeRegenerateBrief(kind, payload)` → DC-3
- `generateInVoice(slot, context)` → SD-2, consumed by every surface
- `resolveRiddleAnswer()` → SD-10
- `checkUsageLimit()`, `recordUsage()` → SB-7
- `parseBraindump()` → TM-4
- `approveDeliverable()` → TM-7
- `getAvailableBenchMembers()` → HP-17, consumed by TM
- `isBlockedFromOutreach()`, `enforceWarmupCap()` → LG-1/LG-6
- `classifyEdit()` → LG-11, consumed by autonomy state machine
- `scoreAuditCategory()`, `scoreAuditOverall()` → AT-1
- `runAuditEnrichment()` → AT-1, reuses LG-2/LG-3 enrichment pipeline
- `generateCaseSnippet()` → LG-11
- `vault.encrypt/decrypt` → B2
- `reportIssue(context)` → B1
- `invokeLlmText(prompt, opts)` → A6, refactored PM-5 (adds `system` param); consumed by UI-5/6/7, CCE-1+
- `useAdminEvents()` → PM-3 (SSE client hook); consumed by pipeline toasts, future real-time surfaces

**URL prefixes:**
- `/lite/*` (admin) → every admin spec
- `/lite/_design` → A2
- `/lite/legal/*` → B3
- `/lite/admin/errors` → B1
- `/portal/[token]/*` → CM, IF, SB-10, SWP-6
- `/bench` → HP-14
- `/get-started/*` → SB-3, SB-4, AT-2 (`/get-started/audit`)
- `/api/outreach/click` → LG-11 (retargeting pixel redirect)
- `/api/admin/events` → PM-3 (SSE endpoint for admin real-time push)
- `/intro`, `/trial-shoot`, `/book`, `/follow-up` → IF
- `/apply` → HP-10
- `/say/[answer]` → SD-12

**Crons:** see §C above.

**Email classifications (enum at A7):** base `transactional | outreach` + all spec-added values.

**Kill switches (A5):** every automation has one; see §C column.

**Motion moments:** 7 Tier 2 slots locked in Design System Baseline. Assignments:
1. Brand DNA reveal (BDA-3)
2. Quote accept / Payment Element reveal (QB-4)
3. Bundle reveal (CM-7, F3.a)
4. Won-deal flavour (SP-9)
5. Draft drawer (CCE-3)
6. PDF render overlay (A4 token, consumed by QB-3, BI-2, SWP-8)
7. Cockpit brief arrival (DC-8)

**Sound registry:** 7 locked entries, defined in A4; claims assigned during each spec's voice-and-delight session.

---

## §E — Critical-flow E2E suites

Mandatory Playwright suites, each landing the session their flow goes live.

| Flow | Suite | Owner session |
|---|---|---|
| Trial shoot booking | `e2e/intro-funnel-booking.spec.ts` | IF-E2E |
| Quote accept | `e2e/quote-accept.spec.ts` | QB-E2E |
| Invoice pay | `e2e/invoice-pay.spec.ts` | BI-E2E |
| Subscription signup | `e2e/saas-signup.spec.ts` | SB-E2E |
| Portal auth | `e2e/portal-auth.spec.ts` | CM-E2E |

Each suite runs as part of that session's verification gate (typecheck + unit tests + feature's E2E) before handoff. AUTONOMY_PROTOCOL.md makes these non-skippable.

---

## Dependency-order summary (at-a-glance)

Shows planned order. Actual execution order diverges — see "Execution vs plan" note below.

```
Wave 0:  P0 (Pixieset spike — CLOSED, superseded by Cloudinary 2026-04-18)
Wave 1:  A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8           (Foundation A — CLOSED)
Wave 2:  B1 → B2 → B3                                     (Foundation B — CLOSED)
Wave 3:  BDA-1 → BDA-2 → BDA-3 → BDA-4 → BDA-5            (gate unblocks at BDA-4 — BDA-5 OPEN ⚠)
Wave 4:  SW-1 → ... → SW-13                               (WizardDefinition — CLOSED, expanded from 6 to 13 sessions)
Wave 5:  SP-1 → SP-2 → ... → SP-9                         (CRM spine — CLOSED)
Wave 6:  QB-1 → ... → QB-E2E                              (critical: quote accept — CLOSED)
Wave 7:  BI-1a → BI-1b → BI-2a → BI-2b → BI-E2E          (critical: invoice pay — CLOSED, restructured)
Wave 8:  SB-1 → ... → SB-12 → SB-E2E                      (critical: SaaS signup — CLOSED, SB-4 optional skip)
—        admin-polish-0..6 + admin-chrome-1                 (unplanned interlude — CLOSED)
Wave 9:  UI-1 → ... → UI-13                               (inbox — CLOSED)
Wave 10: CM-1 → ... → CLD-1 → CLD-2 → CM-7 → CM-7b → ... → CM-12 → CM-E2E  (portal + Cloudinary — NOT STARTED ⚠)
Wave 11: OS-1 → OS-2 → OS-3                               (onboarding — CLOSED)
Wave 12: CE-1 → ... → CE-13                               (content engine — CLOSED)
Wave 13: LG-1 → ... → LG-10                               (lead generation — IN PROGRESS, LG-7 last closed)
Wave 13c: PM-1..PM-7                                       (patch mop-up — orphaned patches from Phase 5 audit)
—        SPEC-PATCH-IF-CLD                                   (Pixieset→Cloudinary spec patch across intro-funnel — after LG-10, before IF-1)
Wave 14: IF-1 → ... → IF-4 → IF-E2E                       (critical: trial booking)
Wave 15: SWP-1 → ... → SWP-10                             (six-week plan)
Wave 16: CCE-1 → CCE-2 → CCE-3                            (context engine)
Wave 17: TM-1 → ... → TM-9                                (task manager)
Wave 18: HP-1 → ... → HP-19                               (hiring pipeline)
Wave 19: FD-1 → ... → FD-14                               (finance dashboard)
Wave 20: SD-1 → ... → SD-14                               (surprise & delight)
Wave 21: COB-1 → ... → COB-11                             (cost observatory — aggregator)
Wave 22: DC-1 → ... → DC-8                                (daily cockpit — aggregator)
Wave 23: SAP → DRY                                        (Settings Audit + dry-run)
```

### Execution vs plan — skipped sessions and reordering (2026-04-18 audit)

**Actual execution order diverged from plan after Wave 9.** Waves 11, 12, and 13 were executed before Wave 10 (Client Management). This means all client-facing portal surfaces remain unbuilt while admin + backend waves advanced.

**Corrected execution order going forward:**

After Wave 13 (LG) completes, the remaining waves run in this sequence:

1. **BDA-5** (Wave 3 catchup) — client-facing Brand DNA portal paths, blends, retake. Required before CM-8.
2. **CMS-3 + CMS-4** (Batch B content mini-sessions — overdue since Wave 12 closed). Run before consuming waves advance further.
3. **PM-6** (Wave 13c discipline patch) — AUTONOMY_PROTOCOL visual-remediation update. Zero code; must land before CM-5's brief is written.
4. **Wave 13b: LG-11 → AT-1 → AT-2** — Lead Gen addendum + Free Audit Tool.
5. **Wave 13c remainder: PM-4, PM-5** (small infra — subscription state rename + invoke.ts refactor). PM-5 must land before CCE-1.
6. **Wave 10 catchup: CM-1 → CM-5 → CM-6 → CLD-1 → CLD-2 → CM-7 → CM-7b → CM-8 → CM-9 → CM-10 → CM-11 → CM-12 → CM-E → CM-E2E** — the entire portal wave, including Cloudinary integration. Must complete before IF-2 (Wave 14), which routes to the portal gallery.
7. **PM-1, PM-2, PM-3, PM-7** (Wave 13c UI sessions) — interleaved with Wave 10 or run as a batch after CM-E2E. PM-1 (Settings Display) and PM-7 (LG queue buttons) are independent; PM-2 (design system revisit) and PM-3 (realtime channel) are independent.
8. **Wave 14: IF-1 → IF-4 → IF-E2E** — Intro Funnel (depends on CM portal + CLD gallery).
9. **Waves 15–23** — as originally planned.

**Intentionally skipped (no action needed):**
- SB-4 (Wave 8) — per-product demo landing pages, marked optional in plan.

**Content mini-sessions outstanding:**
- CMS-3 (Content Engine copy) — overdue, should run before Wave 14.
- CMS-4 (SaaS Subscription Billing copy) — overdue, should run before Wave 14.
- CMS-5 (Intro Funnel + Six-Week Plan) — required before IF-1.
- CMS-6 (Observatory + S&D) — required before COB-1.

~162 total build sessions (including Wave 13b + 13c mop-up). Approx Phase 5 duration: assume 2–3 sessions per day in autonomous mode, staged by critical-flight batches, bounded by Opus-quota windows — 2–4 months real-time, not a fixed estimate. AUTONOMY_PROTOCOL.md governs per-session discipline.

---

## Rollback strategy — all waves

Per-session rollback is always one of:

- **migration reversible** — down-migration shipped with every schema change. Rollback = run `drizzle-kit migrate:down`.
- **feature-flag-gated** — kill-switch in `settings` table (owned by A5) disables feature without code change. Rollback = flip the flag.
- **git-revertable, no data shape change** — UI-only or helper-only sessions. Rollback = `git revert`.

AUTONOMY_PROTOCOL.md makes this declaration non-skippable: every session declares its rollback in the handoff before the session is considered complete.

---

## Closed notes

- **LAUNCH_READY.md and AUTONOMY_PROTOCOL.md** are the remaining Phase 4 artefacts. Drafted in a fresh session per mid-session context-budget discipline (the same discipline AUTONOMY_PROTOCOL.md itself codifies).
- **PATCHES_OWED.md Pending rows** are all slotted above. Every row now maps to a named session (Foundation A/B, Wave 3–22, Wave 13b/13c addenda, or the final SAP). **Audited 2026-04-18:** 7 orphaned patches identified and slotted into Wave 13c (PM-1..PM-7).
- **No mop-up brainstorms spawned** during this session. Phase 4 ordering was locked by Andy's Q1 answer (A — dependency-strict); three exit-handoff decisions mechanically resolved.
