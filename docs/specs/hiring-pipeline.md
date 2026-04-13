# Hiring Pipeline

**Status:** Locked 2026-04-13 (Phase 3 spec session).
**Consumers / cross-spec contracts:** Sales Pipeline (primitive reuse), Lead Generation (outreach primitive reuse + reply intelligence), Content Engine (claimable internal backlog for trial tasks), Task Manager (bench availability contract), Finance Dashboard (contractor payments expense-line), Daily Cockpit (waiting items + health banners), Unified Inbox (reply routing), Branded Invoicing (contractor-invoice-received pattern — read-side), Setup Wizards (Role Brief authoring + contractor onboarding), Cost & Usage Observatory (external call attribution), Surprise & Delight (sprinkle claims).

---

## 1. Purpose

Hiring Pipeline is SuperBad's **contractor bench-build surface**. It takes a desired role ("we need a food-beverage colourist"), runs automated + manual discovery against reference portfolios Andy admires, invites candidates to apply via a gated outreach system, screens applications, runs paid trial tasks drawn from SuperBad's own internal content backlog, and graduates successful candidates to an active Bench from which Task Manager can route work.

The primary operational mode for v1 is **bench-build** (rostered contractors rotated through work), not seat-fill (one-time hire). **Forward-compat for full-time employees is baked into the data model** — every stage, schema field, and portal route accommodates FT employees via `engagement_type` + `full_time_only` flags, without requiring a rewrite when FT mode unlocks in v1.1+.

---

## 2. User story

Andy opens a new Role Brief for "Video Editor — food / beverage / branded documentary feel, $80–120/hr, 10–20 hrs/wk, Melbourne or remote." He drops 5 reference reels he'd hire tomorrow. Lite ingests the reels via multi-platform handlers (Vimeo, Behance, Instagram, personal sites) and synthesises a brief of extracted style signals that becomes the perpetual LLM context for that role.

