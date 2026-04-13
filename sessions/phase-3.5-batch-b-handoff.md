# Phase 3.5 Batch B — Handoff

**Date:** 2026-04-13
**Scope:** Phase 3.5 steps 6, 7, 7a, 10
**Outcome:** all four steps complete; no blockers surfaced; no new stop points. Next: Step 11 end-to-end walkthrough with Andy.

---

## What was built

### Step 6 — cross-spec enum audit
- `activity_log.kind` (166 values) and `scheduled_tasks.task_type` (31 values) already consolidated in Batch A step 2a.
- **One gap found and fixed:** `deals.won_outcome` previously `['retainer','saas']`. Quote Builder §5.6 references a one-off "project" outcome (single-payment project work that settles without a subscription). Extended to `['retainer','saas','project']` at `docs/specs/sales-pipeline.md` line 156 with comment pointing at the source spec section.
- No other enum gaps surfaced.

### Step 7 — Phase 4/5 coordination items
Three cross-cutting items recorded in `PATCHES_OWED.md` → Pending (not applied — each is gated to its owner build session):

1. **Observatory prompt-cardinality reconciliation against `lib/ai/prompts/INDEX.md`.** Batch A step 3b built the 47-prompt INDEX. Observatory's registered-jobs inventory needs to include every prompt-keyed job so external-call cost attribution is complete. Gate: Phase 5 Observatory build session.
2. **Runtime definitions for `canSendTo(recipient, classification)`, `renderToPdf(htmlOrReactTree, opts)`, `checkBrandVoiceDrift(draftText, brandDnaProfile)`.** Referenced across ≥5 specs with only interface hints in FOUNDATIONS.md §11.2 / §11.5. Need full TS signatures + return shapes. Gate: Phase 4 foundation session.
3. **Daily Cockpit `getWaitingItems()` + `getHealthBanners()` source-spec enumeration.** Cockpit aggregates from 14 specs. Observatory/Finance/Hiring kinds are applied (Batch A), but several specs still lack an explicit `emits:` block naming their cockpit contributions. Gate: Phase 5 Daily Cockpit build session.

None of the three block Phase 4 Build Plan sequencing.

### Step 7a — settings registry
Created `docs/settings-registry.md` — authoritative source of truth for every `settings.get(key)` key at v1.0. 56 keys total:

- Finance (11) — `finance.gst_rate`, `finance.income_tax_rate`, `finance.bas_reminder_days_ahead`, `finance.eofy_reminder_days_ahead`, `finance.overdue_invoice_threshold_days`, `finance.outstanding_invoices_threshold_aud`, `finance.snapshot_time_local`, `finance.projection_horizon_days`, `finance.stage_age_decay_halflife_days`, `finance.recurring_review_debounce_hours`, `finance.export_retention_days`
- Setup Wizards (6) — `wizards.expiry_days`, `wizards.resume_nudge_hours`, `wizards.admin_cockpit_banner_days`, `wizards.help_escalation_failure_count`, `wizards.step_retry_max`, `wizards.critical_flight_wizards`
- Six-Week Plan (8) — `plan.portal_access_days_post_shoot`, `plan.chat_calls_per_day_non_converter`, `plan.revision_note_min_chars`, `plan.observations_min_chars`, `plan.regen_soft_warning_threshold`, `plan.pdf_cache_hours`, `plan.self_review_retry_on_fail`, `plan.extend_portal_days_on_manual_override`
- Portal (3) — `portal.non_converter_archive_days`, `portal.chat_calls_per_day_pre_retainer`, `portal.chat_calls_per_day_retainer`
- Hiring (28) — full set from `hiring-pipeline.md` §18 (discovery, invite, apply, trial, brief, bench, staleness sub-groups)

Phase 5 Session A (Foundations seed migration) reads this file and emits the `INSERT INTO settings` rows. Editor UI is v1.1 per `project_settings_table_v1_architecture` memory.

### Step 10 — canonical subscription state machine
Added `FOUNDATIONS.md` §12 "Canonical subscription state machine" before "Build-time disciplines". Content:

- **13 states** across Stripe-billed + manual-billed paths: `trial_pending`, `trial_active`, `trial_completed_awaiting_decision`, `quote_draft`, `quote_sent`, `quote_accepted`, `active_current`, `past_due`, `paused`, `cancel_scheduled_preterm`, `cancelled_buyout`, `cancelled_paid_remainder`, `cancelled_post_term`, `ended_gracefully`.
- **Canonical persistence** on `deals.subscription_state`. All other spec references must read/write via this column — no shadow state fields.
- **Two billing paths** — Stripe-billed (webhook-driven transitions) and manual-billed (scheduled-task / human-triggered transitions). Both share the same state enum.
- **Transition owner map** naming which spec owns each transition (Quote Builder for accept/quote, Branded Invoicing for manual-billed generate/send, Stripe webhook for active→past_due).
- **Cross-cutting `activity_log` rule** — every state transition emits an `activity_log` row with kind `subscription_state_changed` carrying `{from, to, reason, actor}` in the metadata.

Three reference patches applied to enforce the §12 contract at the spec level:

1. **`docs/specs/quote-builder.md` §7.1** — extended the `invoice.payment_failed` bullet to transition `active_current → past_due` per FOUNDATIONS.md §12. Added retainer parity note (retainer clients follow the same `past_due` lockout rule as SaaS subscribers — no platform access until payment recovers).
2. **`docs/specs/branded-invoicing.md` §3.1 step 11** — appended a chain-stop clause: the self-perpetuating `manual_invoice_generate` → `manual_invoice_send` → `manual_invoice_generate` chain stops the moment `deals.subscription_state` leaves `active_current`. Prevents the worker from continuing to bill a client whose retainer has paused/ended/been cancelled.
3. **`docs/specs/client-management.md` §2.3** — Pause subscription quick action now gated on the full canonical-state predicate: `deals.subscription_state = 'active_current'` AND `today < deals.committed_until_date` AND `deals.pause_used_this_commitment = false` AND SaaS-only (retainers cannot pause per §12). Previous 7-value state enum reference replaced with "canonical 13-value enum per FOUNDATIONS.md §12".

---

## Key decisions & rationale

- **`won_outcome` extended not restructured.** The three-value enum (`retainer`/`saas`/`project`) is sufficient at v1.0. No need for a separate `deal_type` column or sub-type nesting. Project work settles one-off; retainer and SaaS are both subscription-backed but billed differently (manual vs Stripe). Source of truth is `deals.subscription_state` for retainer/SaaS; `'project'` outcomes skip the state machine.
- **Settings registry lives in `docs/`, not in code.** Source of truth is the Markdown table; the Phase 5 seed migration is generated FROM the table. Keeps human-readable defaults in-repo-visible without a DB dump.
- **State machine owner is FOUNDATIONS.md, not any single feature spec.** The machine cuts across Quote Builder, Branded Invoicing, Client Management, Finance Dashboard, Daily Cockpit — no single spec can own it without creating an import inversion. FOUNDATIONS.md §12 is the only place with import authority over primitives.
- **Retainer parity with SaaS on `past_due` lockout.** A retainer client whose manual invoice goes unpaid and crosses the overdue threshold enters the same lockout as a SaaS subscriber whose card fails. Justification: retainer clients pay for platform access (portal, deliverables, chat); unpaid access would be an integrity break with no business upside.

---

## What the next session should know

**The next autonomously-runnable batch is Batch C (steps 8, 9, 12, 13, 15).** Step 11 is a stop point — Andy must walk the end-to-end Intro Funnel → Trial Shoot → Six-Week Plan → Retainer Conversion flow with Claude. This is product-judgement (narrative cohesion, not technical contract).

**Authoritative source-of-truth files now in place:**

- `SCOPE.md` — 20 v1.0 features (locked 2026-04-13).
- `FOUNDATIONS.md` — includes §12 canonical subscription state machine, §11.6 LLM model registry, §11.2 send-gate with classification enum.
- `PATCHES_OWED.md` — 4 Phase-5-gated FOUNDATIONS patches + 3 new Phase 4/5 coordination items + 2 remaining spec-retroactive items (voice & delight treatment audit, etc.) + all applied rows archived.
- `docs/settings-registry.md` — 56 keys at v1.0 seed.
- `lib/ai/prompts/INDEX.md` — 47 prompts across 14 specs.
- `docs/specs/sales-pipeline.md` — authoritative `activity_log.kind` (166 values) + `deals.won_outcome` (3 values).
- `docs/specs/quote-builder.md` — authoritative `scheduled_tasks.task_type` (31 values).

**Nothing blocks Phase 4 Build Plan sequencing** once Batch C and stops 11/14/16 resolve.

**Context budget for Batch C:** read the three Batch-X handoffs + PATCHES_OWED + the two enum-owning specs before starting; compress between each sub-step; read each spec at-most-once per sub-step.
