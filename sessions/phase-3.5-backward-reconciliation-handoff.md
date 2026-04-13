# Phase 3.5 Step 1 — Backward Reconciliation Handoff

**Session id:** `phase-3.5-backward-reconciliation`
**Date:** 2026-04-13
**Scope:** Phase 3.5 step 1 only (lock-date-filtered diff of every locked spec against post-lock memories + handoffs + `PATCHES_OWED.md`, then apply the patches).
**Steps 2–16 deferred** to subsequent Phase 3.5 sessions.

## What was done

- Read `START_HERE.md` § Phase 3.5 and `SESSION_TRACKER.md` 🧭 Next Action.
- Applied every row carried from `PATCHES_OWED.md` (~30 rows). Full list moved to the Applied section of that file.
- Delegated the lock-date-filtered diff across 21 specs × 49 memories to an Explore sub-agent to protect primary context. Sub-agent returned 5 new candidates beyond the carried rows. All 5 applied this session.
- Rewrote `PATCHES_OWED.md` — Applied section now lists every row satisfied by this session; Pending section holds only the 4 rows that are themselves later Phase 3.5 steps (2a, 7a, voice-discipline audit completion, prompt extraction 3b) plus the `docs/content/` re-homing task (step 3a).

## Patches applied this session

### From `PATCHES_OWED.md`

- **FOUNDATIONS.md** §11.6 LLM model registry + external-call observability; §11.2 `sendEmail()` classification parameter + 6 hiring classification values.
- **Setup Wizards wiring** — `WizardDefinition` references added to saas-subscription-billing §1.1, content-engine §1.1, unified-inbox §13, onboarding-and-segmentation §1.1, brand-dna-assessment §1.1, intro-funnel (in §0 patch block), setup-wizards §5.2 (`finance-tax-rates` step).
- **Daily Cockpit** — `getHealthBanners()` contract gains `in_flight_admin_wizard` + 3 finance + 3 hiring kinds; attention-rail gains `wizard_completion` chip + 7 hiring source kinds.
- **Cost & Usage Observatory** — Registered jobs inventory consolidated: `admin-setup-assistant`, `finance-narrative`, `stripe-balance-read`, `stripe-balance-transactions-read`, 8 hiring jobs.
- **Branded Invoicing** — §4.1 `?filter=overdue` query param; §4.5 `renderBundle()` multi-document export.
- **activity_log.kind enum** — 10 Observatory + 8 Finance + 16 Hiring values consolidated in sales-pipeline.md.
- **Content Engine** §14.0 claimable-internal-backlog surface (`listClaimableContentItems` / `claimInternalContentItem` / `releaseContentItem`) + new `content_items` columns.
- **Finance Dashboard** §4.2 `expense_line.candidate_id` FK + "Contractor payments" rollup.
- **Task Manager** — `getAvailableBenchMembers(role, hours_needed, options?)` cross-spec consumer contract documented.
- **Lead Generation** §13.0 reply-intelligence primitive formalised (`classifyReply` + `registerReplyDispatch`).
- **Unified Inbox** §11.2 `hiring_invite` reply dispatch table (5 intents).
- **Intro Funnel** §0 retroactive patches P1–P4 + §2 lock 14 amendment (trial shoot facts 60-min on-site + 6-week plan included + 48h cancellation; 60-day portal lifecycle; questionnaire extension; portal migration to Client Management shell).
- **Client Management** §10.0 pre-retainer rendering mode (pre-retainer / retainer / archived table + settings keys `portal.chat_calls_per_day_pre_retainer` / `_retainer`); §10.3 bartender gains Six-Week Plan awareness.

### Sub-agent-surfaced candidates (all applied)

- **sales-pipeline.md** §11A Voice & Delight treatment — empty states, toasts, Tier 2 budget = 0, S&D admin-roommate hooks, sprinkle bank claims.
- **client-context-engine.md** §14.5 Motion spec — summary tile crossfade, action items stagger, draft drawer slide-from-right (Tier 2), unsent-draft breathing pulse, reduced-motion parity.
- **design-system-baseline.md** Discipline #12 "Voice is part of the design system" — central copy banks pointer (`lib/copy/empty-states.ts` / `toasts.ts` / `sprinkles.ts`), cross-ref to `surprise-and-delight.md` as audit authority, motion-universal rule pointer.
- **quote-builder.md** §4.1 motion spec — pane mount, 300ms-debounced section-key-scoped preview crossfade, mobile/desktop frame width spring, drift indicator halo, reduced-motion parity.
- **surprise-and-delight.md** Data-access audit checklist — JSDoc schema (`@egg`, `@register`, `@reads`, `@does_not_read`, `@cross_client_inference`, `@evidence_fields`), 4 invariants (register boundary / no cross-client inference / evidence fields match / public eggs read only cookie+session), Phase 4 AUTONOMY_PROTOCOL CI check hook.

