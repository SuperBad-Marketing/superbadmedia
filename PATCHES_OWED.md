# PATCHES_OWED

Consolidated list of patches owed on existing docs, specs, memories, and code. Every spec session, content mini-session, and brainstorm that identifies a patch owed on another file adds a row here — not just a mention in its handoff.

Phase 3.5 reads this file as the authoritative list of owed patches alongside session handoffs. If a handoff names a patch that isn't here, the 3.5 session is treated as canonical but also adds the missing row.

## How to use

- **Add** a row at the bottom of the relevant section when a session identifies a patch.
- **Strike through or move to "Applied"** when a later session has actually applied the patch.
- **Never delete rows** — keep applied ones in the "Applied" section at the bottom for auditability.
- Columns: target file · what to patch · why · raised by (session id or memory) · raised when (YYYY-MM-DD).

## Pending

### SCOPE.md

- ~~`SCOPE.md` · Add **Branded Invoicing** as a first-class v1.0 feature~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch A stop point: added as §17 in new "Additional v1 features (added 2026-04-13 — Phase 3.5 SCOPE reconciliation)" section.
- ~~`SCOPE.md` · Add **Intro Funnel (paid trial shoot)** as a first-class v1.0 feature~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch A stop point: added as §18. Supersedes the single "Paid intro offer" bullet under §1 Lead Generation.
- ~~`SCOPE.md` · Add **Six-Week Plan Generator** as a first-class v1.0 feature~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch A stop point: added as §19.
- ~~`SCOPE.md` · Hiring Pipeline decision~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch A stop point: added as §20 (Andy chose v1.0 inclusion, not v1.1 deferral).

### FOUNDATIONS.md

Phase-5-gated FOUNDATIONS patches (land alongside the relevant build session, not now — but tracked here for Phase 4 sequencing):

- `FOUNDATIONS.md` §11.2 `sendEmail()` classification enum · Add 3 new values: `six_week_plan_invite`, `six_week_plan_followup`, `six_week_plan_delivery` · Six-Week Plan Generator spec · 2026-04-13 · **gate: Phase 5 Six-Week Plan build session**
- `FOUNDATIONS.md` §11 disciplines list · Add 6 Task Manager / Surprise & Delight build-time disciplines (24–29) — task state transitions, deliverable approval, braindump ingestion, braindump mount discipline, portal-task authorisation, email-send classification-at-call-site · Task Manager + S&D specs · 2026-04-12 · **gate: Phase 5 Task Manager build session**
- `FOUNDATIONS.md` §11 · Document `scheduled_tasks` worker as §11-tier cross-cutting infrastructure primitive (current location: Quote Builder §5.4 / §8.2 as authoritative owner; Foundations needs a one-paragraph pointer for discoverability) · Quote Builder handoff · 2026-04-12 · **gate: Phase 4 Build Plan**
- `FOUNDATIONS.md` §11.2 · Confirm unified send-gate model aligns with Cost & Usage Observatory's actor-attribution extensions (currently compatible but not cross-referenced in Foundations) · Observatory spec · 2026-04-13 · **gate: Phase 5 Observatory build session**
- `docs/specs/cost-usage-observatory.md` prompt-cardinality inventory · Reconcile with `lib/ai/prompts/INDEX.md` (47 prompts across 14 specs); Observatory registered-jobs inventory must include every prompt-keyed job so external-call cost attribution is complete · Phase 3.5 Batch B step 7 · 2026-04-13 · **gate: Phase 5 Observatory build session**
- `FOUNDATIONS.md` §11.2 / §11.5 runtime definition · Cross-cutting primitives `canSendTo(recipient, classification)`, `renderToPdf(htmlOrReactTree, opts)`, `checkBrandVoiceDrift(draftText, brandDnaProfile)` are referenced across ≥5 specs but have no runtime signature in Foundations — only interface hints. Define full TS signatures + return shapes in Phase 4 foundation session · Phase 3.5 Batch B step 7 · 2026-04-13 · **gate: Phase 4 foundation session**
- `docs/specs/daily-cockpit.md` `getWaitingItems()` + `getHealthBanners()` source-spec stubs · Cockpit aggregates from 14 specs but the enumeration of which spec emits which waiting-item kind / health-banner kind is only partially complete — Observatory, Finance, Hiring kinds applied (see Applied below) but several specs still need explicit `emits:` blocks naming their cockpit contributions · Phase 3.5 Batch B step 7 · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session**
- `FOUNDATIONS.md` §11 · Add **Error Reporting & Support Triage** as a cross-cutting primitive. Three components: (1) Sentry wired into Next.js client + server + edge runtimes — captures every unhandled exception with stack, user, URL, session replay; deduped by fingerprint so N users hitting the same bug = 1 ticket. (2) `lib/support/reportIssue(context)` primitive callable from any client-facing surface (portal, cockpit, intro funnel, brand DNA, admin); "Report an issue" button lives in the global footer of every surface; attaches last 30s replay + user + page + recent actions; writes to new `support_tickets` table AND pings Sentry with the ticket id for correlation. (3) New `support_tickets` table (id, user_id, surface, page_url, description, session_replay_url, sentry_issue_id, status, created_at, resolved_at). (4) New Daily Cockpit waiting-item kind `error_triage` — aggregates Sentry issues + open support_tickets, sorted by impact (users_affected × occurrences); single triage inbox, not three. Covers the "efficiency when live, don't hunt errors individually" goal. · Andy question 2026-04-13 (efficient debugging/error reporting process when live) · 2026-04-13 · **gate: Phase 4 foundation session** (land alongside other §11 cross-cutting primitive definitions; Cockpit waiting-item kind lands in Phase 5 Daily Cockpit build session)

### Specs — retroactive updates owed

- ~~All locked specs · Inline cross-spec contract detail currently only in handoffs (Phase 3.5 step 2a)~~ — **APPLIED 2026-04-13** by `phase-3.5-step-2a-self-containment` (see Applied section below)
- ~~All locked specs with autonomy thresholds expressed as literals · Convert to `settings.get()` keys per Phase 3.5 step 7a~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch B step 7a (see Applied section below)
- Locked specs pre-dating the "Voice & delight treatment" convention · Add the section per cross-cutting discipline (Sales Pipeline done 2026-04-13; audit remaining specs) · Cross-cutting principle audit · 2026-04-13
- ~~Locked specs with LLM prompt text inline in prose · Extract prompts to `lib/ai/prompts/<name>.ts` stubs (Phase 3.5 step 3b)~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch A step 3b (see Applied section below)

### Cross-cutting

