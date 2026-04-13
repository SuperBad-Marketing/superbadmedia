# Phase 3 — Hiring Pipeline spec handoff

**Session:** `phase-3-hiring-pipeline`
**Date locked:** 2026-04-13
**Spec file:** `docs/specs/hiring-pipeline.md` (~680 lines, 24 sections)
**Phase 3 status after lock:** 19 of 20 specs locked; 1 remaining (Six-Week Plan Generator).

---

## What was specced

SuperBad's own **contractor bench-build surface**, reframed at Q1 from "permanent-staff hiring" to "contractors sooner rather than later" per Andy's answer. Forward-compat for full-time employees is baked into the data model (every stage, schema field, and portal route carries `engagement_type` + `full_time_only` flags) so v1.1+ can unlock FT mode without a rewrite.

Core mechanic: Andy writes a **Role Brief** with reference portfolios he'd hire tomorrow; Lite ingests them via multi-platform adapters and synthesises a perpetual LLM context for the role. A weekly LLM+web-search discovery agent finds candidates across the open web; a public apply form ingests inbound applicants. Candidates flow through a 7-stage kanban: **Sourced → Invited → Applied → Screened → Trial → Bench → Archived**. Trial tasks draw from SuperBad's own internal content backlog (requires Content Engine patch), paid at the candidate's expected rate. Bench members are gated behind a compliance wizard (ABN + contractor agreement + bank details + rate) and become available to Task Manager via `getAvailableBenchMembers()`.

---

## Key decisions (Q1–Q15 locks)

- **Q1** — Scope = contractor bench-build as primary; FT-employee forward-compat mandatory.
- **Q2** — Forward-compat mechanism = `engagement_type` + `full_time_only` stage flag; no rewrite at FT unlock.
- **Q3** — Sourcing = automated headhunting + invitation-to-apply (mirrors Lead Generation prospects flow).
- **Q4** — 7 stages (not 5, not 9). Terminal positive = Bench; terminal negative = Archived; Paused is a sub-state of Bench.
- **Q5** — (Technical — locked D silently per `feedback_technical_decisions_claude_calls.md`) No backward auto-transitions; bounces and negatives archive rather than roll back.
- **Q6** — Portfolio ingestion includes Instagram (via Apify with graceful fallback) plus Vimeo / Behance / Dribbble / Are.na / YouTube / personal sites / LinkedIn (metadata only) / TikTok.
- **Q7** — Apply form = 5 fields (name, email, 1–5 portfolio URLs, single freeform "why this role", "recommend someone" referral slot).
- **Q8** — Trial task source = SuperBad's own internal content backlog (Content Engine patch owed for atomic claim/release).
- **Q9** — Data model = fully separate `candidates` table (not a polymorphic overlay on prospects/deals); shared primitives stay cross-cutting.
- **Q10** — (Technical — locked B silently) Contractor portal = dedicated `/bench` routes under the main app with session-scoped `engagement_type` guard; no separate subdomain.
- **Q11** — Discovery sources = LLM + web-search agent + honest platform adapter subset (Vimeo RSS / Behance public feed / Apify IG on-demand); cost caps enforced via `settings.get('hiring.discovery_weekly_cost_cap_aud')`.
- **Q12** — Archive reasons = per-stage closed-list taxonomy + optional ≤500-char reflection + `disposition_direction` (`we_passed` / `they_withdrew` / `clean_parting`). Reflections auto-ingest into Role Brief as negative reference signal.
- **Q13** — Invite send gate = confidence-gated auto-send at ≥0.85 with human-in-the-loop review queue for everything below.
- **Q14** — Voice & delight sprinkle claims:
  - **§2 browser tab titles** (extends existing multi-spec claim): `"SuperBad Lite — 3 candidates waiting"` / `"SuperBad Lite — bench is quiet"` / `"SuperBad Lite — trial's overdue"`.
  - **§3 apply form confirmation page voice** (previously unclaimed): dry received-message + ambient "we'll read this ourselves" line. Public-facing surface so uses "SuperBad", not "SuperBad Lite".
- **Q15** — Success = first 3 bench members delivering real client work within 90 days of Hiring Pipeline's Phase 5 build.

---

## Shared-primitive registrations (Phase 3.5 registry inputs)

Hiring Pipeline **consumes**:
- `scheduled_tasks` (Quote Builder) — 6 new task types
- `activity_log` (Sales Pipeline) — 16 new `.kind` values
- `external_call_log` (Cost & Usage Observatory) — actor_type `internal` for every hiring call
- `settings` table (Foundations) — 28 keys under `hiring.*`
- `sendEmail()` gate (Foundations §11.2) — 6 new `classification` values
- Reply intelligence primitive (Lead Generation) — new dispatch table for `hiring_invite`
- LLM model registry (Foundations patch) — 8 new jobs
- `logActivity()`, `formatTimestamp()`, `generateInVoice()` (Foundations)
- `WizardDefinition` shell (Setup Wizards) — 2 wizards owned here (`hiring-role-brief`, `hiring-contractor-onboarding`)
- `getHealthBanners()` union (Daily Cockpit) — 3 new kinds
- `getWaitingItems()` contract (Daily Cockpit) — 7 new source kinds
- `maybeRegenerateBrief()` pattern (Daily Cockpit) — for Role Brief material-event regen
- Puppeteer PDF renderer (Branded Invoicing) — contractor agreement PDF