Over the following weeks, Lite runs a weekly LLM+search discovery agent that reads the Brief and finds candidates across the open web. Public inbound applicants also land in the pipeline via a 5-field apply form. Andy reviews candidates at `Sourced`/`Applied` in a kanban; the system auto-drafts personalised invites at ≥0.85 confidence. Screened candidates receive an LLM-generated bespoke trial task drawn from SuperBad's own content backlog, paid at the candidate's expected rate (capped at Andy's approval). Successful trials graduate to Bench with a first-login wizard covering ABN + contractor agreement + bank details + rate confirmation. Task Manager draws from the Bench via `getAvailableBenchMembers()` to assign real work.

Archives at any stage capture a voice-tight reason + optional reflection, which loops back into the Role Brief as negative reference signal — tightening the Brief's taste over time.

---

## 3. Cross-spec contracts (Phase 3.5 self-containment pass)

This section is authoritative for every contract this spec consumes or exposes. Phase 5 build sessions reading this spec alone have everything they need.

### 3.1 Primitives consumed

- **`scheduled_tasks` table + worker** (canonical owner: Quote Builder). Hiring Pipeline adds task types: `hiring_discovery_run`, `hiring_invite_send`, `hiring_invite_followup_check`, `hiring_trial_task_overdue`, `hiring_bench_pause_ending`, `hiring_role_brief_regenerate`.
- **`activity_log`** (canonical owner: Sales Pipeline). Hiring Pipeline adds `.kind` values: `candidate_sourced`, `candidate_invited`, `candidate_applied`, `candidate_followup_received`, `candidate_screened`, `candidate_trial_sent`, `candidate_trial_delivered`, `candidate_trial_reviewed`, `candidate_benched`, `candidate_paused`, `candidate_resumed`, `candidate_archived`, `candidate_unarchived`, `role_brief_opened`, `role_brief_regenerated`, `role_brief_closed`.
- **`external_call_log`** (canonical owner: Cost & Usage Observatory). Every LLM / Apify / Vimeo API / Behance API / Resend / web-search call logs `{job, actor_type: 'internal', actor_id: null, units, estimated_cost_aud, timestamp}`. Job names listed in §15.
- **`settings` table + `settings.get()`** (canonical owner: Foundations / Phase 4 foundation session). All thresholds in §18.
- **`sendEmail()` gate** (canonical owner: Foundations §11.2). New `classification` values added: `hiring_invite`, `hiring_followup_question`, `hiring_trial_send`, `hiring_archive_notice`, `hiring_contractor_auth`, `hiring_bench_assignment`.
- **Reply intelligence primitive** (canonical owner: Lead Generation). Hiring Pipeline registers a new classifier dispatch table (positive → apply-link + Invited; objection → Andy queue; question → Andy queue; negative → auto-archive with `they_withdrew`; auto-responder → ignore).
- **LLM model registry** (canonical owner: Foundations patch, see `PATCHES_OWED.md`). Hiring Pipeline registers jobs: `hiring-brief-synthesize` (Sonnet), `hiring-discovery-agent` (Sonnet with web-search tool), `hiring-candidate-score` (Haiku), `hiring-invite-draft` (Sonnet), `hiring-followup-question-draft` (Haiku), `hiring-trial-task-author` (Sonnet), `hiring-portfolio-ingest-vision` (Sonnet vision), `hiring-archive-reflection-ingest` (Haiku).
- **`logActivity()`** (canonical owner: Foundations §11.1). Every candidate mutation routes through it.
- **`formatTimestamp()`** (canonical owner: Foundations §11.3).
- **`generateInVoice()`** (drift-checked LLM copy, canonical owner: Surprise & Delight). Used for browser tab titles + apply form confirmation page.
- **`WizardDefinition` shell** (canonical owner: Setup Wizards). Used for Role Brief authoring + contractor onboarding — two wizard definitions owned here.
- **`getHealthBanners()` union** (canonical owner: Daily Cockpit). Hiring Pipeline contributes kinds: `hiring_discovery_cost_anomaly`, `hiring_trial_task_overdue`, `hiring_bench_empty_for_open_role`.
- **`getWaitingItems()` contract** (canonical owner: Daily Cockpit). Hiring Pipeline contributes waiting-item source kinds (§14).
- **`maybeRegenerateBrief()` pattern** (canonical owner: Daily Cockpit). Role Brief regeneration on material events reuses the pattern.
- **Puppeteer PDF renderer** (canonical owner: Branded Invoicing). Used to generate the contractor agreement PDF at onboarding.

### 3.2 Primitives exposed

- **`getAvailableBenchMembers(role: string, hours_needed: number, options?: { excludeIds?: string[] })` → `BenchMember[]`** — consumed by Task Manager for work assignment. Returns bench members filtered by `bench_status = 'active'`, `paused_until` null-or-past, matching role, with remaining weekly capacity ≥ `hours_needed`. Sorted by recency-of-last-assignment (oldest first, i.e. rotation-friendly).
- **`openBenchCount(role: string)` → `{ active: number, paused: number, total: number }`** — consumed by Daily Cockpit for the `hiring_bench_empty_for_open_role` banner + dashboard tiles.
- **`ingestPortfolioUrl(url: string)` → `PortfolioSignal`** — reused internally by Quick-Add, Role Brief authoring, bench profile enrichment. Handles Vimeo / Behance / Dribbble / Are.na / YouTube / personal sites / IG (via Apify with graceful fallback) / LinkedIn (metadata only) / TikTok. Returns typed `PortfolioSignal { url, platform, thumbnails: string[], bio: string, work_samples: WorkSample[], extracted_tags: string[], confidence: number, fetched_at }`.
- **Apply form submission handler** — consumed by Unified Inbox (inbound reply matching), Daily Cockpit (waiting items).
- **`claimInternalContentItem(contentId, candidateId, budgetCapAud)` → `TrialTaskClaim`** — consumed internally (Trial task stage); requires Content Engine to expose the claimable-backlog surface (patch owed).

### 3.3 Cross-spec patches owed

Listed in `PATCHES_OWED.md` at session lock. Summary:
1. Content Engine — expose claimable-internal-backlog surface with atomic claim/release mechanism.
2. Finance Dashboard — nullable `candidate_id` FK on expense-line schema; "Contractor payments" rollup view.
3. Task Manager — bench availability becomes a filter/signal when assigning tasks; document the `getAvailableBenchMembers()` contract as the source.
4. Daily Cockpit — new waiting-item kinds + new health banner kinds.
5. `activity_log.kind` enum — 16 new values (listed §3.1).
6. Foundations `sendEmail()` — 6 new `classification` values (listed §3.1).
7. Cost & Usage Observatory model registry — 8 new LLM job names (listed §3.1).
8. Unified Inbox — reply-classification dispatch table registration for `hiring_invite` thread replies.
9. Lead Generation — formalise the reply-intelligence primitive as externally-consumable (shared-primitive registry).

---

## 4. Stage model

### 4.1 The 7 stages

| # | Stage | What it means | Typical entry | Typical exit |
|---|---|---|---|---|
| 1 | **Sourced** | Candidate identified via discovery (LLM+search, Vimeo, Behance, Quick-Add) or referral. No contact yet. | Auto from discovery agent OR Apply form's "recommend someone" field OR manual Quick-Add. | Andy drafts/approves invite → `Invited`. |
| 2 | **Invited** | Outbound invite email sent. Awaiting application. | Auto from `sendEmail()` send event on a `hiring_invite` classification. | Apply form submission matched → `Applied`. Positive inbound reply → `Applied` (with auto-link to form). |
| 3 | **Applied** | Full application received via apply form (inbound applicants land here directly; invited candidates land here post-invite). LLM-generated follow-up question fires on submission. | Apply form submission. | Andy reviews application + portfolio + follow-up reply → `Screened`. |
| 4 | **Screened** | Andy has reviewed and decided to proceed. Trial task will be authored + sent. | Manual drag (or confirm button on the candidate card). | Trial task sent → `Trial`. |
| 5 | **Trial** | Paid trial task sent, drawn from SuperBad's internal content backlog. Awaiting delivery. | Auto from trial task send. | Delivery received + Andy reviews → decision: `Bench` or `Archived`. |
| 6 | **Bench** | Active bench member. Available for Task Manager assignments. Compliance gate (ABN + contractor agreement signed + bank details + rate confirmed) must pass before entry. **Terminal positive.** | Manual drag with `DestructiveConfirmModal` — requires typing candidate name + confirms compliance gate passed. | Manual drag to `Archived` (with reason). |
| 7 | **Archived** | Terminal negative. Covers rejection from any upstream stage AND departure from Bench. | Manual drag → Archive modal. | Manual drag out (un-archive restores to `stage_before_archive`; reversible). |

**`Paused` is a sub-state of Bench, not its own stage.** Represented as a chip on the Bench card with `paused_until` date. A bench member whose `paused_until` is future is filtered out of `getAvailableBenchMembers()` but remains visible in the Bench column. Auto-resumes (chip drops, candidate returns to availability) when `paused_until` passes. The resume fires a `scheduled_tasks` entry `hiring_bench_pause_ending` two days before `paused_until` so Andy can confirm or extend.

### 4.2 Stage registry with forward-compat flag

```ts
export const HIRING_STAGES = [
  { key: 'sourced',   order: 1, full_time_only: false, label: 'Sourced' },
  { key: 'invited',   order: 2, full_time_only: false, label: 'Invited' },
  { key: 'applied',   order: 3, full_time_only: false, label: 'Applied' },
  { key: 'screened',  order: 4, full_time_only: false, label: 'Screened' },
  { key: 'trial',     order: 5, full_time_only: false, label: 'Trial' },
  { key: 'bench',     order: 6, full_time_only: false, label: 'Bench' },
  { key: 'archived',  order: 7, full_time_only: false, label: 'Archived' },
  // v1.1+ FT employee stages inserted here without reordering:
  // { key: 'offer',      order: 5.5, full_time_only: true, label: 'Offer' },
  // { key: 'probation',  order: 6.5, full_time_only: true, label: 'Probation' },
] as const
```

### 4.3 Auto-transitions

| Trigger | From | To | Source |
|---|---|---|---|
| Discovery agent surfaces candidate | (new) | `Sourced` | LLM+search scheduled task OR Vimeo RSS / Behance feed / apply-form referral field |
| Outbound invite email sent | `Sourced` | `Invited` | Resend send event on `hiring_invite` classification |
| Apply form submitted + matched by email to existing candidate | `Invited` / `Sourced` | `Applied` | Apply form handler |
| Apply form submitted with no existing candidate match | (new) | `Applied` | Apply form handler |
| Trial task sent | `Screened` | `Trial` | Trial task send action |
| Trial task delivery received + Andy confirms "delivered" | `Trial` | (stays in Trial, `delivered_at` set) | Delivery URL submission or explicit confirm |

**Backward auto-transitions: none.** Bounces and negative reply classifications do not roll candidates back — they archive (with `disposition_direction = 'they_withdrew'`) instead. Avoids the dual-path complexity of Sales Pipeline's §3.4 bounce-rollback.

### 4.4 Manual transitions

- **Always allowed** — Andy can drag any card to any stage.
- **Bench entry protected** by `DestructiveConfirmModal` requiring typing the candidate name + compliance gate must pass (`abn` non-null, `agreement_signed_at` non-null, `bank_details` non-null, `hourly_rate_aud` non-null). If any compliance field is missing, the drag is blocked with a "complete onboarding first" message that deep-links to the contractor's `/bench/onboard` wizard.
- **Dragging out of Bench** triggers the Archive modal with Bench-specific reason list.
- **Un-archive** is a simple drag-out with no confirm — reversible by design.
- **Skip-Trial → Bench.** Button on `Screened` cards, wrapped in `DestructiveConfirmModal` (type candidate name + pick skip reason from closed list: *Prior relationship / Strong referral / Immediate need*). Logs `activity_log.kind = 'trial_skipped'` with reason.

### 4.5 Archive flow (reason taxonomy)

Per-stage closed-list reasons + optional reflection field + `disposition_direction`. See §11 for full UX; taxonomy reproduced here for self-containment:

- **Sourced** → *Not my taste* / *Role already filled* / *Already in the system* / *Other*
- **Invited / Applied** → *Rate's off* / *Not available when we need them* / *Portfolio didn't land* / *Wrong city* / *Role already filled* / *They went quiet* / *Other*
- **Screened / Trial** → *Trial didn't land* / *Didn't deliver* / *Communication fell apart* / *Rate moved on us* / *Other*
- **Bench (leaving)** → *Not producing anymore* / *Booked up elsewhere* / *Compliance issue* / *Clean parting* / *They moved on* / *Other*

`Other` requires ≥10 chars free-text. Reflection (≤500 chars, optional) auto-ingests into the Role Brief as negative-reference signal via `hiring-archive-reflection-ingest`.

---

## 5. Sourcing + automated discovery

### 5.1 Entry paths

Candidates enter `Sourced` via four paths, tracked by `candidates.source`:

1. `auto_discovered` — the weekly LLM+search discovery agent surfaced them.
2. `applied` — an inbound applicant landed in `Applied` directly (no `Sourced` stage).
3. `sourced` — Andy's manual Quick-Add (paste a URL into the admin surface).
4. `referred` — an apply-form "recommend someone?" field, OR a bench member's referral.

### 5.2 Automated discovery — hybrid mechanism

**Two scheduled paths, converging into `Sourced`:**

**Path A — platform scrapers + feeds (daily, lightweight):**
- Vimeo Staff Picks RSS — polled once/day, new picks cross-referenced against open Role Briefs' extracted tags, matching picks auto-ingested.
- Behance Gallery public JSON endpoints — same cadence.
- Apply-form "recommend someone" referrals — ingested real-time on form submission.
- Adapter shape in `lib/hiring/discovery/sources/*.ts`, one file per source, typed `DiscoverySource` interface with `fetch()` + `matchAgainstBrief()` + `confidence`. Individual kill switches (`hiring.discovery.vimeo_enabled`, etc.).

**Path B — LLM+search agent (weekly per Role, gated by cost):**
- Scheduled task `hiring_discovery_run` fires weekly (default) per open Role Brief.
- Agent receives the Role Brief context + open-web search tool access (SerpAPI or equivalent).
- Agent runs 5–10 targeted searches derived from the Brief's extracted tags + role name + location preference. Example queries: *"melbourne food colourist portfolio freelance"*, *"documentary video editor australia branded content"*, *"food photography stylist behance melbourne"*.
- Agent visits top results, calls `ingestPortfolioUrl()` on each, scores against the Brief via `hiring-candidate-score` (Haiku).
- Top N (default 5) ingested as `Sourced` cards.
- Cost cap per run: `hiring.discovery.llm_max_cost_aud_per_run` (default $1.00). Exceeding the cap halts mid-run and emits a `hiring_discovery_cost_anomaly` health banner.
- Budget observed per Role Brief — cheap Roles don't fund expensive ones.

**On-demand Instagram ingestion:**
- Andy drops an IG handle / URL into Quick-Add.
- Adapter calls Apify IG profile scraper (or equivalent paid service) for the 6–12 most recent grid posts + bio.
- Vision-capable LLM reads the grid → `PortfolioSignal`.
- Graceful fallback on scraper failure: wizard step asks Andy to paste 3–5 specific post URLs OR upload screenshots. Both fallbacks preserve the flow.

### 5.3 Quick-Add primitive

One field on the admin hiring surface. Andy pastes any URL, presses Enter. Lite:
1. Resolves platform via URL pattern match.
2. Calls `ingestPortfolioUrl(url)`.
3. If open Role Briefs exist, scores against all via `hiring-candidate-score`; attaches to the highest-scoring Role. If no Roles open, lands as `Sourced` unattached + flags for Andy to assign.
4. Drafts the invite via `hiring-invite-draft`; presents the card with the draft visible.
5. Andy confirms → moves to `Invited` (or edits/sends manually via "Send now").

---

## 6. Role Briefs — reference-driven authoring

### 6.1 Shape

A Role Brief is a **perpetual LLM context** for a hiring role. Every downstream call in this spec's stack reads it: discovery-agent search-query generation, candidate scoring, invite drafting, application review summary, trial task authoring, archive reflection absorption. Same primitive pattern as Brand DNA.

### 6.2 Authoring wizard

`WizardDefinition` for `hiring-role-brief` — 4 steps, dedicated-route render:

1. **Role basics.** Role name (free-text), engagement_type (contractor / employee), rate band (min + max AUD), availability target (hours/week), location preference (city + remote-ok boolean), open_count (how many bench slots you want to fill).
2. **Reference portfolios.** Andy drops 3–5 URLs (multi-platform — Vimeo / IG / Behance / personal sites / etc.). Wizard calls `ingestPortfolioUrl()` on each with live status; graceful fallbacks prompt for alternatives if scraping fails.
3. **LLM synthesis.** `hiring-brief-synthesize` (Sonnet) reads the ingested `PortfolioSignal`s + Role basics + any existing Role Brief history, generates a structured brief: style_summary (prose), extracted_tags (array), style_do_list (array), style_avoid_list (array — starts empty, populated by archive reflections over time), discovery_search_hints (array — seeds Path B search queries). Andy sees the output, can override any field inline.
4. **Confirm + open.** Review + open the Role. Status flips `status = 'open'`; triggers the first `hiring_discovery_run` within 60 minutes.

### 6.3 Regeneration

Role Brief regenerates via `maybeRegenerateBrief(subject: 'role_brief', roleBriefId)` (reusing Daily Cockpit's material-event pattern) on:
- New bench entry for that Role (positive reference added).
- New archive with reflection for that Role (negative reference added).
- Andy manually triggers "Retune" from the Brief detail page.
- Cumulative archive count hits a threshold (`hiring.brief.archive_retune_threshold`, default 10).

### 6.4 Brief data model

See §12.

---

## 7. Apply form + LLM follow-up

### 7.1 Form

Public route: `/apply` (marketing-site-adjacent; shows SuperBad branding, not "Lite"). Fields:

1. Name (required).
2. Email (required, validated).
3. Role applying for (required, dropdown from `role_briefs where status = 'open' and full_time_only matches flow` + "Other / general interest").
4. Portfolio URLs (1–3, at least one required).
5. Location — city only, free-text.
6. Rate expectation — band dropdown (sliced at $20/hr or equivalent), populated from settings `hiring.apply.rate_bands`.
7. Availability — hours/week (dropdown: <5, 5–10, 10–20, 20+) + earliest start date.
8. "Recommend someone?" — optional free-text; parsed on submit for URL-like tokens that seed referral cards.

No "why SuperBad?" free-text field in v1 — the LLM follow-up question replaces it with a tailored one.

### 7.2 LLM follow-up question

Within ~2 minutes of submission, a Resend email (`classification: 'hiring_followup_question'`) fires to the applicant. Generated by `hiring-followup-question-draft` (Haiku) — reads the applicant's portfolio + the Role Brief + the applicant's form answers, produces one tailored question (e.g. *"Your reel is food-heavy — comfortable with product-shot work too?"*). Reply-to address threads into Unified Inbox; thread-id matched back to the candidate on reply.

- Questions must pass brand-voice drift check (Foundations §11.5).
- Reply lands in the candidate record at `followup_reply`.
- If no reply after `hiring.apply.followup_reply_wait_days` (default 7), the candidate remains in `Applied` with a `followup_status = 'no_reply'` flag — Andy can still screen on portfolio alone, or archive with *They went quiet*.
- Scheduled task `hiring_invite_followup_check` re-checks at the wait window and sets the flag.

### 7.3 Forward-compat

- FT applicant dropdown option shows an "employment type preference" sub-field (contractor / employee / either).
- FT follow-up questions use a different prompt template (career trajectory-oriented rather than portfolio-stretch).

---

## 8. Invite send gate (confidence-gated auto-send)

### 8.1 Drafting

On Andy's "invite this candidate" action (or auto on high-score discovery candidates per `hiring.discovery.auto_invite_score_threshold`):
1. `hiring-invite-draft` (Sonnet) reads the candidate's `PortfolioSignal` + Role Brief + Andy's voice guide, drafts the invite email (subject + body).
2. LLM emits `{draft, confidence: 0..1}` tuple. Confidence reflects the LLM's own self-rating on fit + draft quality.
3. Draft passes brand-voice drift check (Foundations §11.5).

### 8.2 Send gate

- **If `confidence ≥ hiring.invite.auto_send_confidence_threshold` (default 0.85) AND `hiring.invite.auto_send_enabled = true` (default true) AND per-role daily cap not breached AND per-candidate throttle passes → auto-send.**
- Otherwise → Drafts queue. Andy reviews, edits if needed, clicks "Send".
- "Send now" override always available on any Draft (bypasses confidence gate with explicit Andy intent).
- 60-second resend-undo on all auto-sends (inherits Unified Inbox primitive).

### 8.3 Rate limits + throttles

- `hiring.invite.daily_send_cap_per_role` — default 3. Ceiling on per-Role invites/day.
- `hiring.invite.per_candidate_throttle_days` — default 90. Same candidate + same role can't receive a second invite within this window.
- `hiring.invite.cross_role_max_per_candidate_per_year` — default 3. Cross-role anti-spam cap.
- Breached caps queue the draft (no error) — surfaces in Drafts with a chip explaining the hold.

### 8.4 Reply intelligence (reuses Lead Gen primitive)

Dispatch table for `hiring_invite` classification replies:

| Classification | Action |
|---|---|
| `positive` | Send apply-form link via reply-in-thread; card remains `Invited` (awaits form submit). |
| `objection` (rate, timing, scope) | Route to Andy queue in Unified Inbox with highlighted objection. |
| `question` | Route to Andy queue. |
| `negative` ("not interested") | Auto-archive with `disposition_direction = 'they_withdrew'`, reason *They declined*. |
| `auto_responder` | Ignore (no state change). |

### 8.5 Forward-compat

- FT Role Briefs use `hiring.invite.ft_auto_send_confidence_threshold` (default 0.95, higher bar).
- FT invite prompt template emphasises role + compensation clarity over portfolio-matching.

---

## 9. Trial task — real work from SuperBad's internal backlog

### 9.1 Authoring

On `Screened → Trial` transition Andy clicks "Author trial task":
1. Lite calls Content Engine's claimable-backlog surface (patch owed) — returns list of internal content items flagged safe for contractor trial (non-client-facing; typically upcoming social posts, blog drafts, trial-shoot teaser edits, internal brand content).
2. `hiring-trial-task-author` (Sonnet) reads candidate's `PortfolioSignal` + Role Brief + available backlog items; proposes a specific item + rationale ("this candidate's strength is handheld documentary; this food-beverage social edit stretches them toward tighter narrative pacing while staying in their lane").
3. Proposal also includes: budget cap in AUD (default: candidate's rate × 4 hours, overridable), deadline (default +7 days), deliverable format.
4. Andy confirms / edits / overrides. On confirm, Lite:
   - Locks the content item via `claimInternalContentItem(contentId, candidateId, budgetCapAud)` (atomic — Content Engine enforces single-claim).
   - Generates a trial brief email (Puppeteer PDF attachment or inline HTML — deferred to build session).
   - Sends via `sendEmail(classification: 'hiring_trial_send')` to the candidate.
   - Inserts a `trial_tasks` row; stage moves to `Trial`.

### 9.2 Delivery + review

- Candidate replies with a delivery URL (Dropbox / Google Drive / WeTransfer) OR uploads directly via the contractor portal (if already onboarded as part of the bench pre-gate).
- Andy reviews on a Trial Task Review surface; captures:
  - Andy notes (free-text, ≤1000 chars).
  - Rating (1–5).
  - Disposition: `shipped` (delivery goes live on SuperBad's channels; Content Engine re-flags the item as consumed) / `archived` (delivery was mediocre, candidate archives) / `redelivered` (revision requested; deadline extends).
- Rating + disposition feed back into the Role Brief via `hiring-archive-reflection-ingest` at the next regeneration cycle.

### 9.3 Timeouts

- `hiring.trial.delivery_deadline_days` — default 7.
- `hiring.trial.delivery_grace_days` — default 3 (auto-reminder fires on `deadline + grace`, then auto-archive with reason *Didn't deliver* at `deadline + grace + 2`).
- `hiring.trial.overdue_banner_kind = 'hiring_trial_task_overdue'` — Daily Cockpit health banner.

### 9.4 Forward-compat

FT `Probation` replaces `Trial`: same data model row, different semantics. `trial_tasks.engagement_type` gate controls time-bounded (probation period) vs deliverable-bounded (trial) behaviour.

---

## 10. Contractor portal (`/bench`)

Minimal authenticated surface for bench members. Distinct from the client portal — separate route tree, separate shell. Per-candidate scoped (no cross-contractor visibility).

### 10.1 Auth

Magic-link via `sendEmail(classification: 'hiring_contractor_auth')`. Session tied to `candidate.id` where `stage = 'Bench'`. Archived candidates get auto-logged-out + login blocked.

### 10.2 First-login wizard

`WizardDefinition` for `hiring-contractor-onboarding`. Blocks all other portal surfaces until complete. Steps:

1. Confirm ABN + legal name. Lookup against ABR (ABN register, public API) for validation; confirm the legal name matches the candidate's display name or note the difference.
2. Review + sign contractor agreement. Puppeteer-rendered PDF auto-filled with candidate + SuperBad + rate + agreement terms (template authored in content mini-session; solicitor-reviewed before launch). Signature = typed-name confirmation + checkbox acknowledgement. `agreement_signed_at` set on commit. Not DocuSign (v1.1 unlock).
3. Bank details for payments. BSB + account number + account name; stored in `candidates.bank_details` (encrypted at rest; viewable by admin only).
4. Confirm default rate + weekly capacity. Defaults pre-filled from application. Editable.

Completion sets `candidates.onboarding_completed_at`; Bench-gate can now pass.

### 10.3 Portal views

- **`/bench`** — dashboard. Shows active assignments, next upcoming deadline, pause status chip, one ambient line (sprinkle).
- **`/bench/assignments`** — list of tasks (active + recent completed). Each row: task title, deadline, budget ceiling, deliverable-submit button.
- **`/bench/invoices`** — contractor submits invoices (PDF upload + amount + reference). Visible to Finance Dashboard via `candidate_id` FK.
- **`/bench/availability`** — pause/resume toggle, `paused_until` date picker, weekly capacity slider, "not taking new work" note.
- **`/bench/profile`** — rate edit (subject to Andy approval — changes queue as pending), portfolio URL edits (auto re-ingested), ABN / legal name / bank details (edits require Andy confirmation).

### 10.4 Forward-compat

`/bench` (contractor) and `/team` (FT employee) split on login based on `engagement_type`. Same primitive shell, different onboarding wizard + portal views tuned to employment semantics.

---

## 11. Archive flow — full UX

### 11.1 Archive modal

Triggered by dragging a card to `Archived` column or clicking the card's "Archive" action.

Fields:
- **Reason** (required): closed list per §4.5, filtered by the candidate's current stage.
- **Free-text** (required if reason = *Other*, min 10 chars): describes the Other reason.
- **Reflection** (optional, ≤500 chars): *"What would you tell the Role Brief about this?"* Feeds back via `hiring-archive-reflection-ingest` at next Brief regeneration.
- **Disposition direction** (required): *we_archived* / *they_withdrew* / *mutual* — defaults per-reason (e.g. *They went quiet* defaults to `they_withdrew`; *Portfolio didn't land* defaults to `we_archived`).

Submitting the modal:
- Inserts a `candidate_archives` row (timeline — never overwrites previous archive events if the candidate has been un-archived before).
- Updates `candidates.stage = 'archived'`, `stage_before_archive = previous_stage`, `archived_at = now`.
- Logs `activity_log.kind = 'candidate_archived'`.
- Fires `hiring-archive-reflection-ingest` (queued, not blocking) to update the Role Brief's `style_avoid_list`.

### 11.2 Un-archive

Drag card out of Archived. No confirm modal — reversible by design. Restores stage from `stage_before_archive`. Logs `activity_log.kind = 'candidate_unarchived'`. The `candidate_archives` row is preserved; `un_archived_at` set.

### 11.3 Voice

Archive modal header in admin-roommate voice (content mini-session tunes). Reason labels are already drafted in §4.5 in SuperBad voice. Other drift-proof moments: the Drafts empty state ("no invites waiting on you"), the Bench empty state ("nobody on the bench — bet the Role Brief's been open a while"), and the Sourced empty state ("scouting kicks in weekly. patience.").

---

## 12. Data model (Drizzle schema, described)

### 12.1 New tables

```ts
// candidates — every person in the Hiring Pipeline, at any stage
export const candidates = sqliteTable('candidates', {
  id: text('id').primaryKey(),
  role_brief_id: text('role_brief_id').references(() => role_briefs.id),
  stage: text('stage', { enum: ['sourced','invited','applied','screened','trial','bench','archived'] }).notNull(),
  stage_before_archive: text('stage_before_archive'),
  source: text('source', { enum: ['auto_discovered','applied','sourced','referred'] }).notNull(),
  discovery_source: text('discovery_source'),  // 'vimeo' | 'behance' | 'llm_search' | 'apify_ig' | 'apply_form' | 'quick_add' | ...
  engagement_type: text('engagement_type', { enum: ['contractor','employee'] }).notNull().default('contractor'),

  // application / contact
  name: text('name').notNull(),
  email: text('email'),
  location_city: text('location_city'),
  portfolio_urls: text('portfolio_urls', { mode: 'json' }),  // string[]
  rate_expectation_aud: integer('rate_expectation_aud'),
  rate_expectation_unit: text('rate_expectation_unit', { enum: ['per_hour','per_day','per_project'] }),
  availability_hours_per_week: integer('availability_hours_per_week'),
  available_from: integer('available_from', { mode: 'timestamp' }),
  application_followup_question: text('application_followup_question'),
  application_followup_reply: text('application_followup_reply'),
  followup_status: text('followup_status', { enum: ['pending','replied','no_reply'] }),

  // portfolio signal (cached from ingestPortfolioUrl)
  portfolio_signal: text('portfolio_signal', { mode: 'json' }),
  portfolio_signal_fetched_at: integer('portfolio_signal_fetched_at', { mode: 'timestamp' }),
  brief_match_score: real('brief_match_score'),  // 0..1 against role_brief

  // bench state
  bench_status: text('bench_status', { enum: ['active','paused'] }),
  paused_until: integer('paused_until', { mode: 'timestamp' }),
  hourly_rate_aud: integer('hourly_rate_aud'),
  weekly_capacity_hours: integer('weekly_capacity_hours'),
  onboarding_completed_at: integer('onboarding_completed_at', { mode: 'timestamp' }),

  // compliance (contractor variant)
  abn: text('abn'),
  legal_name: text('legal_name'),
  agreement_signed_at: integer('agreement_signed_at', { mode: 'timestamp' }),
  bank_details: text('bank_details'),  // encrypted JSON blob { bsb, account_number, account_name }

  // archive
  archived_at: integer('archived_at', { mode: 'timestamp' }),

  first_seen_at: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// role_briefs — the perpetual LLM context per hiring role
export const role_briefs = sqliteTable('role_briefs', {
  id: text('id').primaryKey(),
  role_name: text('role_name').notNull(),
  engagement_type: text('engagement_type', { enum: ['contractor','employee'] }).notNull().default('contractor'),
  status: text('status', { enum: ['draft','open','paused','filled'] }).notNull().default('draft'),

  // basics
  rate_min_aud: integer('rate_min_aud'),
  rate_max_aud: integer('rate_max_aud'),
  rate_unit: text('rate_unit', { enum: ['per_hour','per_day','per_project'] }),
  target_hours_per_week: integer('target_hours_per_week'),
  location_pref_city: text('location_pref_city'),
  remote_ok: integer('remote_ok', { mode: 'boolean' }).notNull().default(true),
  open_count: integer('open_count').notNull().default(1),

  // references + synthesis
  reference_urls: text('reference_urls', { mode: 'json' }),  // string[]
  reference_signals: text('reference_signals', { mode: 'json' }),  // PortfolioSignal[]
  style_summary: text('style_summary'),
  extracted_tags: text('extracted_tags', { mode: 'json' }),  // string[]
  style_do_list: text('style_do_list', { mode: 'json' }),  // string[]
  style_avoid_list: text('style_avoid_list', { mode: 'json' }),  // string[], grows from archive reflections
  discovery_search_hints: text('discovery_search_hints', { mode: 'json' }),  // string[]
  andy_overrides: text('andy_overrides'),  // prose, appended to synthesis

  last_regenerated_at: integer('last_regenerated_at', { mode: 'timestamp' }),
  last_discovery_run_at: integer('last_discovery_run_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// trial_tasks — one row per trial task sent
export const trial_tasks = sqliteTable('trial_tasks', {
  id: text('id').primaryKey(),
  candidate_id: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  role_brief_id: text('role_brief_id').notNull().references(() => role_briefs.id),
  internal_content_ref: text('internal_content_ref'),  // Content Engine FK
  task_description: text('task_description').notNull(),
  budget_cap_aud: integer('budget_cap_aud').notNull(),
  rate_per_unit_aud: integer('rate_per_unit_aud').notNull(),
  rate_unit: text('rate_unit', { enum: ['per_hour','per_day','per_project'] }).notNull(),
  sent_at: integer('sent_at', { mode: 'timestamp' }).notNull(),
  due_at: integer('due_at', { mode: 'timestamp' }).notNull(),
  delivered_at: integer('delivered_at', { mode: 'timestamp' }),
  delivery_url_or_asset: text('delivery_url_or_asset'),
  andy_review_notes: text('andy_review_notes'),
  rating: integer('rating'),  // 1..5
  disposition: text('disposition', { enum: ['pending','shipped','archived','redelivered'] }).notNull().default('pending'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// candidate_archives — timeline of archive events
export const candidate_archives = sqliteTable('candidate_archives', {
  id: text('id').primaryKey(),
  candidate_id: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  archived_at: integer('archived_at', { mode: 'timestamp' }).notNull(),
  stage_when_archived: text('stage_when_archived').notNull(),
  reason_code: text('reason_code').notNull(),
  reason_free_text: text('reason_free_text'),
  reflection_text: text('reflection_text'),
  disposition_direction: text('disposition_direction', { enum: ['we_archived','they_withdrew','mutual'] }).notNull(),
  un_archived_at: integer('un_archived_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
})
```

### 12.2 Validation rules (enforced in `validateCandidateWrite()` before every write)

- `stage = 'bench'` requires `abn`, `agreement_signed_at`, `bank_details`, `hourly_rate_aud` non-null.
- `stage = 'bench'` requires `weekly_capacity_hours` non-null and > 0.
- `paused_until` cannot be set unless `bench_status = 'paused'`.
- `bench_status` cannot be set unless `stage = 'bench'`.
- `candidate_archives` row required on every `stage = 'archived'` transition.
- `engagement_type` immutable after first write.
- Email uniqueness per Role Brief (same email can apply to multiple Roles; cannot double-apply to the same Role).

### 12.3 Activity feed query patterns

Reuse Sales Pipeline §4.3 patterns. New `activity_log.kind` values listed §3.1.

---

## 13. UI — admin kanban + bench portal

### 13.1 Admin kanban (`/lite/hiring`)

- Reuses `KanbanBoard` primitive from Sales Pipeline. 7 columns.
- Column filter: Role Brief (multi-select chip). Stages are the same; Role filter slices the cards.
- Card content (two-tier like Sales Pipeline):
  - Tier 1 (always visible): name, role, portfolio platform icons, rate band, location, match-score chip, source chip.
  - Tier 2 (expanded): portfolio preview thumbnails, brief_match_score detail, application follow-up question + reply, last activity, compliance gate status (for Screened+), trial task summary (for Trial/Bench).
- Drag interactions: same discipline as Sales Pipeline — manual drag always allowed; Bench entry + Skip-Trial wrapped in `DestructiveConfirmModal`.
- Stale-deal treatment: cards in `Sourced` > 14d, `Invited` > 10d, `Applied` > 7d, `Screened` > 5d, `Trial` > `due_at + 3d` surface with a stale-chip.

### 13.2 Role Brief surface (`/lite/hiring/briefs`)

- List of Roles (open / paused / filled / draft).
- Detail page: Role Brief content, reference signal thumbnails, extracted tags, style lists, discovery run history, match rate, bench entries attributed, archive patterns summary.
- "Retune" button → regenerates via `maybeRegenerateBrief('role_brief', id)`.
- "New Role" → opens `hiring-role-brief` wizard.

### 13.3 Trial task review surface (`/lite/hiring/trials/:id`)

- Dedicated-route full-bleed review. Delivery asset + task description side-by-side. Notes field + rating + disposition buttons (*Ship it / Archive / Request revision*).

### 13.4 Drafts queue (`/lite/hiring/drafts`)

- Low-confidence invite drafts awaiting Andy's review. Each row: candidate, role, confidence chip, draft preview, Send / Edit / Archive actions.

### 13.5 Bench portal (`/bench/*`) — see §10.

### 13.6 Quick-Add component

Persistent URL input bar on `/lite/hiring`. Paste URL + Enter. See §5.3.

---

## 14. Daily Cockpit integration

### 14.1 Waiting items (`getWaitingItems()` contract)

New source kinds this spec emits:

- `candidate_application_unreviewed` — count of candidates in `Applied` for > 24h without Andy reviewing.
- `candidate_followup_reply_received` — count of `Applied` candidates with `followup_status = 'replied'` awaiting screen.
- `trial_task_delivered_unreviewed` — count of `Trial` candidates with `delivered_at` set but no `andy_review_notes`.
- `trial_task_overdue` — count of `Trial` candidates past `due_at`.
- `draft_invites_awaiting` — count in Drafts queue.
- `bench_pause_ending_soon` — count of bench members with `paused_until` ≤ 2d away.
- `role_brief_discovery_stale` — open Roles with `last_discovery_run_at` > 10d ago.

Rail chip labels (per-spec `source_spec = 'hiring-pipeline'` convention):
- *"{name} applied — {role} — {days}d waiting"*
- *"{name} trial delivered — {role}"*
- *"{name}'s trial overdue — {days}d"*

### 14.2 Health banners (`getHealthBanners()` contract)

- `hiring_discovery_cost_anomaly` — discovery run cost breached cap, or cumulative weekly cost > `hiring.discovery.weekly_cost_warn_threshold_aud`.
- `hiring_trial_task_overdue` — any trial past `due_at + grace`.
- `hiring_bench_empty_for_open_role` — open Role Brief with `openBenchCount(role).active = 0` for > 21 days.

### 14.3 Morning brief narrative

Brief generator reads hiring-side signals via the cockpit briefing contract: newly applied (yesterday), trials delivered overnight, bench capacity summary (sum of `weekly_capacity_hours` across active bench), discovery results from last run. Feeds into narrative as normal.

---

## 15. Integrations + external calls

Every external call logs to `external_call_log` with `actor_type: 'internal'`, `actor_id: null`.

| Call | Job name | Provider | Trigger | Typical cost/call |
|---|---|---|---|---|
| Portfolio ingest (web fetch) | `hiring-portfolio-ingest-generic` | Puppeteer (self) | Quick-Add, Role Brief ref, discovery | Compute-only |
| Portfolio ingest (IG) | `hiring-portfolio-ingest-ig` | Apify IG scraper | Quick-Add IG URL, Role Brief IG ref | ~$0.02 |
| Portfolio ingest (Vimeo) | `hiring-portfolio-ingest-vimeo` | Vimeo public API | Discovery, Quick-Add | Free |
| Portfolio ingest (Behance) | `hiring-portfolio-ingest-behance` | Behance public JSON | Discovery, Quick-Add | Free |
| Portfolio vision LLM | `hiring-portfolio-ingest-vision` | Sonnet vision | On every portfolio ingest | ~$0.01 |
| Brief synthesis | `hiring-brief-synthesize` | Sonnet | Wizard step 3, regenerate | ~$0.05 |
| Discovery agent | `hiring-discovery-agent` | Sonnet + SerpAPI | Weekly per Role Brief | ~$0.20–$1.00 per run |
| Candidate score | `hiring-candidate-score` | Haiku | On every ingested candidate | ~$0.002 |
| Invite draft | `hiring-invite-draft` | Sonnet | On "invite" action | ~$0.02 |
| Follow-up question draft | `hiring-followup-question-draft` | Haiku | On apply submission | ~$0.003 |
| Trial task author | `hiring-trial-task-author` | Sonnet | On Screened → Trial | ~$0.04 |
| Archive reflection ingest | `hiring-archive-reflection-ingest` | Haiku | On archive event with reflection | ~$0.003 |
| Outbound send | `sendEmail` classification variants | Resend | Invite, follow-up, trial, archive-notice, auth, assignment | ~$0.0004 |

ABN validation reads the public ABR API (no auth, no cost) during contractor onboarding.

---

## 16. Sounds + motion

All inherit. No new slots requested at this spec's lock. See §3.1 of `docs/specs/surprise-and-delight.md` and the design-system-baseline motion / sound registries for the source-of-truth.

- Kanban drag/drop, card advance → inherit Sales Pipeline.
- Role Brief synthesis reveal → inherit Brand DNA cinematic reveal Tier-2.
- Wizard completion (Role Brief + contractor onboarding) → inherit Setup Wizards `motion:wizard_completion` Tier-2.
- Bench entry moment → inherit `sound:quote_accepted` (positive commitment).
- Invite sent / trial sent → inherit `sound:outbound_sent`.
- Success toasts / error states → inherit Tier-1.

---

## 17. Voice & delight treatment

### 17.1 Voice asymmetry

- **Admin (`/lite/hiring/*`)** — admin-roommate voice. Observational, can push cheeky.
- **Public apply form + confirmation + invite emails + LLM follow-up** — bartender voice. Attentive, dry, never pushy, never pitches.
- **Contractor portal (`/bench/*`) + onboarding + assignment emails** — bartender voice with slight opted-in latitude.

### 17.2 Claimed sprinkles (from `docs/candidates/sprinkle-bank.md`)

1. **Browser tab titles** (§2 of the bank) — extends the multi-spec pattern to `/lite/hiring/*` (admin) and `/bench/*` (contractor). Admin rotations stratified by state (`"SuperBad Lite — 3 applications waiting"` / `"SuperBad Lite — 2 trials overdue"` / `"SuperBad Lite — bench is quiet"` / `"SuperBad Lite — scouting today"`). Contractor rotations (`"SuperBad — your assignments"` / `"SuperBad — you're clear"` / `"SuperBad — 1 invoice pending"`). Content mini-session authors.
2. **Apply form confirmation page voice** (§3 of the bank — previously unclaimed). Post-submit grace moment, bartender voice, no pitch. Content mini-session authors.

### 17.3 Ambient surface categories used

All inherit — empty states, loading copy, success toasts, error pages, morning brief narrative, placeholder text. **No new ambient surface categories proposed.**

### 17.4 No new eggs proposed

Hiring Pipeline may seed ideas for the S&D admin-egg expansion brainstorm (e.g., an observation when archive-clustering detects a rate-off Role). Not locked here.

### 17.5 Content mini-session owed

Medium-sized. Produces:
- Browser tab title rotation pools (admin + contractor, 8–12 lines each, stratified by state).
- Apply form confirmation page copy.
- LLM follow-up question prompt calibration against 5+ synthetic candidate portfolios.
- Invite email template calibration against 5+ synthetic candidates.
- Archive reason labels per stage (SuperBad voice — drafts in §4.5 finalised).
- Welcome-to-Bench email first line + contractor onboarding wizard step copy.
- Empty state copy across 6+ surfaces.
- Loading state copy across 3+ phases.
- Trial task delivery review voice.
- Role Brief authoring wizard step copy.
- Trial task brief email / PDF voice.

Must run before Phase 5 Hiring Pipeline build sessions A + C + D (Role Brief authoring / admin kanban / contractor portal respectively).

---

## 18. Settings keys (`docs/settings-registry.md` additions)

| Key | Type | Default | Consumer | Human description |
|---|---|---|---|---|
| `hiring.discovery.llm_run_cadence` | enum | `weekly` | Discovery agent | weekly / fortnightly / monthly / off (per Role Brief) |
| `hiring.discovery.llm_max_cost_aud_per_run` | number | `1.00` | Discovery agent | Hard cap per Role per run |
| `hiring.discovery.llm_candidates_per_run` | number | `5` | Discovery agent | Top-N candidates surfaced |
| `hiring.discovery.weekly_cost_warn_threshold_aud` | number | `10.00` | Health banner | Weekly spend warning |
| `hiring.discovery.vimeo_enabled` | boolean | `true` | Vimeo adapter | Individual kill switch |
| `hiring.discovery.behance_enabled` | boolean | `true` | Behance adapter | Individual kill switch |
| `hiring.discovery.ig_on_demand_enabled` | boolean | `true` | Apify IG adapter | Individual kill switch |
| `hiring.discovery.llm_agent_enabled` | boolean | `true` | Discovery agent | Master kill switch |
| `hiring.discovery.sourced_review_window_days` | number | `5` | Sourced-column staleness | Nudge window |
| `hiring.discovery.auto_invite_score_threshold` | number | `0.90` | Auto-invite gate | Auto-draft invites on discovery candidates scoring ≥ this |
| `hiring.invite.auto_send_enabled` | boolean | `true` | Invite send gate | Master kill switch |
| `hiring.invite.auto_send_confidence_threshold` | number | `0.85` | Invite send gate | Confidence above which auto-send fires |
| `hiring.invite.ft_auto_send_confidence_threshold` | number | `0.95` | Invite send gate | FT bar, higher |
| `hiring.invite.daily_send_cap_per_role` | number | `3` | Invite rate limit | Per-Role daily ceiling |
| `hiring.invite.per_candidate_throttle_days` | number | `90` | Invite throttle | Same candidate + Role window |
| `hiring.invite.cross_role_max_per_candidate_per_year` | number | `3` | Invite throttle | Cross-Role anti-spam |
| `hiring.apply.followup_reply_wait_days` | number | `7` | Follow-up timeout | Wait before flagging no-reply |
| `hiring.apply.rate_bands` | json | [bands array] | Apply form | Closed-list rate band options |
| `hiring.trial.delivery_deadline_days` | number | `7` | Trial deadline | Default due-date offset |
| `hiring.trial.delivery_grace_days` | number | `3` | Trial overdue | Grace before auto-archive |
| `hiring.trial.default_budget_cap_hours` | number | `4` | Trial authoring | Default budget = rate × hours |
| `hiring.brief.archive_retune_threshold` | number | `10` | Brief regen trigger | Cumulative archives before auto-retune |
| `hiring.brief.regen_on_bench_entry` | boolean | `true` | Brief regen trigger | Re-run on new bench |
| `hiring.bench.pause_ending_warn_days` | number | `2` | Bench notification | Warn ahead of resume |
| `hiring.staleness.sourced_days` | number | `14` | Card stale chip | Sourced staleness threshold |
| `hiring.staleness.invited_days` | number | `10` | Card stale chip | Invited staleness threshold |
| `hiring.staleness.applied_days` | number | `7` | Card stale chip | Applied staleness threshold |
| `hiring.staleness.screened_days` | number | `5` | Card stale chip | Screened staleness threshold |

All 28 keys to be seeded into the `settings` table at Phase 4's foundation session from `docs/settings-registry.md`.

---

## 19. Success criteria

1. **Time to first Bench fill per Role Brief.** Median days from Role opened → first Bench entry. Target TBD (Phase 6 calibration).
2. **Trial-to-Bench conversion rate.** Share of Trial stage candidates reaching Bench. Low rate = screening upstream is soft.
3. **Bench member retention at 90 days.** Share of Bench entries still `bench_status = 'active'` 90 days post-entry.

Metrics surfaced on the Cost & Usage Observatory and a dedicated "Hiring health" strip on the Role Brief detail page. Targets TBD until Phase 6 shadow.

---

## 20. Out of scope (explicit non-goals)

- **Pull-mode task board.** Bench members don't self-assign; Task Manager routes work.
- **Peer visibility between bench members.** Per-contractor isolation is a hard rule.
- **DocuSign / e-signature providers.** v1 uses typed-name + checkbox acknowledgement only.
- **Stripe Connect contractor onboarding.** v1 pays contractors via bank transfer from bank_details on invoices; no auto-pay.
- **Scraping Instagram beyond Apify.** Unofficial scrapers are a non-goal. Graceful fallback to paste URLs / upload screenshots.
- **Multi-round interview scheduling UI.** Bench mode doesn't need it. v1.1+ for FT mode.
- **Full rate-negotiation flow.** Applicants quote a rate on the form; Andy accepts or archives on rate mismatch. No back-and-forth negotiation UI.
- **ATO-compliant payslip generation.** Contractors invoice SuperBad; no employee payroll. v1.1+ for FT mode.
- **Full Role Brief version history UI.** v1 keeps last-regenerated-at only. Version browsing is v1.1.
- **Full autonomous headhunt-to-hire.** Andy remains the human in the loop at Screened → Trial and Trial → Bench transitions.
- **Multi-role-per-candidate unified view.** If a candidate applies to two Roles, they get two `candidates` rows. v1.1+ may unify.

---

## 21. Open questions deferred to Phase 5

- **Rate-change approval flow.** When a bench contractor edits their rate in the portal, it queues as pending — exact UX of the admin approval queue is build-session territory.
- **Exact Apify scraper vendor lock.** Several providers offer IG scrapers; final vendor pick (cost, reliability, ToS) is build-session research.
- **Contractor agreement template content.** Content mini-session drafts; solicitor reviews before launch. Legal copy is not this spec's deliverable.
- **Trial task deliverable storage.** If Dropbox / Drive / WeTransfer URLs are the norm, Lite stores URLs; if Andy wants native upload, a storage primitive (S3 or similar) is needed — defer to build-session discovery.
- **Weekly capacity granularity.** Hours/week is the v1 unit; whether finer granularity (day-of-week availability) matters for Task Manager's routing is a handoff tune during Phase 5.
- **Referral attribution.** If a Bench member refers a new candidate, does the original member get anything? v1 says no; defer the attribution mechanic to Phase 6 if it becomes operationally relevant.

---

## 22. Risks (carried into Phase 5)

- **IG scraping fragility.** Apify / equivalent providers are the weakest link. Mitigation: graceful fallback + kill switch.
- **LLM+search discovery agent quality.** If the agent returns low-quality candidates consistently, the whole automated-discovery premise degrades. Mitigation: per-run cost cap + weekly diagnosis via Observatory + Andy can disable per-Role or globally via settings.
- **Content Engine claimable-backlog dependency.** Trial task stage can't function without Content Engine's claimable surface. If Content Engine ships late in Phase 5, Hiring Pipeline's Trial stage ships without the bespoke-task auto-authoring and Andy authors trial tasks manually. Not a hard blocker but a real degradation.
- **Sender reputation contagion.** If Hiring Pipeline invites generate spam complaints, it damages Lead Gen's outreach reputation on the same domain. Mitigation: reply-intelligence auto-archive on negative replies + hard daily cap + per-candidate throttle + dry brand voice (not salesy).
- **Brand voice drift on LLM-drafted invites + follow-ups.** High volume of LLM-drafted outbound is the classic drift scenario. Mitigation: Foundations §11.5 drift check on every send + content mini-session calibrates prompts before Phase 5 build.
- **Compliance drift.** Australian sham-contracting rules require genuine contractor relationships (right to refuse work, own equipment, multiple clients). The spec's design supports this (pause toggle, no exclusivity, rate-set-by-contractor) but the agreement template must be solicitor-reviewed.
- **Candidate portal security.** Magic-link auth + per-candidate scoping is the first defence; every query must filter on `session.candidate_id = row.candidate_id`. Phase 3.5 permission matrix lists the surface.

---

## 23. Glossary

- **Role Brief** — perpetual LLM context per open hiring role; lives in `role_briefs`.
- **Bench** — active roster of contractors available for Task Manager work assignment.
- **Pause** — bench sub-state; contractor temporarily unavailable but retained.
- **Candidate** — any person in the pipeline at any stage; row in `candidates`.
- **Trial task** — paid sample work drawn from SuperBad's internal content backlog; row in `trial_tasks`.
- **Discovery agent** — scheduled LLM+search task that finds candidates from the open web against a Role Brief.
- **Portfolio Signal** — typed output of `ingestPortfolioUrl()`; cached style + work-sample extraction.
- **Confidence-gated auto-send** — LLM-drafted invite emails auto-send above threshold, Drafts queue below.
- **Compliance gate** — check on ABN + contractor agreement + bank details + rate before Bench entry.
- **Archive reflection** — optional free-text on archive; absorbs into the Role Brief's style_avoid_list.

---

## 24. Build-time disciplines (specific to Hiring Pipeline)

- Every `sendEmail()` call uses one of the 6 registered `classification` values. Never `classification: 'transactional'` or missing.
- Every external call logs to `external_call_log` with the correct job name + actor attribution. Grep for missing instrumentation at end of every session.
- `validateCandidateWrite()` runs before every candidate mutation; no direct inserts.
- Role Brief regenerations are queued through `maybeRegenerateBrief()`, never fired synchronously from user interactions.
- LLM prompts live in `lib/ai/prompts/hiring/*.ts` (Phase 3.5 step 3b); spec prose references them by path, never inlines prompt text.
- Settings values read via `settings.get(key)`, never literals in feature code.
- `ingestPortfolioUrl()` must cover the graceful-fallback path for each platform adapter; a failing Apify call should not surface as a 500 to the user.
- No cross-contractor data leakage: every `/bench/*` handler asserts `session.candidate_id === row.candidate_id` OR admin session.
