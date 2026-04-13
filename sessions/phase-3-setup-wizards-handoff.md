# Phase 3 — Setup Wizards — Session Handoff

**Date:** 2026-04-13
**Phase:** 3 — Feature Specs
**Spec produced:** `docs/specs/setup-wizards.md`
**Status:** LOCKED

---

## What was decided (11 questions)

- **Library-as-primitive.** This spec owns the shell, step-type library, completion registry, Observatory contract. Consuming specs define wizard *content*, not shell behaviour.
- **Four-gate functionality discipline.** Completion contracts per wizard (spec-level) → per-session build gate → real-vendor verification + E2E + typecheck → Phase 6 LAUNCH_READY row per wizard. Shell refuses completion without required artefacts.
- **Slideover default, dedicated-route exception.** Slideover renders for creating/modifying connections. Dedicated route reserved for flagship (Brand DNA, Onboarding + Segmentation) and email/banner-launched wizards.
- **~10 step-type library + custom escape hatch.** Named: `form`, `oauth-consent`, `api-key-paste`, `webhook-probe`, `dns-verify`, `csv-import`, `async-check`, `content-picker`, `review-and-confirm`, `celebration`, `<WizardStep.Custom>`.
- **Auto-save + 24h email nudge + 7d admin cockpit banner + 30-day expiry with day-29 warning.** Non-resumable step types (OAuth, webhook-probe, dns-verify) rewind on resume.
- **Observatory registration automatic on completion + visible post-completion summary.** Vendor manifest at `lib/integrations/vendors/<vendor>.ts` is source of truth; `registerIntegration()` consumes it.
- **One shell, two tones** via `audience: 'admin' | 'client'` prop.
- **First-run admin critical flight** = 3 wizards (Stripe, Resend, Graph API) in fixed order, capstone ceremony on completion. Rest surface lazily.
- **Voice everywhere + completion ceremony.** Sprinkle claim: tab titles on wizard surfaces. New motion slot `motion:wizard_completion` (Tier-2) + new sound slot `sound:wizard_complete` (registry 8 → 9) + potential `motion:critical_flight_capstone` (Tier-1 flagship — design revisit decides).
- **Help escalation after 2 consecutive step failures.** Client → portal bartender chat. Admin → dedicated Claude chat (new Opus job `admin-setup-assistant`, thread-persistent in new `admin_support_threads` table).
- **Completion events always emitted; 5 curated client-facing wizards also show as Daily Cockpit attention-rail chips** (Brand DNA finished, SaaS onboarding finished, Intro Funnel questionnaire, retainer first portal sign-in, any wizard with human-reply outcome).

---

## Technical decisions locked silently (Q6 onward, per `feedback_technical_decisions_claude_calls.md`)

Mid-session Andy flagged I was asking too many technical questions. From Q6 onward, these were locked without surfacing:

- `wizard_completions` table keyed by `(user_id, wizard_key)` with repeat-completion support.
- Mobile layout: single-column, thumb-zone primary action.
- Permissions: role-gated + account-scoped.
- Progress indicator: slim horizontal segmented bar, hover/tap labels, no percentage text.
- Error handling: per-step error states, retry inline, escalation after 3 fails.
- Kill-switch abandon: `wizard_progress.abandoned_at` + `activity_log` entry.
- Audience tone dimensions (spacing, copy register, ceremony intensity, sprinkle eligibility).
- Data model shape (3 new tables: `wizard_progress`, `wizard_completions`, `integration_connections`).
- Settings keys (6).
- Scheduled-tasks types (3 new).
- Activity-log kinds (6 new).

If Andy wants any of these reopened, flag and rebrainstorm.

---

## New primitives introduced

- **`wizard_progress`** — in-flight wizard state (unique `(user_id, wizard_key)` where `abandoned_at IS NULL`).
- **`wizard_completions`** — completion ledger, allows repeats.
- **`integration_connections`** — shared primitive for every integration wizard (vendor_key, owner, encrypted credentials, metadata, status including `'disabled-kill-switch'`, band_registration_hash, connected-via-wizard-completion FK). This is the table feature code reads to check if an integration is usable — NOT `wizard_completions`.
- **`admin_support_threads`** — Claude setup-chat thread persistence (new, this spec).
- **Vendor manifests** — `lib/integrations/vendors/<vendor>.ts` co-locates SDK wrapper + Observatory band registration. ESLint rule shared with Observatory forbids direct vendor SDK import in feature code.
- **`WizardDefinition`** — typed contract consuming specs export; discovered at boot from `lib/wizards/registry.ts`.
- **`CompletionContract<T>`** — typechecker-enforced; shell refuses completion if `verify()` fails or required artefacts missing.
- **New Opus job:** `admin-setup-assistant` (help-escalation for admin wizards).
- **3 new `scheduled_tasks.task_type`:** `wizard_resume_nudge`, `wizard_expiry_warn`, `wizard_expire`.
- **6 new `activity_log.kind`:** `wizard_started`, `wizard_step_completed`, `wizard_completed`, `wizard_abandoned`, `wizard_resumed`, `integration_registered`.
- **6 new settings keys:** `wizards.expiry_days`, `wizards.resume_nudge_hours`, `wizards.admin_cockpit_banner_days`, `wizards.help_escalation_failure_count`, `wizards.step_retry_max`, `wizards.critical_flight_wizards`.

---