Hiring Pipeline **exposes** (canonical owner here; register in Phase 3.5 shared-primitive registry):
- `getAvailableBenchMembers(role, hours_needed, options?) → BenchMember[]` — consumed by Task Manager.
- `openBenchCount(role) → { active, paused, total }` — consumed by Daily Cockpit.
- `ingestPortfolioUrl(url) → PortfolioSignal` — reused internally; typed return value documented in §3.2.
- Apply form submission handler — consumed by Unified Inbox (reply matching) and Daily Cockpit (waiting items).
- `claimInternalContentItem(contentId, candidateId, budgetCapAud) → TrialTaskClaim` — internal consumer; requires Content Engine patch.

---

## Cross-spec patches raised

9 new rows added to `PATCHES_OWED.md` (see spec §3.3 for canonical summary). Highlights:

1. **Content Engine** — expose claimable-internal-backlog surface with atomic claim/release.
2. **Finance Dashboard** — nullable `candidate_id` FK on expense-line schema + "Contractor payments" rollup view.
3. **Task Manager** — document `getAvailableBenchMembers()` consumer contract.
4. **Daily Cockpit** — 3 new `getHealthBanners()` kinds + 7 new `getWaitingItems()` source kinds.
5. **activity_log.kind** — 16 new values.
6. **Foundations `sendEmail()`** — 6 new `classification` values.
7. **Cost & Usage Observatory** — 8 new LLM job names in the model registry.
8. **Unified Inbox** — reply-classification dispatch table for `hiring_invite` replies.
9. **Lead Generation** — formalise reply-intelligence primitive as externally-consumable (this is its second consumer).

---

## Deferred to Phase 5 / later

- **Hiring Pipeline content-authoring mini-session** (small-medium) — dedicated creative session with `superbad-brand-voice` + `superbad-business-context` skills loaded. Produces: Role Brief voice-tight synthesis prompt calibration; 5–8 invite-draft starter voice directions (stratified by role family — video / design / copy / ops); follow-up question prompt voice tuning; trial-task authoring prompt calibration against 3 internal backlog scenarios; apply form confirmation page copy (sprinkle claim); browser tab title rotation pool; archive-notice email templates per `disposition_direction`; contractor agreement PDF opening line; Bench onboarding wizard copy; empty-state copy across 5 surfaces. Must run before Phase 5 Hiring Pipeline build sessions B + C.
- **`full_time_only` stage gates** — the 2 FT stages commented out in the stage registry get uncommented + tested at FT unlock (v1.1+). No work needed now.
- **Seat-fill mode UI** — current UI assumes bench-build rotation. When FT mode unlocks, a `/lite/hiring/roles/:id` surface will need a "one open seat" variant. Flagged in spec §20 Out of scope.
- **Bench rate renegotiation flow** — mentioned in `getWaitingItems()` source kinds but UX deferred to Phase 5.

---

## Open risks

- **Discovery agent cost drift** — LLM + web-search runs weekly per open role. Budget cap is a hard stop but the banner threshold (`hiring.discovery_cost_anomaly_multiple`) is an eyeballed guess. Observatory's anomaly primitive will catch it post-launch; pre-launch risk is minor.
- **Apify IG adapter flakiness** — Instagram is the most brittle platform adapter. Spec specifies graceful fallback (skip IG, continue ingesting other platforms, flag the gap on the signal report). Acceptable.
- **Trial-task source conflict** — two candidates could theoretically be offered the same content item if `claimInternalContentItem()` isn't atomic. Content Engine patch must land before Phase 5 Hiring Pipeline build session that builds the Trial stage. Flagged in both specs.
- **Sham-contracting compliance** — Bench entry gate enforces ABN + agreement + bank details + rate. Not legal advice; solicitor review of contractor agreement PDF template needed before first real bench member is added. Added to Phase 5 readiness checklist.

---

## Next session

**Six-Week Plan Generator spec** — the last Phase 3 spec. Closes Phase 3 and unlocks the 3.5 review gate. Scope per memory `project_six_week_plan_is_real_deliverable.md`: autonomous generation of a credible, take-the-plan-and-run retainer alternative following the trial shoot. Must resolve: generation entry point (after trial shoot completes? buyer-opt-in step? gated?), plan artefact shape (PDF? web deliverable? both?), perpetual LLM context (Brand DNA + Client Context Engine — both already locked), reusability (does the same generator support retainer onboarding or is it bespoke to the 6-week moment?), delivery channel, revision flow, archive into client record.