## Key decisions

- **Scoped this session to step 1 only.** Per context-safety conventions, Phase 3.5 is the heaviest-read phase in the project — splitting into per-step sessions protects against truncation. Steps 2–16 are enumerated in the updated Next Action block.
- **"Broad backward reconciliation" row satisfied** by the Explore sub-agent pass plus the 5 candidate applications. Marked Applied.
- **Voice-discipline audit row kept Pending** — Sales Pipeline was the only locked spec that got a fresh Voice & Delight section this session; other pre-convention specs still need to be audited individually. Left as a bounded follow-up inside Phase 3.5 step 2 or a named mop-up.
- **No new memories written.** Everything was in-spec structural work; no new Andy-voiced rules emerged.

## What the next session should know

- **Start at Phase 3.5 step 2 — cross-spec flag reconciliation.** Read the updated Next Action block; step 2a (inline cross-spec contract detail from handoffs into specs) is the heaviest sub-step.
- **`PATCHES_OWED.md` Pending section is small** — only 4 structural rows + the `docs/content/` re-homing. These are not "owed patches" in the original sense; they are named later-Phase-3.5-step tasks. Do not re-apply.
- **Settings keys introduced this session that will need registry entries at step 7a:** `portal.non_converter_archive_days`, `portal.chat_calls_per_day_pre_retainer`, `portal.chat_calls_per_day_retainer`, `finance.gst_rate`, `finance.income_tax_rate`. Flag these in the settings key registry sub-pass.
- **New cross-spec contracts introduced:** `getAvailableBenchMembers()` (owner: Hiring Pipeline), `listClaimableContentItems` / `claimInternalContentItem` / `releaseContentItem` (owner: Content Engine), `classifyReply` / `registerReplyDispatch` (owner: Lead Generation), `renderBundle()` multi-doc export (owner: Branded Invoicing). Step 2 should confirm these are referenced symmetrically in both owner and consumer specs.
- **activity_log.kind enum** now consolidated in sales-pipeline.md as the authoritative location — 34 new values across finance / hiring / observatory. Cockpit and other consumers reference via the enum. Step 6 (data-model sanity) should confirm there are no stray enum drifts in other specs.
- **Six-Week Plan awareness in Client Management portal chat** — bartender now has a limited safe action for "explain a week/task". Step 2a should inline the surface contract from six-week-plan-generator.md into client-management.md so Phase 5 doesn't need both loaded.
- **Data-access audit JSDoc schema** (surprise-and-delight.md) is now the template for any new egg; Phase 4 AUTONOMY_PROTOCOL will compile these JSDoc blocks into a CI check. Note in Phase 4 planning.

## Files touched

- `FOUNDATIONS.md`
- `docs/specs/saas-subscription-billing.md`, `docs/specs/content-engine.md`, `docs/specs/onboarding-and-segmentation.md`, `docs/specs/brand-dna-assessment.md`, `docs/specs/intro-funnel.md`, `docs/specs/unified-inbox.md`, `docs/specs/daily-cockpit.md`, `docs/specs/cost-usage-observatory.md`, `docs/specs/branded-invoicing.md`, `docs/specs/setup-wizards.md`, `docs/specs/sales-pipeline.md`, `docs/specs/finance-dashboard.md`, `docs/specs/task-manager.md`, `docs/specs/lead-generation.md`, `docs/specs/client-management.md`, `docs/specs/client-context-engine.md`, `docs/specs/design-system-baseline.md`, `docs/specs/quote-builder.md`, `docs/specs/surprise-and-delight.md`
- `PATCHES_OWED.md`
- `SESSION_TRACKER.md` (Next Action block only)
- `sessions/phase-3.5-backward-reconciliation-handoff.md` (this file)