## Registry growth (flagged for design-system-baseline revisit)

- **Sound registry: 8 → 9** (new slot `sound:wizard_complete`).
- **Motion registry: +1 Tier-2 slot** (`motion:wizard_completion`).
- **Motion registry: +1 Tier-1 candidate slot** (`motion:critical_flight_capstone`, one-time-per-account — design revisit decides whether to spend a new flagship slot or inherit an existing one).

Revisit list, updated:
- 3 Tier-2 motion candidates from Intro Funnel (unchanged).
- 1 Tier-2 motion candidate from Brand DNA (cinematic reveal).
- 1 Tier-2 motion candidate from Setup Wizards (wizard completion) — NEW.
- 1 Tier-1 motion candidate from Setup Wizards (critical flight capstone) — NEW.
- 1 new sound (`sound:brand_dna_reveal`).
- 1 new sound (`sound:wizard_complete`) — NEW.

---

## Cross-spec flags for Phase 3.5

All added to `PATCHES_OWED.md`:

1. **`saas-subscription-billing.md` Q18** — replace inline product-setup-wizard description with `WizardDefinition` reference.
2. **`content-engine.md`** — onboarding flow references `WizardDefinition`.
3. **`unified-inbox.md`** — split Graph API into `graph-api-admin` + `graph-api-client` `WizardDefinition`s.
4. **`onboarding-and-segmentation.md`** — `WizardDefinition` reference.
5. **`brand-dna-assessment.md`** — `WizardDefinition` reference, flagship capstone treatment.
6. **`intro-funnel.md`** — reflection questionnaire `WizardDefinition`.
7. **`daily-cockpit.md`** — `getHealthBanners()` contract gains `in_flight_admin_wizard` kind; attention-rail chip kinds gain `wizard_completion`.
8. **`cost-usage-observatory.md`** — model registry gains `admin-setup-assistant` Opus job; §7 registry documentation notes setup-wizard actor conventions.

---

## Content mini-session owed

Small-medium. `superbad-brand-voice` + `superbad-visual-identity`. Produces:

- ~30 client-tone outro lines + ~15 admin-tone outro lines (stratified by wizard type).
- Critical-flight capstone line.
- Tab-title rotation pools per wizard phase per audience.
- Resume-nudge + expiry-warning email templates.
- Kill-switch maintenance message variants.
- `admin-setup-assistant.ts` Opus prompt calibrated against 6-8 synthetic failure scenarios.
- `/lite/integrations` empty-state copy.
- Post-completion Observatory summary template.

Output to `docs/content/setup-wizards.md`. Must run before Phase 5 Session B.

---

## Sprinkle claim

**Browser tab titles on wizard surfaces.** Marked `[CLAIMED by setup-wizards]` in `docs/candidates/sprinkle-bank.md`. Dynamic, stratified by wizard phase + audience.

No new hidden eggs claimed (admin-egg expansion brainstorm is the right venue for that).

---

## Phase 5 sizing

Three sessions:

- **A** (Medium-large) — Shell + 10 step types + data model + `registerIntegration()`.
- **B** (Medium) — First-run critical flight + capstone + admin-setup-assistant Claude chat + motion/sound wiring.
- **C** (Medium) — `/lite/integrations` hub + remaining admin wizards (Pixieset, Meta/Google Ads, Twilio, generic API-key integration template, domain-verify).

Client-facing wizards (Brand DNA, Content Engine onboarding, Graph API client, Onboarding + Segmentation, Intro Funnel questionnaire) are built as part of their parent feature's build sessions. This spec doesn't own them — it owns the shell they render through.

---

## New memories owed

**None.** All principles invoked in this session were already memorised:
- `feedback_setup_is_hand_held.md` (core rationale for the spec).
- `feedback_felt_experience_wins.md` (drove the Q2 flip from A to C).
- `feedback_technical_decisions_claude_calls.md` (reinforced mid-session — Andy called out I was surfacing tech decisions; corrected from Q6 onward).
- `feedback_motion_is_universal.md` (every state change = motion moment).

---

## What the next session should know

**Recommended next spec: `docs/specs/finance-dashboard.md`.**

Per tracker: Finance Dashboard reads Stripe + Observatory data + SaaS subscription data. Setup Wizards now locks the `integration_connections` + vendor manifest + kill-switch primitives that Finance Dashboard will consume (it'll read Stripe admin integration status from `integration_connections`). After Finance Dashboard: Hiring Pipeline, then Six-Week Plan Generator (per Phase 3 backlog #19), then Phase 3.5 review.

---

## Honest reality check

- **Completion-contract drift** is the single biggest operational risk. Mitigation: typechecker + contract-version hash in `wizard_completions` + Phase 3.5 audit.
- **Step-type library drift** across 12 wizards will creep in if content mini-session doesn't produce a canonical copy library with named keys.
- **Critical flight UX has to earn itself** — three back-to-back setup wizards on first sign-in before Andy sees any product. The capstone moment is load-bearing. Content mini-session calibration on that one line matters.
- **Admin-setup-assistant Claude prompt is new and unvalidated.** Degrades gracefully to "here are the last 10 error lines" if unreliable.
- **Spec is large** (foundational infrastructure). Three Phase 5 sessions with careful sizing; Session A is the biggest and needs the shell's shape to be right the first time, because every subsequent wizard depends on it. Expect to spend extra context budget on shell abstractions — pays back across 12 consumers.