- ~~`docs/content/` folder · Populate from each content mini-session's output (Phase 3.5 step 3a homes them here)~~ — **APPLIED 2026-04-13** by Phase 3.5 Batch A step 3a (see Applied section below)

### Phase 3.5 Step 11 walkthrough — friction resolutions

- ~~`docs/specs/intro-funnel.md` · Portal-guard recovery flow~~ — **APPLIED 2026-04-13** inline by Phase 3.5 Step 11 Stage 4 closure (new §10.1 block covers guard behaviour, recovery form, email-matched / unmatched paths).
- ~~`docs/specs/intro-funnel.md` §17 notifications + §11 payment / §12 calendar / §13 post-shoot / §15 deliverables · every journey-beat email embeds a fresh magic link~~ — **APPLIED 2026-04-13** inline by Stage 4 closure (consolidated in §10.1 with explicit send-point list; `sendEmail()` wrapper enforces OTT precondition at build time).
- ~~`docs/specs/client-management.md` §10 · Reference `portal-guard` primitive~~ — **APPLIED 2026-04-13** inline by Stage 4 closure (§10.1 Identity and access now names the primitive, settings keys, and retainer-mode journey-email OTT embedding).
- `FOUNDATIONS.md` §11 · Add `portal-guard` as a cross-cutting shared primitive — session-cookie check with magic-link-recovery fallback form. Contract specified in `docs/specs/intro-funnel.md` §10.1 (authoritative). Consumers: Intro Funnel portal, Client Management portal. · F1.a resolution · 2026-04-13 · **gate: Phase 4 foundation session**
- `FOUNDATIONS.md` §11.2 `sendEmail()` classification enum · Add `portal_magic_link_recovery` (transactional — fresh magic link sent from recovery form when prospect's cookie has expired) · F1.a resolution, Stage 4 closure · 2026-04-13 · **gate: Phase 5 Session A (foundation seed)**
- `docs/specs/intro-funnel.md` §4.1 data model · Document new `portal_magic_links` table (columns spec'd in §10.1). Phase 4 foundation generalises it so Client Management `/portal/[token]/*` reuses the table with nullable `submission_id` + new `client_id` column. · F1.a resolution · 2026-04-13 · **gate: Phase 4 foundation session**
- ~~`FOUNDATIONS.md` §11.7 · `ensureStripeCustomer(contactId)` primitive + `contacts.stripe_customer_id` column + business-lifecycle terminology note~~ · F1.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline (FOUNDATIONS §11.7; `contacts` schema updated in sales-pipeline.md §4.1).
- ~~`docs/specs/sales-pipeline.md` §10.4 · `createDealFromLead()` contact dedupe rule (email + phone fallback, non-destructive merge, reuse Company)~~ · F1.c + Andy's lead-lifecycle lock · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §3 step 2 · Contact dedupe call-out + business-lifecycle note (Lead/Prospect through trial shoot; only retainer promotes to Client)~~ · F1.c + Andy's lead-lifecycle lock · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §11.2 · `ensureStripeCustomer()` call before PaymentIntent creation + `customer` field on PaymentIntent~~ · F1.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `docs/specs/quote-builder.md` §7 (Stripe integration) · Add `ensureStripeCustomer(deal.primary_contact_id)` call before Checkout session creation + `customer` field on the session. · F1.c resolution · 2026-04-13 · **gate: apply during Phase 3.5 Step 11 Stage 4 (retainer conversion) walkthrough, or Phase 5 Quote Builder build session — whichever fires first**
- `docs/specs/branded-invoicing.md` · Add `ensureStripeCustomer()` precondition to every Stripe-touching path (draft-invoice create, send, chain-stop). · F1.c resolution · 2026-04-13 · **gate: Phase 5 Branded Invoicing build session**
- `docs/specs/saas-subscription-billing.md` · Add `ensureStripeCustomer()` precondition to Subscription create + one-off Checkout paths. · F1.c resolution · 2026-04-13 · **gate: Phase 5 SaaS Subscription Billing build session**
- `FOUNDATIONS.md` §11.7 + ESLint rule in foundation session · Block direct imports of `stripe.customers.create` from feature code — mirrors the `@anthropic-ai/sdk` no-direct-import rule in §11.6. · F1.c resolution · 2026-04-13 · **gate: Phase 4 foundation session**
- `FOUNDATIONS.md` Phase 3.5 step 8 glossary pass · Canonical term separation: `stripe.Customer` (Stripe payment identity) ≠ **Client** (retainer-holding contact) ≠ **customer** (banned as a standalone term in specs + code). Add to the glossary when step 8 runs. · F1.c resolution · 2026-04-13 · **gate: Phase 3.5 step 8 (Batch C)**
- ~~`docs/specs/sales-pipeline.md` §4.1 + §4.1A · `companies.shape` canonical column + activity_log additions (`company_shape_updated`, `shape_mismatch_flagged`) + admin surface + staleness cascade~~ · F1.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §3 step 2 + §4.1 · Canonical shape write rule (update `companies.shape` if null, log `shape_mismatch_flagged` on disagreement) + `intro_funnel_submissions.shape` reframed as historical snapshot~~ · F1.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/brand-dna-assessment.md` §8.1 · `shape` reframed as historical snapshot + `needs_regeneration` column + mismatch flagging on profile completion~~ · F1.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `docs/specs/six-week-plan-generator.md` §4 (generator pipeline) · Read `companies.shape` as canonical shape input (fall back to `intro_funnel_submissions.shape` if canonical null). Add staleness hook: on `company_shape_updated`, if plan is pre-conversion + not yet approved, mark `needs_regeneration = true` on the plan (column addition owed). · F1.b resolution · 2026-04-13 · **gate: Phase 5 Six-Week Plan build session**
- `docs/specs/client-context-engine.md` §11 / §14.5 (active_strategy lifecycle) · Add `company_shape_updated` as a trigger for `active_strategy` staleness. · F1.b resolution · 2026-04-13 · **gate: Phase 5 Client Context Engine build session**
- `docs/specs/daily-cockpit.md` `getHealthBanners()` or attention-rail · Add a quiet surface for `shape_mismatch_flagged` so Andy sees "prospect answered a different shape than we had on file — reconcile" as a reviewable item. · F1.b resolution · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session**
- `docs/specs/onboarding-and-segmentation.md` · Onboarding personalisation reads `companies.shape` as canonical source. · F1.b resolution · 2026-04-13 · **gate: Phase 5 Onboarding build session**
- `docs/specs/intro-funnel.md` §13.4 (retainer-fit recommendation) · Input context bundle uses `companies.shape` as canonical; `intro_funnel_retainer_fit` gains `needs_regeneration` flag triggered by `company_shape_updated`. · F1.b resolution · 2026-04-13 · **gate: Phase 5 Intro Funnel build session (or Phase 3.5 Batch C if touched sooner)**
- `docs/specs/setup-wizards.md` Phase 4 sequencing · Note: Intro Funnel build session depends on `setup-wizards` `WizardDefinition` primitive (§5.3). Build order must place Setup Wizards foundation before Intro Funnel. · F1.d resolution (Phase 4 sequencing note, no product decision) · 2026-04-13 · **gate: Phase 4 Build Plan**

### Phase 3.5 Step 11 Stage 2 — F2.d (Safety-valve × retainer-fit)

- ~~`docs/specs/intro-funnel.md` §13.4 · Retainer-fit fires even when safety valve triggered. Prompt receives `safety_valve_triggered` flag + safety-valve free-text; output biased to honour negative signal (`'neither'` typical, flags include `safety_valve_triggered`). Hard lock: retainer-fit is internal-only (Andy cockpit + Pipeline panel only) — never reaches prospect via email/SMS/portal/PDF/quote-copy. Build-time discipline: `lib/intro-funnel/retainer-fit.ts` accessor with `// internal-only` JSDoc + ESLint-able marker. Cockpit ordering inherits existing urgent-above-quiet behaviour when both `post_trial_negative_feedback` urgent + `retainer_fit_recommendation_ready` quiet fire on same Deal.~~ · F2.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §0/§18 · Removed mis-categorisation of retainer-fit as "customer-facing" output in §11.5 references. Retainer-fit still passes through drift check as a belt-and-braces voice-consistency safeguard on Andy's surfaces.~~ · F2.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §18 · Removed stub-path narration (was "stubbed baseline that carries SuperBad's brand voice + business context from skills"); now reads "no stub path exists; the gate guarantees the perpetual profile is real before any consumer runs" per F2.b lock.~~ · F2.b/F2.d cross-reference cleanup · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `FOUNDATIONS.md` §11 (build-time disciplines) · Add discipline #N: "internal-only marker on Claude-generated artefacts that must not reach a customer surface — annotated with `// internal-only` JSDoc on the accessor function; lint rule (or comments-as-discipline) blocks consumption from a customer-targeted route/comm path." Foundation session implements (or marks as comments-only if a custom rule is overkill). Initial consumer: `intro_funnel_retainer_fit`. · F2.d resolution · 2026-04-13 · **gate: Phase 4 foundation session**
- `docs/specs/intro-funnel.md` Pipeline Trial Shoot panel UI (cross-spec note to sales-pipeline.md) · Add a "Regenerate retainer-fit" admin action on the Trial Shoot panel — useful when initial generation needs a re-run (e.g. after Andy adds context). One-click from the Deal profile. · F2.d follow-up · 2026-04-13 · **gate: Phase 5 Sales Pipeline / Intro Funnel build session**
- `docs/specs/intro-funnel.md` `lib/intro-funnel/prompts/retainer-fit.ts` content authoring · Prompt must explicitly handle the `safety_valve_triggered = true` branch with appropriate framing (likely `'neither'` / low-confidence; reasoning_text names safety valve as primary input; does not pitch around it). Belongs in Intro Funnel content mini-session. · F2.d resolution · 2026-04-13 · **gate: Intro Funnel content mini-session**

### Phase 3.5 Step 11 Stage 2 — F2.c (Pixieset API spike)

- ~~`docs/specs/intro-funnel.md` §15.3 · Move Pixieset API capability spike from Phase 5 mid-build into Phase 4 prep; document two outcomes (sufficient → inline gallery; insufficient → on-brand link-out fallback in design system + house-spring motion); flag mop-up-brainstorm contingency for Pixieset alternatives evaluation.~~ · F2.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `BUILD_PLAN.md` (Phase 4 prep) · 1-session spike: confirm Pixieset API capability (private gallery access, image-URL fetching, auth model, rate limits). Outcome routes the deliverables-reveal build path. Must complete before BUILD_PLAN.md is finalised. · F2.c resolution · 2026-04-13 · **gate: Phase 4 prep**
- (contingent) Phase 4 mop-up brainstorm · If Pixieset spike returns "API insufficient", evaluate Pixieset alternatives (Pic-Time, Cloudspot, ShootProof) before accepting on-brand link-out as v1.0 final. Mop-up only fires if spike fails — not auto-spawned. · F2.c resolution · 2026-04-13 · **gate: contingent on Phase 4 spike outcome**

### Phase 3.5 Step 11 Stage 2 — F2.b (First-Login Brand DNA Gate)

- ~~`docs/specs/intro-funnel.md` §13.3 + §13.4 · Inputs lists rewritten — synthesis + retainer-fit prompts read SuperBad's perpetual Brand DNA profile unconditionally; "stubbed before then" wording removed; references First-Login Brand DNA Gate as the guarantee.~~ · F2.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/brand-dna-assessment.md` §11 · Added §11.1 First-Login Brand DNA Gate — middleware behaviour, why-hard-gate rationale, no-stub-anywhere lock, env-var bypass safety net, Phase 4 build-order constraint, onboarding voice direction.~~ · F2.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`FOUNDATIONS.md` §11.8 · Added First-Login Brand DNA Gate primitive — owner is Brand DNA Assessment §11.1; foundation session owns middleware + env-var bypass implementation.~~ · F2.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `BUILD_PLAN.md` (Phase 4) · Hard ordering constraint: Brand DNA Assessment SuperBad-self slice + gate middleware build before Intro Funnel synthesis (§13.3 + §13.4), Lead Gen draft generation, Outreach reply intelligence, brand-voice drift checks (FOUNDATIONS §11.5), Cockpit briefs referencing perpetual voice. Full client-facing Brand DNA Assessment surface can ship later. · F2.b resolution · 2026-04-13 · **gate: Phase 4 Build Plan**
- `INCIDENT_PLAYBOOK.md` (Phase 6) · Document `BRAND_DNA_GATE_BYPASS=true` env var as the recovery path if the First-Login Brand DNA Gate misfires and locks Andy out. · F2.b resolution · 2026-04-13 · **gate: Phase 6 launch (INCIDENT_PLAYBOOK.md is created in Phase 6)**
- `docs/specs/intro-funnel.md` §24 (content mini-session) · Drop the "Brand DNA stub markdown content" line if it ended up in the §24 list (it didn't — F2.b was resolved before §24 was extended for it). Confirmed: no patch needed. · F2.b resolution · 2026-04-13 · **n/a — no action required.**
- `docs/specs/brand-dna-assessment.md` (new content task) · Onboarding-route copy ("Lite needs to know who you are…"), single-paragraph framing, motion-treated reveal direction. Belongs in the Brand DNA Assessment content mini-session. · F2.b resolution · 2026-04-13 · **gate: Brand DNA content mini-session**

### Phase 3.5 Step 11 Stage 2 — F2.e (settings-registry: reflection delay)

- ~~`docs/settings-registry.md` · Add `intro_funnel.reflection_delay_hours_after_deliverables` (default 24, integer). Add new "Intro Funnel" section + note that broader Intro Funnel registry sweep is owed.~~ · F2.e resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §4.1 (`intro_funnel_config`) · Mark `reflection_delay_hours_after_deliverables` column as deprecated; Phase 5 Intro Funnel build session drops it from the migration and consumes from `settings` instead.~~ · F2.e resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `docs/specs/intro-funnel.md` Batch C step 15 sweep · Register remaining Intro Funnel autonomy thresholds in `docs/settings-registry.md`: abandon cadence (15 min / 24 h / 3 d), advance notice (5 business days), per-week cap (3), reschedule limit (2), refund window (48 h), SMS quiet hours (8 a.m.–9 p.m. local), email quiet hours (7 a.m.–10 p.m. local), shoot duration (60 min). Convert spec literals + helper code to `settings.get()`. · F2.e (broader sweep owed) · 2026-04-13 · **gate: Phase 3.5 Batch C step 15 (literal grep)**

### Phase 3.5 Step 11 Stage 2 — F2.a (bundled deliverables release)

- ~~`docs/specs/intro-funnel.md` §15.1 · Bundled `deliverables_ready` rule: gate fires only when both gallery URL pasted AND Six-Week Plan approved; whichever is second triggers the unified state + single bundled announcement email; idempotent on either handler. Added cockpit `intro_funnel_awaiting_bundle` quiet entry showing the waiting side.~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §13.1 · Reflection clock starts from the bundled `deliverables_ready` transition; settings key reference confirmed (`intro_funnel.reflection_delay_hours_after_deliverables`).~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §3 step 8 · Journey narration rewritten as bundled reveal (gallery + plan); references upfront timeframe signposting.~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §5.1 · State-machine annotation: `deliverables_ready` triggered by bundle gate (both pre-conditions), not by Pixieset URL paste alone.~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §4.1 · Added `gallery_ready_at`, `plan_ready_at`, `deliverables_ready_at` columns on `intro_funnel_submissions`.~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §17.2 · Notifications: added `intro_funnel_awaiting_bundle`, `six_week_plan_viewed`, bundled `deliverables_ready` quiet entries.~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §24 · Content mini-session must produce upfront timeframe signposting copy + bundled announcement email body (replacing photos-only wording).~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §2.6 · Plan-released wording rewritten as bundled gate; this spec stops emitting its own release email; cockpit `intro_funnel_awaiting_bundle` referenced for the plan-ready-but-no-gallery-yet state.~~ · F2.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `FOUNDATIONS.md` §11.2 `sendEmail()` classification enum · Add `deliverables_ready_announcement` (single bundled gallery+plan email per Intro Funnel §15.1). · F2.a resolution · 2026-04-13 · **gate: Phase 5 Intro Funnel build session (or Phase 4 foundation session if added to the §11.2 enum patch list)**
- `docs/specs/six-week-plan-generator.md` §10.5 · `sendEmail()` classifications: confirm bundled-release path no longer needs a `six_week_plan_release` value (or mark as unused/superseded). · F2.a resolution · 2026-04-13 · **gate: Phase 5 Six-Week Plan build session**
- `docs/specs/sales-pipeline.md` activity_log.kind enum · Add `gallery_attached`, `intro_funnel_awaiting_bundle`, `six_week_plan_viewed` (or confirm existing values cover them). · F2.a resolution · 2026-04-13 · **gate: Phase 5 Sales Pipeline build session (or rolled into Intro Funnel build session)**
- `docs/specs/daily-cockpit.md` `getWaitingItems()` source-spec stubs · Acknowledge `intro_funnel_awaiting_bundle { waiting_on: 'gallery' | 'plan' }` as a quiet feed entry from Intro Funnel; refreshes (clear + re-emit) on each side completing. · F2.a resolution · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session**

### Phase 3.5 Step 11 Stage 3 follow-up — Admin first-login sequencing lock (Brand DNA → Setup Wizards critical flight)

Andy's verification question after Stage 3 surfaced a handoff gap: each gate was individually specced but the bridge beat ("after Brand DNA completes, Setup Wizards critical flight auto-triggers as one continuous arc") was implicit. Locked now.

- ~~`docs/specs/brand-dna-assessment.md` §11.1 · Added "Post-completion handoff into Setup Wizards critical flight" block: reveal settles → direct transition into `stripe-admin` → Resend → Graph API → capstone → cockpit, no cockpit detour between gates. `hasCompletedCriticalFlight(user)` detection runs in same middleware layer as the Brand DNA gate; if Brand DNA clears but critical flight incomplete, admin routes 302 to `/lite/setup/critical-flight/[nextWizardKey]`. Middleware check self-terminates per user once all three critical-flight `wizard_completions` rows exist.~~ · Admin first-login sequencing lock · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/setup-wizards.md` §8.1 · Added mirror sequencing lock: critical-flight middleware check runs after Brand DNA gate clears; lazy-surfacing (§8.4) only begins after flight completes.~~ · Admin first-login sequencing lock · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `FOUNDATIONS.md` §11.8 (First-Login Brand DNA Gate primitive) · Extend primitive definition to include the critical-flight middleware layering — same middleware stack, Brand DNA gate runs first, critical-flight check runs second, both self-terminate per user on completion. · Admin first-login sequencing lock · 2026-04-13 · **gate: Phase 4 foundation session**
- `INCIDENT_PLAYBOOK.md` (Phase 6) · Document the critical-flight bypass path alongside `BRAND_DNA_GATE_BYPASS=true` — if a bug in the critical-flight middleware ever locks Andy out mid-flight, a similar env var or manual `wizard_completions` row insert is the recovery path. · Admin first-login sequencing lock · 2026-04-13 · **gate: Phase 6 launch**

### Phase 3.5 Step 11 Stage 3 — F3.f (Daily Cockpit contract verification)

- ~~`docs/specs/six-week-plan-generator.md` §12.2 · Fixed count typo: "3 new source kinds" → "4 new source kinds" (list already had 4; only the intro line was wrong).~~ · F3.f resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/daily-cockpit.md` §363 (`getWaitingItems()` spec roster) · Added Six-Week Plan Generator to the spec list with its 4 emitted kinds named inline.~~ · F3.f resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/daily-cockpit.md` §398 (Health banner source contracts) · Added Six-Week Plan Generator to the banner-contributing spec roster with its emitted `six_week_plan_retainer_payment_without_refresh_review` kind named inline.~~ · F3.f resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.

### Phase 3.5 Step 11 Stage 3 — F3.e (Plan view during retainer migration window)

- ~~`docs/specs/six-week-plan-generator.md` §6 intro · Added "Single surface, evolving source" lock block — `/portal/[token]/plan` is the one plan surface across lifecycle; read-source evolves (`six_week_plans` pre-retainer → Client Context `active_strategy` on Won); retainer mode does not add a second surface; label stays "Your plan" through pending-refresh-review, flips to "Your strategy" on live.~~ · F3.e resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §8.1 · Added step 5: portal read-source swap on Deal → Won; surface reads migrated Client Context `active_strategy`; pending band renders above intro; "Start Week 1" suppressed; activation driven by first retainer payment (§8.3), not prospect click.~~ · F3.e resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §8.3 · Week 1 trigger also clears pending-band, activates tracker mode, and flips navigation label "Your plan" → "Your strategy". If `pending_refresh_review` still true, band remains until Andy completes refresh-review.~~ · F3.e resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §17 (content mini-session) · Added pending-refresh-review band copy item with placeholder seed.~~ · F3.e resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `docs/specs/client-management.md` §10 retainer mode · Add lock: retainer mode does NOT render its own plan/strategy surface; consumes `/portal/[token]/plan` owned by `docs/specs/six-week-plan-generator.md` §6 (which is now canonical across both pre-retainer and retainer modes). Navigation label swap ("Your plan" → "Your strategy") on `active_strategy.status = live` AND first retainer payment landed — both conditions required; either alone keeps "Your plan". · F3.e resolution · 2026-04-13 · **gate: Phase 5 Client Management build session**
- `docs/specs/client-context-engine.md` · Confirm `active_strategy` artefact carries a `status` enum (`pending_refresh_review` | `live`) and that read-paths from the portal plan surface can filter on it. Already listed as a patch owed (see §14 of Six-Week Plan Generator spec); F3.e tightens the spec — the `status` field is load-bearing for portal UX, not just Andy's cockpit surfacing. · F3.e resolution · 2026-04-13 · **gate: Client Context Engine build session / Phase 5**
- `docs/specs/daily-cockpit.md` `getWaitingItems()` source-spec stubs · Existing `six_week_plan_refresh_review_requested { clientId, planId }` waiting-item (per §8.1) is unchanged by F3.e; confirm on consuming side. The portal pending-band is a prospect-side surface, not a cockpit surface — no new cockpit entry needed. · F3.e confirmation · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session**

### Phase 3.5 Step 11 Stage 3 — F3.d (Day-60 wind-down: two-beat expiry with soft CTA)

- ~~`docs/specs/six-week-plan-generator.md` §8.4 · Rewrote day-60 lights-out as two scheduled beats: day-53 wind-down expiry email (PDF attached, soft CTA mailto with prefilled subject `"Coming back about my plan — {business_name}"`, proportional earned tone — no pitch, no form) and day-60 archive-only job. Warm sign-off framing; closing beat of the 60-day arc.~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §9 · Added `plan.expiry_email_days_before_archive` settings key (default 7 → email lands day 53).~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §10.1 · `six_week_plans` table gains `portal_expiry_email_sent_at` column.~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §10.3 · Added `six_week_plan_expiry_email_sent` activity_log entry.~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §10.4 · Split scheduled_tasks: added `six_week_plan_expiry_email` (day-53 sender); reduced `six_week_plan_non_converter_expiry` scope to day-60 archive-only.~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §17 (content mini-session) · Added expiry email body direction (warm sign-off + soft mailto CTA) and archived-portal microcopy items.~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/settings-registry.md` Plan section · Added `plan.expiry_email_days_before_archive` (default 7); Plan total bumped 8 → 9; overall total bumped 56 → 57.~~ · F3.d resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `FOUNDATIONS.md` §11.2 `sendEmail()` classification enum · Add `six_week_plan_expiry_email` (day-53 wind-down, soft CTA mailto). Confirm `six_week_plan_non_converter_expiry` remains or is retired — the archive beat has no outbound send, so the existing classification (if it existed for release comms) should be removed or repurposed. · F3.d resolution · 2026-04-13 · **gate: Phase 5 Six-Week Plan build session (or Phase 4 foundation session if rolled into the §11.2 enum patch list)**
- `docs/specs/daily-cockpit.md` pipeline panel · Andy's manual "extend portal" action (per §11 settings, `plan.extend_portal_days_on_manual_override`) must be surfaceable when the day-53 expiry email fires — confirm the pipeline panel shows a quiet "wind-down sent" signal on the prospect deal card so Andy has a one-click extend before day 60. Low priority; optional. · F3.d follow-up · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session — optional, confirm or drop**
- `docs/specs/client-management.md` §10 archived-portal state · Confirm the day-60 archive UX — portal shows read-only plan page + re-download PDF + mailto door back — is already covered by the existing archived-mode spec. If not, add a one-liner that archived portals for non-converters must still expose the plan PDF re-download and the soft mailto. · F3.d follow-up · 2026-04-13 · **gate: Phase 5 Client Management build session**

### Phase 3.5 Step 11 Stage 3 — F3.c (Revision-resolution prospect-side UX)

- ~~`docs/specs/six-week-plan-generator.md` §7.2 · Clarified Andy's three revision-review actions with review-before-send lock on all paths; explain + hand-reject share a single review screen (Haiku draft vs empty textarea), single "Send reply" action.~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §7.3 · New section defining prospect-side notification: email-first + quiet portal echo. Regenerate fires `six_week_plan_revision_regenerated` email on new-plan approval + inline card. Explain/hand-reject fires `six_week_plan_revision_explained` email (Andy's reply IS the body) + inline card that expands to show reply text. Bartender reads revision resolution as chat context.~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §7.4 / §7.5 (renumbered) · One-revision enforcement retained; activity log entries clarified (both explain + hand-reject fire `six_week_plan_revision_explained` with `source` payload).~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §10.1 · `six_week_plans` table gains `revision_reply_sent_at`, `revision_reply_body`, `revision_reply_dismissed_at` columns.~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §10.5 · `sendEmail()` classifications replaced: `six_week_plan_revision_resolved` renamed/split into `six_week_plan_revision_regenerated` + `six_week_plan_revision_explained` (1:1 with the two revision paths).~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §6.1 · Added revision reply inline card UI state (two variants: regenerate, explain/hand-reject) above the intro block. Quiet inline card, Tier-1 house spring entrance, dismiss persists per prospect.~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §17 (content mini-session) · Added revision reply inline card copy (both variants + dismiss microcopy) and revision-resolution email bodies (`six_week_plan_revision_regenerated` full, `six_week_plan_revision_explained` envelope frame around Andy's reply).~~ · F3.c resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `FOUNDATIONS.md` §11.2 `sendEmail()` classification enum · Replace `six_week_plan_revision_resolved` with the two new values `six_week_plan_revision_regenerated` + `six_week_plan_revision_explained`. · F3.c resolution · 2026-04-13 · **gate: Phase 5 Six-Week Plan build session (or Phase 4 foundation session if rolled into the §11.2 enum patch list)**
- `docs/specs/client-management.md` §10.3 (bartender safe actions) · Add "surface the revision reply" / "point the prospect to the plan page when asked about the reply" capability. Reads `six_week_plans.revision_reply_body` + `revision_reply_sent_at` as chat context. Extends the existing "navigate to a specific invoice or quote" pattern. · F3.c resolution · 2026-04-13 · **gate: Phase 5 Client Management build session**
- `docs/specs/daily-cockpit.md` `getWaitingItems()` source-spec stubs · Acknowledge `six_week_plan_revision_request { planId, prospect_name, note_preview }` as a waiting item from Six-Week Plan Generator §7.2 (already listed in §12.2, but the consuming cockpit spec must have it in its `emits:` block post-Phase 3.5 step 7). · F3.c follow-up · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session**
- `lib/ai/prompts/six-week-plan-revision-reply.ts` content authoring · Prompt for the Haiku-drafted explain-reply. Must read the plan + prospect's revision note + Brand DNA + Client Context. Voice: Andy's register (direct, personal — NOT bartender). Never defensive. Acknowledge the note, explain the reasoning, offer the retainer conversation as the place for deeper discussion. Belongs in Six-Week Plan Generator content mini-session. · F3.c resolution · 2026-04-13 · **gate: Six-Week Plan Generator content mini-session**

### Phase 3.5 Step 11 Stage 3 — F3.b (PDF as brand-forward take-away artefact)

- ~~`docs/specs/six-week-plan-generator.md` §6.5 · Rewrote PDF takeaway with brand-forward stance: filename `SuperBad-Six-Week-Plan-[business-slug]-[YYYY-MM-DD].pdf`, cover page (SuperBad mark + business name + plan date + subtitle), intermediate-page minimal footer (logo + page number), closing sign-off spread (sprinkle line in larger type + logo beneath), branded render overlay on first download, supersede-prompt modal when prospect holds a lower `generation_version`, day-60 email attachment always fresh-rendered.~~ · F3.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §13.3 · Sprinkle-claim placement clarified: closing sign-off page only, larger typography, not repeated in per-page footers; rationale (preserves single-beat weight) + cross-reference to F3.b.~~ · F3.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §10.3 · `six_week_plan_pdf_downloaded` activity_log entry carries `{ plan_id, generation_version }` payload so the portal can detect stale-PDF state.~~ · F3.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §17 (content mini-session) · Added PDF layout direction item — cover page composition, intermediate footer spec, closing sign-off spread, render overlay visual direction, sprinkle wording.~~ · F3.b resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `docs/specs/surprise-and-delight.md` sprinkle bank · Update the Six-Week Plan Generator sprinkle claim row to reflect "closing sign-off page, larger typography, single occurrence" rather than "footer once". · F3.b resolution · 2026-04-13 · **gate: next S&D spec touch / Phase 3.5 cross-spec cleanup**
- `docs/specs/design-system-baseline.md` revisit queue · Add `motion:pdf_render_overlay` (or lightweight token: "branded full-screen progress overlay with auto-dismiss on completion") as a Tier-1 motion token so the same pattern can be reused across other synchronous renders (future PDF exports, branded report generation, etc.). Optional — can be absorbed as a generic token during design-system-baseline revisit. · F3.b resolution · 2026-04-13 · **gate: design-system-baseline revisit session**
- `docs/specs/client-management.md` §10.3 (bartender safe actions) · The bartender may be asked "can I get the PDF again?" — confirm the chat can surface the portal plan page's download link (or inline the download trigger) without bypassing the supersede-prompt. No new capability; existing "navigate to a specific invoice or quote" pattern extends cleanly. · F3.b follow-up · 2026-04-13 · **gate: Phase 5 Client Management build session**
- `BUILD_PLAN.md` / Phase 5 Session C preconditions · Puppeteer setup must be in place before Session C lands. Branded Invoicing or Quote Builder's Phase 5 session — whichever ships first — lands the Puppeteer dependency; Six-Week Plan Session C consumes it. Already named in §18 preconditions; F3.b confirms no new dependency emerges. · F3.b confirmation · 2026-04-13 · **gate: Phase 4 Build Plan sequencing**

### Phase 3.5 Step 11 Stage 3 — F3.a (First-visit-after-bundle deliverables hub)

- ~~`docs/specs/client-management.md` §10.2 + §10.2.1 + §10.2.2 · Added one-shot deliverables hub as portal home override for first visit after bundled `deliverables_ready`. Replaces generic 3-step first-visit tour for bundled-release portals. Tiles: gallery + plan, equal weight, Tier-2 `motion:bundle_reveal`. Dismiss-to-tile routes to `/portal/[token]/gallery` or `/portal/[token]/plan` and queues bartender first-visit opening line for next chat-home navigation. Sticky server-side via `intro_funnel_submissions.bundled_hub_seen_at`.~~ · F3.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §4.1 (`intro_funnel_submissions` schema) · Added `bundled_hub_seen_at timestamp (nullable)` column.~~ · F3.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §15.1 · Added hub handoff block (bundled email CTA → `/portal/[token]` → hub render → chat-home handoff) with cross-reference to Client Management §10.2.1.~~ · F3.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/intro-funnel.md` §24 (content mini-session) · Added "First-visit-after-bundle deliverables hub copy" item — hub header, tile microcopy, post-hub bartender first-visit opening line.~~ · F3.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §6.1 · Added explanatory block that the plan page is not the first-visit entry state after bundled release; first-visit arrival is Client Management §10.2.1's hub.~~ · F3.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- ~~`docs/specs/six-week-plan-generator.md` §6.6 + §13.4 (motion candidates) · Rescoped `motion:plan_reveal` from "first portal visit" to "plan section's internal first-open from the hub's plan tile"; added new `motion:bundle_reveal` candidate (owned by Client Management §10.2.1) for the hub arrival.~~ · F3.a resolution · 2026-04-13 · **APPLIED 2026-04-13** inline.
- `docs/specs/client-management.md` §10.4 Prompt 1 (bartender opening line) content authoring · When rendering chat-home immediately after a hub dismiss (detectable via `bundled_hub_seen_at` just-set + no prior chat messages), the opening line must acknowledge both deliverables and offer navigation — never summarise the plan, never explain the gallery. Belongs in the Client Management content mini-session. · F3.a resolution · 2026-04-13 · **gate: Client Management content mini-session**
- `docs/specs/design-system-baseline.md` revisit queue · Add Tier-2 candidate `motion:bundle_reveal` — gallery tile + plan tile surfacing together as a single orchestrated beat on first-visit-after-bundle hub. · F3.a resolution · 2026-04-13 · **gate: design-system-baseline revisit session**
- `docs/specs/daily-cockpit.md` `getWaitingItems()` or attention-rail · Consider a quiet feed entry `intro_funnel_hub_seen { deal_id, prospect_name, picked: 'gallery' | 'plan' }` so Andy gets a light signal that the prospect has opened the bundled deliverables and which tile they chose first (ambient intel, not actionable). Low priority; optional. · F3.a follow-up · 2026-04-13 · **gate: Phase 5 Daily Cockpit build session — optional, confirm or drop**

## Applied

All rows below applied by `phase-3.5-backward-reconciliation` on 2026-04-13 unless noted.

### FOUNDATIONS

- `FOUNDATIONS.md` · Add LLM model registry + external-call observability section per memory `project_llm_model_registry.md` — added §11.6
- `FOUNDATIONS.md` §11.2 · Add `classification: 'transactional' | 'outreach'` parameter to `sendEmail()` — documented; classification enum extended to include 6 hiring values
- `FOUNDATIONS.md` §11.2 `sendEmail()` classification enum · Add 6 new values: `hiring_invite`, `hiring_followup_question`, `hiring_trial_send`, `hiring_archive_notice`, `hiring_contractor_auth`, `hiring_bench_assignment`

### Setup Wizards wiring

- `docs/specs/saas-subscription-billing.md` Q18 · `WizardDefinition` for `saas-product-setup` — added §1.1
- `docs/specs/content-engine.md` · `WizardDefinition` for `content-engine-onboarding` — added §1.1
- `docs/specs/unified-inbox.md` · Split Graph API consent into `graph-api-admin` + `graph-api-client` — added §13 preamble
- `docs/specs/onboarding-and-segmentation.md` · `WizardDefinition` for `onboarding-segmentation` — added §1.1
- `docs/specs/brand-dna-assessment.md` · `WizardDefinition` for `brand-dna` — added §1.1
- `docs/specs/intro-funnel.md` · `WizardDefinition` for `intro-funnel-questionnaire` — folded into §0 retroactive patch block
- `docs/specs/setup-wizards.md` · Add `finance-tax-rates` step — added §5.2

### Daily Cockpit contract additions

- `docs/specs/daily-cockpit.md` · `getHealthBanners()` contract: `in_flight_admin_wizard` + 3 finance kinds + 3 hiring kinds; attention-rail `wizard_completion` + 7 hiring source kinds

### Cost & Usage Observatory registry additions

- `docs/specs/cost-usage-observatory.md` · `admin-setup-assistant`, `finance-narrative`, `stripe-balance-read`, `stripe-balance-transactions-read`, 8 hiring jobs — consolidated into Registered jobs inventory

### Branded Invoicing

- `docs/specs/branded-invoicing.md` §4.1 · `?filter=overdue` query param
- `docs/specs/branded-invoicing.md` §4.5 · `renderBundle()` multi-document export variant

### Cross-spec enum additions

- `activity_log.kind` enum · 10 Observatory + 8 Finance + 16 Hiring values — consolidated in sales-pipeline.md

### Content Engine claimable backlog

- `docs/specs/content-engine.md` §14.0 · `listClaimableContentItems` / `claimInternalContentItem` / `releaseContentItem` + new `content_items` columns

### Finance Dashboard

- `docs/specs/finance-dashboard.md` §4.2 · `expense_line.candidate_id` FK + "Contractor payments" rollup

### Task Manager

- `docs/specs/task-manager.md` · `getAvailableBenchMembers(role, hours_needed, options?)` documented as cross-spec consumer contract

### Lead Generation

- `docs/specs/lead-generation.md` §13.0 · Reply-intelligence primitive formalised (`classifyReply` + `registerReplyDispatch`)

### Unified Inbox

- `docs/specs/unified-inbox.md` §11.2 · `hiring_invite` reply dispatch table (5 intents)

### Intro Funnel / Client Management lifecycle

- `docs/specs/intro-funnel.md` · §0 retroactive patches P1–P4 + §2 lock 14 amendment (trial shoot facts, 60-day portal lifecycle, questionnaire extension, portal migration to Client Management)
- `docs/specs/client-management.md` §10.0 · Pre-retainer rendering mode table (pre-retainer / retainer / archived) + settings keys
- `docs/specs/client-management.md` §10.3 · Bartender gains Six-Week Plan awareness ("explain a week/task" limited safe action)

### Sub-agent-surfaced candidates (applied 2026-04-13)

- `docs/specs/sales-pipeline.md` §11A · Voice & Delight treatment (empty states, toasts, Tier 2 budget=0, S&D hooks)
- `docs/specs/client-context-engine.md` §14.5 · Draft drawer motion spec (slide-from-right Tier 2, unsent-draft pulse, reduced-motion parity)
- `docs/specs/design-system-baseline.md` · Discipline #12 "Voice is part of the design system" — central banks pointer + motion-universal reference
- `docs/specs/quote-builder.md` §4.1 · Two-pane live preview motion spec (mount, debounced crossfade, mobile/desktop frame toggle)
- `docs/specs/surprise-and-delight.md` · Data-access audit checklist — JSDoc schema, 4 invariants, Phase 4 AUTONOMY_PROTOCOL CI check

### Broad backward reconciliation pass

- All pre-2026-04-13 locked specs · Retroactive audit against memories added after each spec's lock date — pass completed; 5 new candidates surfaced by Explore sub-agent and all applied above

### Phase 3.5 step 2 — cross-spec flag reconciliation (2026-04-13)

- `docs/specs/client-context-engine.md` §11.1, §11.2, §11.3, §12.5 · Define `active_strategy` artefact (origin, lifecycle, table, API surface) — was raised by Six-Week Plan Generator §12.4, never acknowledged in Context Engine
- `docs/specs/sales-pipeline.md` §4.1 `activity_log.kind` enum · 4 new values: `active_strategy_created`, `active_strategy_reviewed`, `active_strategy_updated`, `active_strategy_archived`
- `docs/specs/brand-dna-assessment.md` §3.2 · Existing-profile skip note — was self-flagged as cross-spec gap in onboarding-and-segmentation.md §15.4

### Phase 3.5 step 2a — spec self-containment pass (2026-04-13)

- `docs/specs/sales-pipeline.md` §4.1 `activity_log.kind` enum · Consolidated 17 Quote Builder + 8 Branded Invoicing + 8 Brand DNA + 21 Intro Funnel + 10 Lead Generation + 15 Content Engine + 11 Client Context Engine (non-active_strategy) + 8 Client Management + 8 Daily Cockpit + 8 Onboarding + 11 SaaS Billing + 6 Setup Wizards + 18 Unified Inbox + 17 Six-Week Plan = 166 values in labelled blocks. Authoritative-receiver note added at top of §4.1.
- `docs/specs/quote-builder.md` §5.4 `scheduled_tasks.task_type` enum · Consolidated 31 values across 10 specs (Quote Builder + Branded Invoicing + Client Context Engine + Content Engine + Client Management + Daily Cockpit + Unified Inbox + SaaS Billing + Observatory + Finance Dashboard) in labelled blocks, with authoritative-union note. Includes `manual_invoice_generate` per Branded Invoicing refinement.
- `docs/specs/quote-builder.md` §8.2 handler-map dispatch table · Expanded from 5 entries to 32 to list every owner-spec handler that must register against the shared worker. Each entry flagged with its owner-spec section reference.
- `docs/specs/quote-builder.md` §3.2 (step 7 post-accept side effects) · First-cycle manual-billed enqueue switched from `manual_invoice_send` to `manual_invoice_generate` with `run_at = first_invoice_date - 3 days` per Branded Invoicing's two-step review-window refinement.
- `docs/specs/quote-builder.md` §3.3 (long-tail monthly invoicing) · Rewritten to describe the two-task per-cycle chain (`manual_invoice_generate` → `manual_invoice_send`), with draft-status branching on void/sent/draft and chain-stop conditions.
- `docs/specs/quote-builder.md` §8.3 handlers · Narrowed existing `handleManualInvoiceSend` to send-only behaviour (check status, dispatch, chain-forward). Added full `handleManualInvoiceGenerate` signature (create draft, cockpit notification, enqueue matching send task).

### Phase 3.5 Batch A — steps 3, 3a, 3b, 4, 5 (2026-04-13)

- **Step 3 — deferred-task inventory:** audited all specs for deferred/parked items; confirmed nothing quietly dropped. Every deferral has a home (v1.1 roadmap, Phase 5 content mini-session, content mini-session scope sections, or open-questions lists). No new patches owed.
- **Step 3a — content-authoring output home:** created `docs/content/README.md` establishing `docs/content/<spec-name>.md` convention for content mini-session output. No pre-existing content required re-homing (all prior mini-sessions produced spec-inline locks).
- **Step 3b — prompt-file extraction:** created `lib/ai/prompts/README.md` + `INDEX.md` (47 prompts across 14 specs) + 14 per-spec stub files (`quote-builder.md`, `branded-invoicing.md`, `intro-funnel.md`, `client-context-engine.md`, `brand-dna-assessment.md`, `content-engine.md`, `six-week-plan-generator.md`, `cost-usage-observatory.md`, `finance-dashboard.md`, `daily-cockpit.md`, `lead-generation.md`, `client-management.md`, `task-manager.md`, `unified-inbox.md`). Each of the 14 prompt-heavy specs now carries a `> **Prompt files:**` cross-reference at the top pointing at its stub file. Phase 4 foundation splits stubs into per-prompt `.ts` files.
- **Step 4 — SCOPE.md vs specs alignment:** audit complete. Four product-judgement items surfaced to Andy at batch-A close-out (now listed in Pending → SCOPE.md section above): Branded Invoicing, Intro Funnel, Six-Week Plan Generator, Hiring Pipeline — none are in SCOPE.md as first-class features despite having full specs. Awaiting Andy's call on promote-to-v1.0 vs sub-heading vs defer-to-v1.1.
- **Step 5 — FOUNDATIONS patch-list consolidation:** audit complete. Three patches already applied (§11.6 model registry, §11.2 classification base, §11.2 6 hiring classification values). Four Phase-5-gated pending patches recorded in Pending → FOUNDATIONS.md section above (six-week-plan classification extensions, Task Manager + S&D disciplines 24–29, `scheduled_tasks` §11-tier pointer, Observatory unified-send-gate cross-ref). No blockers for Phase 4 Build Plan sequencing.

### Phase 3.5 Batch B — steps 6, 7, 7a, 10 (2026-04-13)

- **Step 6 — cross-spec enum audit:** `activity_log.kind` (166 values) and `scheduled_tasks.task_type` (31 values) consolidation in place from Batch A step 2a. Remaining audit: `deals.won_outcome` enum extended from `['retainer','saas']` to `['retainer','saas','project']` per Quote Builder §5.6 one-off project outcome — applied to `docs/specs/sales-pipeline.md` line 156. No other enum gaps found.
- **Step 7 — Phase 4/5 coordination items:** three cross-cutting items recorded in Pending → FOUNDATIONS.md and Specs sections above for downstream sequencing — (1) Observatory prompt-cardinality reconciliation against `lib/ai/prompts/INDEX.md`, (2) runtime definitions for `canSendTo`/`renderToPdf`/`checkBrandVoiceDrift` (referenced across ≥5 specs with only interface hints), (3) Daily Cockpit `getWaitingItems()`/`getHealthBanners()` source-spec enumeration gap. All gated to their respective Phase 4/5 build sessions; none block Phase 4 Build Plan.
- **Step 7a — settings registry:** created `docs/settings-registry.md` with full 56-key table at v1.0 seed (Finance 11, Wizards 6, Plan 8, Portal 3, Hiring 28). Consumers read via `settings.get(key)` only; Phase 5 Session A emits the seed migration from this file. Every spec with autonomy thresholds now expresses them as settings keys instead of inline literals.
- **Step 10 — canonical subscription state machine:** added as `FOUNDATIONS.md` §12 (13 states spanning Stripe-billed + manual-billed paths; canonical persistence on `deals.subscription_state`; transition owner map; cross-cutting `activity_log` rule). Three reference patches applied: (a) `docs/specs/quote-builder.md` §7.1 `invoice.payment_failed` transitions `active_current → past_due` with retainer parity note; (b) `docs/specs/branded-invoicing.md` §3.1 step 11 chain-stop on subscription exit; (c) `docs/specs/client-management.md` §2.3 Pause action visibility gated on `subscription_state = 'active_current'` + commitment window + `pause_used_this_commitment = false` + SaaS-only (retainers cannot pause).
