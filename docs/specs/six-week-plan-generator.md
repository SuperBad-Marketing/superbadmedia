# Six-Week Plan Generator — Feature Spec

**Phase 3 output. Locked 2026-04-13. 16 questions resolved.**

> **Prompt files:** `lib/ai/prompts/six-week-plan-generator.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The Six-Week Plan Generator produces the bespoke week-by-week marketing plan that ships as a trial-shoot deliverable alongside the Pixieset gallery (video + photos). The plan is framed as "what we'd implement if we were your agency" — broken down so the prospect can self-run it if they don't convert to retainer, or take it forward as the live retainer strategy if they do. Generation is autonomous (two-stage Opus) but Andy reviews and approves before any prospect sees the plan.

This is the last Phase 3 spec. It closes the trial-shoot deliverables loop and wires the plan as a first-class data object that migrates into Client Context on retainer conversion.

**Trial-shoot deliverables (full picture, per the $297 offer):**
1. 1× short-form video
2. 10 edited photographs
3. 6-week marketing strategy *(this spec)*
4. 60 days of client portal access

---

## 1. The 16 locks (quick-reference table)

| # | Decision | Lock |
|---|----------|------|
| 1 | Generation entry point | Andy pastes Pixieset URL + captures shoot-day notes in the Trial Shoot panel → two-stage generator fires → Andy review queue → approve → plan releases to the prospect's portal |
| 2 | Artefact shape | Web page inside the Client Management portal (plan is one section of the shared portal shell) + PDF takeaway rendered via Puppeteer from the same source |
| 3 | Week skeleton | Each week has: theme, 2–3 content angles tied to shoot assets + Brand DNA (if taken), channel mix, concrete tasks (content + infrastructure + conversion), one success signal, one fallback ("if engagement is weak, try this instead") |
| 4 | Plan scope | Full marketing plan — email list setup, lead magnet → upsell flows, Meta ads where relevant, local SEO, retargeting, review flywheel, partnerships, plus content. Infrastructure tasks sit alongside content tasks |
| 5 | Current-state input | Hybrid: enrichment pre-fills what it can; Andy confirms/corrects in the shoot-day notes structured form; LLM flags low-confidence assumptions in Andy's review surface |
| 6 | Generator architecture | Two-stage: (1) Opus strategy outline reading full context bundle → (2) Opus per-week elaboration reading outline + context → self-review pass → Andy's review queue |
| 7 | Andy review UX | Two-tier — strategy outline review first (approve or regen-with-note or reject), then per-week detail review (approve whole / regen single week with note / regen "content angles only" / reject-back-to-strategy). No inline editing |
| 8 | Prospect revision | One free "this doesn't fit" button on the portal plan page. Prospect writes a note; routes into Andy's review queue with current plan + note; Andy regens (note feeds stage 1), hand-approves, or sends an LLM-drafted explanation. Further changes = email Andy or retainer conversation |
| 9 | Plan framing | IS the retainer plan, self-run version. Not a lite or teaser artefact. Language in prompts + portal copy leans into the honesty |
| 10 | v1.0 scope | Trial-shoot-only. End-of-Week-6 re-planning + mid-cycle retainer re-planning + direct/referral onboarding entry generation all deferred to Strategic Planning v1.1 |
| 11 | Week 1 clock | Non-converters: prospect clicks "Start Week 1" on the portal → clock begins. Converters: first retainer payment fires Week 1 start; plan becomes live strategy in Client Context |
| 12 | Non-converter portal lifecycle | 60 days from shoot completion, then portal archives (Pixieset embed gated, plan web view gated, chat gated). PDF plan stays with them |
| 13 | Chat ownership | Owned by Client Management (bartender). This spec consumes it — pre-retainer context applies rate-limits via `portal.chat_calls_per_day_pre_retainer`. Chat reads the active plan as additional context so it can answer plan questions |
| 14 | Retainer migration | On Deal → Won, approved plan copies into Client Context as the active strategy artefact. Andy gets a refresh-review at retainer kickoff (5–15 min review against fuller retainer deliverables, regen option). Post-review, Week 1 fires on first retainer payment under Andy's execution |
| 15 | Shoot-day notes schema | Structured: Marketing Infrastructure checklist (6 fields, enrichment-prefilled) + Goals (ordered 1–3) + Shoot-Day Signals (4 × 1–5 scale) + Observations (free textarea 2–6 sentences) |
| 16 | Success metrics | Primary (quality): revision-request rate < 10% + ≤ 2 total regens per plan + median Andy review time < 10 min. Secondary (business): retainer conversion lift vs. pre-plan baseline |

---

## 2. End-to-end flow

### 2.1 Pre-shoot

Prospect has completed the Intro Funnel (landing → questionnaire sections 1–4 → payment → booking → shoot booked). Intake questionnaire is the primary pre-shoot context — it must contain enough practical info to feed the generator (see §12.1, patch owed on Intro Funnel). Enrichment has been running since Lead Gen picked them up.

### 2.2 Shoot day

Andy runs the 60-minute on-site shoot. During the shoot, he naturally learns the business's current-state posture — email list? ads? lead magnets? goals? Nothing inside Lite changes until he's back at his desk.

### 2.3 Post-shoot — Trial Shoot panel (Pipeline)

Andy opens the Deal profile → Trial Shoot panel (owned by Pipeline / Intro Funnel spec; this spec adds one sub-section). He:
1. Uploads/pastes the Pixieset gallery URL (existing Intro Funnel field).
2. Fills the **Shoot-day notes** structured form (new, this spec — see §3).
3. Clicks **Generate plan**.

A `six_week_plan_generate` task enqueues on `scheduled_tasks`. The generator runs in the background (see §4). The Deal panel shows "Plan generating — notify when ready" status.

### 2.4 Generator fires

Stage 1 → stage 2 → self-review → Andy review queue entry. See §4.

### 2.5 Andy's review

Two-tier review at `/lite/six-week-plans/[planId]/review` (see §5). Andy approves → plan transitions to `approved`. Activity log: `six_week_plan_approved`.

### 2.6 Plan releases to portal — bundled with gallery (F2.a, 2026-04-13 Phase 3.5 Step 11 Stage 2)

On approval, the plan becomes visible inside the prospect's Client Management portal at `/portal/[token]/plan` (see §6) **and** the bundled-deliverables gate fires per Intro Funnel §15.1: `intro_funnel_submissions.plan_ready_at = NOW`; if `gallery_ready_at` is also non-null, the unified `deliverables_ready` transition fires now (otherwise it fires when the gallery URL is later pasted). The single bundled announcement email (covering both gallery and plan) is owned by Intro Funnel §15.1 — this spec does **not** send its own release email, to avoid two beats.

`activity_log` entries: `six_week_plan_approved` (this spec, on review approval), then `six_week_plan_released` only when the bundled `deliverables_ready` fires. Cockpit surface: quiet feed entry on bundled release; if the plan is approved before the gallery, Andy sees the existing `intro_funnel_awaiting_bundle { waiting_on: 'gallery' }` entry per Intro Funnel §17.2.

### 2.7 Prospect experience

Prospect opens portal → sees the plan section active. Plan page shows all 6 weeks as read-only accordion cards (no check-off affordance yet — that's post-activation). One "Start Week 1" button at the top. One small secondary "Download as PDF" link. One "this doesn't fit my business" revision link at the bottom.

If they click **Start Week 1**: clock begins, Week 1 card expands into a live tracker (see §6.3), subsequent weeks become accessible on their 7-day cadence.

If they click **revision**: modal with textarea → submits to Andy's review queue with their note (see §7).

If they ignore it: plan remains a readable document for 60 days, then archives with the portal.

### 2.8 Retainer conversion (optional path)

Deal transitions to Won (Pipeline/Intro Funnel side). Background job `six_week_plan_migrate_on_won` copies the approved plan into Client Context as the active strategy artefact (see §8). Andy gets a refresh-review card in his cockpit (quiet priority). He reviews the plan against the fuller retainer deliverables, optionally regenerates, approves. First retainer payment (Stripe webhook) fires Week 1 start. Week 1 executes under Andy's hand inside the retainer-side stack (Content Engine + Task Manager + Client Context + Daily Cockpit — all existing specs).

### 2.9 Non-converter expiry (default path)

At day 60 post-shoot-completion, `six_week_plan_non_converter_expiry` job fires (owned by Client Management's 60-day archive logic — see §8.2). Portal archives. Final email sends the PDF plan attached, in case they haven't downloaded it.

---

## 3. Shoot-day notes field (Trial Shoot panel)

Structured form on the Trial Shoot panel in Pipeline. Andy fills after the shoot, before clicking **Generate plan**.

### 3.1 Marketing Infrastructure (6 fields)

Each field is enrichment-prefilled with a visible "Inferred from enrichment — confirm or correct" label. Andy can accept, adjust, or override.

| Field | Input | Enrichment signal |
|-------|-------|-------------------|
| Email list | Radio (none / exists — small / exists — moderate / exists — large) + optional short text note | Presence of signup form on site; newsletter signup detected |
| Ad experience | Radio (none / tried and stopped / currently running — low / currently running — substantial) + optional short text note | Meta ad library presence + Google ad library presence |
| Lead magnet | Radio (none / one / multiple) + optional short text name | Detected by web scrape for offer-shaped content |
| Website status | Radio (none / DIY builder / custom / pro-built) + CMS short text | Site tech stack inference |
| Social posting cadence | Radio (none / sporadic / weekly / multi-weekly) + primary platform short text | Most recent 12 posts timestamp distribution |
| Known competitors | Free short text (1–5 comma-separated) | Enrichment flags 0–3 inferred; Andy adds what he learned |

### 3.2 Goals (ordered list 1–3)

Short free-text, ordered by priority. Prompt in UI: "What does this business most want to move in the next 6 weeks? Write the three things they named, in their own words if you can."

### 3.3 Shoot-Day Signals (4 × 1–5 scale)

Andy's in-person read. These don't appear in the plan text but calibrate the generator's voice/ambition.

| Signal | Anchor 1 | Anchor 5 |
|--------|----------|----------|
| Energy | Burnt out, going through motions | On fire, can barely keep up |
| Fluency on offering | Can't clearly describe what they do | Crystal clear, rehearsed but honest |
| Clarity of ICP | "Anyone really" | Names specific audience with language they use |
| Conversion-readiness | No funnel, no follow-up | Has working funnel, closes what lands |

### 3.4 Observations (free textarea)

Prompt: "2–6 sentences. What wouldn't come through on a form? What should the plan absolutely know about this person?"

Placeholder example: "Runs the business with their partner, partner does the books. Really wants to be known as the 'cold-brew first' café in the suburb — it's how they introduce themselves. Struggles with saying no to custom cake orders that eat margin."

### 3.5 Validation

Before **Generate plan** is enabled:
- All 6 Infrastructure radios have a value (enrichment pre-fill counts).
- At least 1 Goal entered.
- All 4 Signals rated.
- Observations ≥ 40 characters.

Validation is soft — Andy can override with a confirm modal ("Generate with incomplete notes?") but the plan quality degrades measurably and the LLM's low-confidence flags will pile up at review.

---

## 4. Generator pipeline

### 4.1 Context bundle (input to stage 1)

Bundled by `assembleSixWeekContext(dealId)`:
- Intake questionnaire answers (from Intro Funnel — all 4 sections).
- Enrichment profile (9-signal from Lead Gen).
- Shoot-day notes (this spec, §3).
- Brand DNA profile — **optional**. If taken, include. If not, include `brand_dna: null` and stage 1 degrades gracefully (voice specificity lower, strategic framing unaffected).
- The `TRIAL_SHOOT_OFFER` constant (from model registry / Foundations patch owed per Intro Funnel trial-shoot-facts patch) — for context about what the prospect already received.

Assembled as a single JSON payload. Token budget: ~6–10k input tokens typical, 15k ceiling (enrichment is the variable).

### 4.2 Stage 1 — Strategy Outline

**Model:** registered job `six-week-plan-strategy` (Opus tier). Prompt lives at `lib/ai/prompts/six-week-plan-strategy.ts` (stub file now; content populated in content mini-session).

**Input:** context bundle + output schema.

**Output (structured JSON):**
```
{
  current_state_diagnosis: string,    // 3-6 sentences, reads the bundle and summarises what's real about this business right now
  primary_goal: string,               // distilled from Goals — the one thing this plan most needs to move
  chosen_primitives: Primitive[],     // e.g. ["email_list_setup", "lead_magnet_flow", "meta_ads", "content_cadence"], ranked
  theme_arc: WeeklyTheme[6],          // six one-sentence themes that interlock
  flagged_assumptions: Assumption[]   // { statement, confidence: 'low' | 'medium' | 'high', what_to_verify }
}
```

**Prompt framing (for content mini-session):** "You are SuperBad's lead strategist. You have been briefed on a new client. Outline the first six weeks of work you would run for this client as their agency. Your plan will be handed to the client — if they convert to retainer, you'll execute it; if not, they'll run it themselves. Be honest, specific, and match the scale of their business."

### 4.3 Stage 2 — Per-Week Elaboration

**Model:** registered job `six-week-plan-weeks` (Opus tier). Prompt lives at `lib/ai/prompts/six-week-plan-weeks.ts`.

**Input:** context bundle + stage 1 output.

**Output (structured JSON):**
```
{
  plan_intro: string,                 // 1 paragraph framing the 6 weeks ahead; spoken to the client
  weeks: Week[6]                      // each week fully elaborated
}

Week = {
  week_number: 1 | 2 | 3 | 4 | 5 | 6,
  theme: string,                      // carries over from stage 1 theme_arc
  why_this_week: string,              // 2-3 sentences — narrative reason
  content_angles: ContentAngle[2-3],  // references to specific shoot assets + caption directions
  channel_mix: Channel[1-3],          // where this week's work lands
  tasks: Task[3-6],                   // concrete actions — infrastructure, content, distribution, conversion
  success_signal: string,             // one sentence — "you'll know it worked when..."
  fallback: string                    // one sentence — "if [signal weak], try [alternative] next week"
}

Task = {
  title: string,
  detail: string,                     // 1-2 sentences
  category: 'infrastructure' | 'content' | 'distribution' | 'conversion' | 'measurement',
  effort_estimate: 'quick' | 'half_day' | 'full_day' | 'multi_day'
}
```

**Prompt framing:** "You've outlined the strategy. Now decompose each week so this client could execute it themselves if they chose to. Reference specific assets from their shoot. Tie tasks to their actual business, not a template."

### 4.4 Self-review pass

After stage 2, a **Haiku** self-review call runs. Job: `six-week-plan-review`. Prompt at `lib/ai/prompts/six-week-plan-review.ts`.

**Input:** full plan JSON + a reviewer checklist.

**Checklist (approximate — final in content mini-session):**
- Does each week reference specific shoot assets, not generic language?
- Does each week's success signal name a measurable thing?
- Is the scale of tasks matched to Shoot-Day Signal "energy" rating?
- Is at least one infrastructure task present in weeks 1–2?
- Does the fallback name a real alternative, not "try harder"?
- Is any week's tasks duplicate of another week?

**Output:** `{ passes: boolean, issues: string[] }`. If `passes: false`, stage 2 runs once more with the issues appended to the prompt. One retry maximum — if second pass fails, plan enters Andy's queue with a `self_review_flagged` warning badge.

### 4.5 Observability (external call logging)

Every stage logs to `external_call_log` per the FOUNDATIONS §11 patch:
```
{ job: 'six-week-plan-strategy' | 'six-week-plan-weeks' | 'six-week-plan-review',
  actor_type: 'external',
  actor_id: deal_id,
  units: input_tokens + output_tokens,
  estimated_cost_aud: <calculated from tier rate>,
  timestamp: now }
```

Target unit cost per plan (first generation, no regens): AUD ~$0.80–1.50. Tracked by Cost & Usage Observatory.

---

## 5. Andy's review surface

Route: `/lite/six-week-plans/[planId]/review`. Surfaced as a waiting item on Daily Cockpit attention rail (chip kind `six_week_plan_review { deal_id, prospect_name, stage }`, owned by Cockpit's `getWaitingItems()` contract — see §12.2).

### 5.1 Review states

```
pending_strategy_review   (stage 1 complete, stage 2 not run yet)
pending_detail_review     (stage 2 complete, Andy has approved strategy)
approved                  (Andy has approved the detail)
superseded                (Andy regenerated — prior version archived)
```

### 5.2 Strategy outline review (first tier)

Single scroll screen. Shows, in order:
1. **Context summary card** — one-liner of who this is + link to Deal + link back to shoot-day notes.
2. **Current state diagnosis** — 3–6 sentences from stage 1.
3. **Primary goal** — 1 sentence.
4. **Chosen primitives** — ranked chips.
5. **Theme arc** — 6 one-liners.
6. **Flagged assumptions** — each with a badge (low / medium / high confidence), a "what to verify" note, and an inline "Correct this" button that adds the correction to a regen note.

Footer actions:
- **Approve & generate detail** (primary) — enqueues stage 2.
- **Regenerate with notes** — textarea → re-runs stage 1 with note injected.
- **Reject — pause plan** — plan stays in `pending_strategy_review`, goes to Andy's cockpit later; blocks detail until resolved.

### 5.3 Detail review (second tier)

Scroll-based. Shows intro paragraph + 6 week cards. Each week card is expandable and contains:
- Theme + "why this week" paragraph.
- Content angles with tags linking back to named shoot assets (e.g. `[photo: owner portrait #3]`).
- Channel mix chips.
- Tasks list with category badges + effort badges.
- Success signal + fallback in a sidebar callout.
- **Per-week actions:** Approve week / Regen this week with note.

Global footer:
- **Approve plan & release** (primary) — transitions to `approved`, fires release (§2.6).
- **Regen content angles across all weeks** — secondary.
- **Reject to strategy** — takes Andy back to strategy review (§5.2) with prior detail archived.

Self-review flagged warnings (if `self_review_flagged`) appear as a red banner at the top with the specific issues listed.

### 5.4 Regen cost control

Per Observatory: if total regens on a single plan exceed 4 within 24h, the review UI shows a soft warning ("this plan's had a lot of regens — want to pause and sketch it differently?"). Not a hard cap — Andy's call.

### 5.5 Motion treatment

Review transitions are Tier-1 (standard house spring): week-card expand, regen state, approve state. No new Tier-2 moments spent here. Design-system-baseline revisit inherits this confirmation.

---

## 6. Prospect portal surface (plan section of Client Management portal)

Rendered inside the shared `/portal/[token]` shell. Appears as a menu item in the portal's main navigation labelled **Your plan** (only appears when a plan is `approved` or later states). Lives at `/portal/[token]/plan`.

### 6.1 Pre-activation state (post-approval, pre-"Start Week 1")

- **Intro block.** Plan's `plan_intro` paragraph, set large, no ornament.
- **6 week cards, read-only.** All accordions collapsed by default. First expand is Tier-2 motion candidate (see §13). No check-off affordances. Each card expand reveals the full week content (theme, why, angles, channels, tasks, success signal, fallback).
- **Primary action: "Start Week 1."** Prominent button below intro block. Copy finalised in content mini-session — leans into the honest framing ("You're running this. When you're ready, we'll start the clock.").
- **Secondary action: "Download as PDF"** small link, bottom of page.
- **Tertiary action: "This doesn't fit my business"** small link, bottom of page. One free revision (see §7).

### 6.2 Post-activation state (after "Start Week 1" click)

Non-converter path only. On click:
1. `six_week_plans.activated_at` set to `now()`.
2. Week 1 card auto-expands with a Tier-2 cinematic transition (design-system-baseline revisit candidate).
3. Plan flips into live tracker mode (see §6.3).
4. Activity log: `six_week_plan_self_activated`. Cockpit: low-priority feed entry ("{prospect} activated their plan — retainer conversion less likely").

### 6.3 Live tracker mode (post-activation)

- **Week card header** shows "Week N — Day X of 7" (computed from `activated_at` + N-1 weeks).
- **Task check-off** enabled. Click = strike-through + optional "done it" confirmation. State persisted per portal session (`six_week_plan_task_progress` table, see §10). Never visible to Andy as a review queue item — this is the prospect's personal workspace.
- **Automatic week advance** at end of each 7-day window — next week's card auto-expands; previous week collapses with a done-state summary (tasks completed / tasks skipped).
- **No reminders / email nudges during self-run.** Per `feedback_no_content_authoring.md` + memory `feedback_primary_action_focus.md` — no nag surfaces for a non-converter path.

### 6.4 Portal chat integration

Bartender chat (Client Management owned, §7a of Client Management spec) reads the active plan as additional context. Prospect can ask "what do you mean by week 3's offer push?" — chat answers scoped to the plan. Chat can NOT modify the plan; the revision button is the dedicated path.

Pre-retainer rate limit: `portal.chat_calls_per_day_pre_retainer` settings key applies (see §9 for all settings keys).

### 6.5 PDF takeaway

Generated on-demand (not pre-rendered) when prospect clicks "Download as PDF". Puppeteer renders a print-styled version of the portal plan surface into a paginated PDF. Branded with SuperBad visual identity. Contains all 6 weeks fully expanded + plan intro. Does NOT include progress state (even if activated) — PDF is a static snapshot of the plan itself.

PDF cached for 24h per plan version. Regenerated if plan is superseded or regenerated via revision (new version → new PDF).

### 6.6 Motion treatment

- **Tier-2 candidate:** plan reveal on first portal visit after approval (all week cards cascading into view). Added to design-system-baseline revisit queue as candidate.
- **Tier-2 candidate:** "Start Week 1" activation moment (Week 1 card transition to live tracker). Added to revisit queue as candidate.
- **Tier-1 (house spring):** week card expand/collapse, task check-off, week auto-advance.

---

## 7. Prospect revision flow

### 7.1 Revision request UX

"This doesn't fit my business" link at the bottom of the plan page. Click opens a modal:

- Heading: "Tell us what's off" (copy finalised in content mini-session).
- Textarea — prospect writes their own description of the mismatch. Minimum 40 characters.
- Note above the textarea: "You get one free revision on this plan. If you'd like more conversations about fit, we can do that as part of a retainer chat with Andy."
- Submit → routes to Andy's review queue.

### 7.2 Andy's revision-queue entry

Appears as a separate waiting-item kind on the cockpit: `six_week_plan_revision_request { planId, prospect_name, note_preview }`.

At `/lite/six-week-plans/[planId]/revision-review`, Andy sees the current approved plan + the prospect's note side-by-side. Three actions:

1. **Regenerate with this note.** Note injects into stage 1 as additional context. Full pipeline re-runs (stage 1 → stage 2 → self-review). New plan supersedes the old one (activity log: `six_week_plan_superseded_by_revision`). Andy reviews the new version via the standard two-tier review before it releases.
2. **Explain why this plan stands.** LLM drafts a short response (Haiku, job `six-week-plan-revision-reply`, prompt at `lib/ai/prompts/six-week-plan-revision-reply.ts`) addressing the prospect's note. Andy reviews + sends. Plan stands as-is.
3. **Hand-reject.** Andy writes a short note himself, sends, plan stands. (For cases where the LLM-drafted reply doesn't fit.)

### 7.3 One-revision enforcement

`six_week_plans.revision_requested_at` tracks the single revision. If set, the "This doesn't fit" link on the portal is replaced with a quieter "Have more questions about this plan? Email Andy" mailto link. No second revision possible through the portal.

### 7.4 Activity log entries

- `six_week_plan_revision_requested` (on prospect submit)
- `six_week_plan_revision_regenerated` (on Andy regen path)
- `six_week_plan_revision_explained` (on Andy explain path)

---

## 8. Retainer migration + refresh-review

### 8.1 Migration on Deal → Won

When Pipeline transitions the Deal to `won` status, the `deal_won_portal_migration` job (owned by Client Management §25) runs its existing steps AND fires `six_week_plan_migrate_on_won`:

1. Approved plan row(s) on `six_week_plans` copy the `{intro, weeks_json, chosen_primitives, theme_arc}` into a new Client Context artefact with `artefact_type: 'active_strategy'` and `origin: 'six_week_plan'`.
2. The Client Context active_strategy artefact is flagged `pending_refresh_review = true`.
3. Andy's cockpit gets a quiet feed entry: `six_week_plan_refresh_review_requested { clientId, planId }`.
4. Activity log: `six_week_plan_migrated_to_client_context`.

### 8.2 Andy's refresh-review at retainer kickoff

Route: `/lite/clients/[companyId]/strategy/refresh-review`. Andy reviews the migrated plan against the retainer's fuller deliverables scope (ongoing shoots, broader budget, longer time horizon). Three actions:

1. **Approve as-is — set live.** Plan becomes the active strategy. `pending_refresh_review` flag clears. Activity log: `six_week_plan_live_strategy_set`.
2. **Regenerate against retainer scope.** Re-runs the generator (stages 1 + 2) with a modified context bundle that includes the retainer's deliverables + budget. New plan supersedes the migrated one.
3. **Hand-edit.** Opens the plan JSON in an edit view for Andy to adjust specific weeks/tasks directly (this is the one surface where inline editing exists — the retainer kickoff justifies it because Andy's about to execute the plan himself). Save → set live.

### 8.3 Week 1 trigger for retainer path

Stripe webhook on first successful retainer charge fires `six_week_plan_retainer_week_1_start`. If the active_strategy artefact is `live` (Andy has done refresh-review), Week 1 begins. If still `pending_refresh_review`, a high-priority cockpit alert tells Andy the retainer payment has landed and the plan isn't set live yet.

### 8.4 Non-converter expiry

At day 60 post-shoot-completion, `six_week_plan_non_converter_expiry` job checks for:
- Deal NOT in `won` status
- Portal NOT already archived by another path
- Andy NOT manually extended the portal (one-off override via Pipeline panel — see §11 settings)

If all three: portal archives (owned by Client Management archive logic — this spec just fires the trigger). Final email sends the PDF plan attached via `sendEmail({ classification: 'transactional' })`.

Activity log: `six_week_plan_portal_archived_non_converter`.

---

## 9. Settings keys (registered in `docs/settings-registry.md`)

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `plan.portal_access_days_post_shoot` | 60 | integer | Days of portal access for non-converters, from shoot completion |
| `plan.chat_calls_per_day_non_converter` | 5 | integer | Daily Opus chat call cap for pre-retainer portal chat. Resolves on Client Management's chat primitive |
| `plan.chat_calls_per_day_pre_retainer` | 5 | integer | (alias — registered under Client Management; this spec consumes) |
| `plan.revision_note_min_chars` | 40 | integer | Minimum characters for a prospect's revision note |
| `plan.observations_min_chars` | 40 | integer | Minimum characters for Andy's shoot-day observations |
| `plan.regen_soft_warning_threshold` | 4 | integer | Number of regens on a single plan within 24h that triggers the soft warning in Andy's review UI |
| `plan.pdf_cache_hours` | 24 | integer | Hours to cache a rendered PDF before regenerating |
| `plan.self_review_retry_on_fail` | 1 | integer | Max retries on stage 2 if self-review flags issues |
| `plan.extend_portal_days_on_manual_override` | 30 | integer | Default days added when Andy manually extends a non-converter's portal |

All consumed via `settings.get(key)` — no literals in feature code.

---

## 10. Data model

### 10.1 New tables

**`six_week_plans`**
```
id                         primary key
deal_id                    FK → deals
company_id                 FK → companies (null until Deal has a company link)
status                     enum: 'generating' | 'pending_strategy_review' | 'pending_detail_review'
                           | 'approved' | 'superseded' | 'released' | 'archived'
generation_version         integer (increments on regen)
parent_plan_id             FK → six_week_plans (set when superseded by regen; null on first version)

// Stage 1 output
strategy_json              text (JSON blob per §4.2 schema)
strategy_generated_at      timestamp
strategy_approved_at       timestamp

// Stage 2 output
weeks_json                 text (JSON blob per §4.3 schema)
weeks_generated_at         timestamp
self_review_passed         boolean
self_review_issues_json    text (JSON array, nullable)

// Andy review
reviewed_by                FK → users (will always be Andy in v1.0)
approved_at                timestamp
regen_count                integer (tracked for Observatory)

// Prospect activation (self-run path)
released_at                timestamp
activated_at               timestamp (null until "Start Week 1" clicked or first retainer payment)
activation_path            enum: 'self_run' | 'retainer_payment' | null

// Revision
revision_requested_at      timestamp (null or one)
revision_note              text (null or one)
revision_resolution        enum: 'regenerated' | 'explained' | 'hand_rejected' | null

// Retainer migration
migrated_to_client_context_at   timestamp (null until Won)
refresh_reviewed_at             timestamp (null until Andy completes refresh-review)

// Non-converter expiry
portal_archived_at         timestamp (null until day 60)
portal_extended_until      timestamp (null; override)
```

**`six_week_plan_task_progress`**
```
id                         primary key
plan_id                    FK → six_week_plans
week_number                integer (1–6)
task_index                 integer (position within week's tasks array)
completed_at               timestamp (null if not completed)
```

One row per task per plan. Created on first "Start Week 1" click. Only used on self-run path.

**`trial_shoot_notes`**
```
id                         primary key
deal_id                    FK → deals (one per Deal)
infra_email_list           enum + short_text
infra_ad_experience        enum + short_text
infra_lead_magnet          enum + short_text
infra_website_status       enum + cms_short_text
infra_social_cadence       enum + primary_platform_short_text
infra_competitors          text (comma-separated)
goals_json                 text (JSON array [{priority: 1|2|3, text: string}])
signal_energy              integer (1–5)
signal_fluency             integer (1–5)
signal_icp_clarity         integer (1–5)
signal_conversion_ready    integer (1–5)
observations               text
filled_at                  timestamp
filled_by                  FK → users
enrichment_prefill_json    text (what enrichment said before Andy edited; for audit + prompt tuning)
```

### 10.2 New columns on existing tables

- **`client_context_strategy_artefacts`** (assumed primitive from Client Context Engine spec) gains:
  - `origin` enum ('six_week_plan' | 'manual' | 'regenerated' | …)
  - `source_plan_id` FK → six_week_plans (null unless origin = 'six_week_plan')
  - `pending_refresh_review` boolean
  - *If Client Context doesn't yet expose this shape, patch owed — see §14.*

### 10.3 New `activity_log.kind` values

Added to the cross-spec enum (consolidated at Phase 3.5):
- `six_week_plan_generation_started`
- `six_week_plan_strategy_ready_for_review`
- `six_week_plan_strategy_approved`
- `six_week_plan_strategy_regenerated`
- `six_week_plan_detail_ready_for_review`
- `six_week_plan_approved`
- `six_week_plan_released`
- `six_week_plan_self_activated`
- `six_week_plan_revision_requested`
- `six_week_plan_revision_regenerated`
- `six_week_plan_revision_explained`
- `six_week_plan_superseded_by_revision`
- `six_week_plan_migrated_to_client_context`
- `six_week_plan_refresh_review_requested`
- `six_week_plan_live_strategy_set`
- `six_week_plan_portal_archived_non_converter`
- `six_week_plan_pdf_downloaded`

### 10.4 New `scheduled_tasks` task types

Added to cross-spec list:
- `six_week_plan_generate` (fires stages 1 + 2 + self-review, chains internally)
- `six_week_plan_migrate_on_won` (fires on Deal Won transition)
- `six_week_plan_non_converter_expiry` (daily sweep, fires at day 60)

### 10.5 New `sendEmail()` classifications

Added to FOUNDATIONS §11.2 enum:
- `six_week_plan_released` (transactional — "your plan is ready")
- `six_week_plan_revision_resolved` (transactional — Andy's explain-reply)
- `six_week_plan_non_converter_expiry` (transactional — final PDF attachment email)

---

## 11. Prompts + LLM registry entries

Prompts live as files (per context-safety conventions):
- `lib/ai/prompts/six-week-plan-strategy.ts` — stage 1 Opus prompt (populated in content mini-session)
- `lib/ai/prompts/six-week-plan-weeks.ts` — stage 2 Opus prompt
- `lib/ai/prompts/six-week-plan-review.ts` — self-review Haiku prompt
- `lib/ai/prompts/six-week-plan-revision-reply.ts` — Andy's explain-reply Haiku draft

LLM model registry entries (Observatory §7 — patch owed, see §14):
| Job name | Tier | Purpose |
|----------|------|---------|
| `six-week-plan-strategy` | Opus | Stage 1 strategy outline |
| `six-week-plan-weeks` | Opus | Stage 2 per-week elaboration |
| `six-week-plan-review` | Haiku | Self-review pass |
| `six-week-plan-revision-reply` | Haiku | Andy-drafted prospect reply on explain path |

All four log to `external_call_log` per FOUNDATIONS §11 observability primitive. Actor: `external`, `actor_id: deal_id` (or `client_id` on retainer-path regen).

---

## 12. Integration points / cross-spec contracts

Inlined per Phase 3.5 spec self-containment rule — so a Phase 5 build session reading only this spec can execute without reaching into another spec's handoff.

### 12.1 Intro Funnel (locked 2026-04-12) — patches owed

Intake questionnaire must cover practical marketing-infrastructure info enough to feed the generator alongside shoot-day notes. Resolved in Intro Funnel content mini-session; not in this spec's session. Patch logged in `PATCHES_OWED.md`.

Post-shoot portal surfaces (deliverables reveal, reflection questionnaire, retainer-fit recommendation) migrate from Intro Funnel's own portal routes to rendering inside the shared Client Management portal. Patches logged in `PATCHES_OWED.md`.

`TRIAL_SHOOT_OFFER` constant (from trial-shoot-facts memory patch) is read by this spec's stage 1 prompt for offer-awareness.

### 12.2 Daily Cockpit (locked) — new contract entries

`getWaitingItems()` contract gains 3 new source kinds:
- `six_week_plan_strategy_review { plan_id, deal_id, prospect_name }`
- `six_week_plan_detail_review { plan_id, deal_id, prospect_name }`
- `six_week_plan_revision_request { plan_id, prospect_name, note_preview }`
- `six_week_plan_refresh_review { plan_id, client_id, client_name }`

`getHealthBanners()` contract gains 1 new kind:
- `six_week_plan_retainer_payment_without_refresh_review { plan_id, client_id }` — high priority, alerts when Stripe payment lands before Andy has done refresh-review.

No `maybeRegenerateBrief()` subjects owed.

### 12.3 Client Management (locked) — patches owed

Portal must support pre-retainer rendering mode (section gating, chat rate-limits, 60-day archive). Portal chat must read the active 6-week plan as additional context. Chat can answer "explain a week/task" as a limited safe action.

Patches logged in `PATCHES_OWED.md`. Phase 3.5 confirms absorption or spawns a bounded mop-up.

### 12.4 Client Context Engine (locked) — patches owed

Must support an `active_strategy` artefact type with `origin: 'six_week_plan'` and `pending_refresh_review` flag. If not currently specced, patch owed. Client Context's downstream consumers (Content Engine briefs, Daily Cockpit briefs, Portal chat) must read the active_strategy artefact as part of the "who they are + where you are" perpetual LLM context (per memory `project_two_perpetual_contexts.md`).

### 12.5 Pipeline (via Intro Funnel)

Trial Shoot panel gains a sub-section for shoot-day notes form + "Generate plan" button + plan status badge. The Deal profile surfaces the plan's review state inline with existing deal status.

### 12.6 Cost & Usage Observatory (locked)

4 new LLM jobs register in `docs/specs/cost-usage-observatory.md` §7 model registry:
- `six-week-plan-strategy` (Opus)
- `six-week-plan-weeks` (Opus)
- `six-week-plan-review` (Haiku)
- `six-week-plan-revision-reply` (Haiku)

Patch owed (added to PATCHES_OWED).

### 12.7 Branded Invoicing / Stripe

Stripe webhook on first successful retainer charge fires `six_week_plan_retainer_week_1_start` (this spec's handler). Retainer charge identification is based on the existing subscription-vs-invoice categorisation in Branded Invoicing + SaaS Subscription Billing — this spec consumes, doesn't re-define.

### 12.8 Content Engine

Once a plan is `live_strategy`, Content Engine reads it for weekly content brief generation. No direct call contract here — Content Engine pulls from Client Context's active_strategy artefact (the Context Engine is the mediator).

### 12.9 Unified Inbox

No direct integration. Revision-explain replies, release emails, and non-converter expiry emails route through `sendEmail()` per normal channel discipline (passive channel → email echo not applicable, these are active announcements to the prospect).

---

## 13. Voice & delight treatment

Per `docs/specs/surprise-and-delight.md` discipline.

### 13.1 Ambient slots

- **Browser tab titles** for Andy's review surface (`/lite/six-week-plans/[id]/review`) — rotation pool; content mini-session to draft (e.g. "Plan for {prospect} — strategy ready", "Plan for {prospect} — you've regenerated three times", "Plan for {prospect} — ship it").
- **Portal plan page tab title** — uses Client Management's existing portal tab-title convention (claimed sprinkle on that spec).
- **System email first lines** — release email, revision-resolved email, non-converter expiry email — inherit from Client Management's claimed sprinkle (system email subject lines + first lines).

### 13.2 Hidden eggs — none proposed in this spec

No new eggs proposed. The plan surface is a paid deliverable — voice is dry + sincere, not cheeky. Any eggs in this vicinity would live on the "Start Week 1" activation moment and they belong to the Surprise & Delight admin-egg expansion brainstorm (already queued).

### 13.3 Sprinkle claim from `docs/candidates/sprinkle-bank.md`

**Claimed:** one short dry line that appears **once** in the plan PDF's footer — "This plan belongs to you. So does the nerve to run it." (exact line finalised in content mini-session; this is a placeholder seed). Mark as `[CLAIMED by six-week-plan-generator]` in the sprinkle bank. Single-occurrence per PDF, no rotation.

### 13.4 Motion candidates (design-system-baseline revisit queue additions)

Two new Tier-2 candidates added (registry growth count managed at revisit):
- `motion:plan_reveal` — first portal visit after plan approval, all 6 week cards cascade into view with stagger.
- `motion:plan_activate` — "Start Week 1" click fires Week 1 card's transition into live tracker mode (clock appears, tasks become interactive, other weeks soften).

No new sounds introduced.

---

## 14. Patches owed (logged in `PATCHES_OWED.md`)

Already logged during the brainstorm:
- `docs/specs/intro-funnel.md` — portal lifecycle 60-day expiry (replacing "dormant indefinitely")
- `docs/specs/intro-funnel.md` — intake questionnaire extension for plan-generator practical inputs
- `docs/specs/intro-funnel.md` — post-shoot portal surfaces migrate to Client Management portal shell
- `docs/specs/client-management.md` — pre-retainer portal rendering mode + 60-day archive + chat rate-limits
- `docs/specs/client-management.md` — portal chat reads active plan + explain-week safe action

Additional patches identified in this spec's writing:
- `docs/specs/cost-usage-observatory.md` §7 — add 4 new LLM jobs: `six-week-plan-strategy`, `six-week-plan-weeks`, `six-week-plan-review`, `six-week-plan-revision-reply`.
- `docs/specs/daily-cockpit.md` — `getWaitingItems()` adds 4 new source kinds (see §12.2); `getHealthBanners()` adds 1 kind (retainer-payment-without-refresh-review).
- `docs/specs/client-context-engine.md` — `active_strategy` artefact type with `origin: 'six_week_plan'` + `pending_refresh_review` flag (confirm or add).
- `docs/specs/branded-invoicing.md` / `docs/specs/saas-subscription-billing.md` — first-retainer-charge webhook handler extension to fire `six_week_plan_retainer_week_1_start`.
- `docs/specs/surprise-and-delight.md` — sprinkle bank claim for PDF footer line.
- Design-system-baseline revisit — 2 new Tier-2 motion candidates (`motion:plan_reveal`, `motion:plan_activate`).
- `FOUNDATIONS.md` §11.2 `sendEmail()` enum — 3 new classifications (see §10.5).
- `activity_log.kind` enum (cross-spec) — 17 new values (see §10.3).
- `scheduled_tasks` task types (cross-spec) — 3 new types (see §10.4).

All to be consolidated at Phase 3.5.

---

## 15. Success metrics

### 15.1 Primary (quality — measurable week 1)

- **Revision-request rate per plan < 10%.** If the prospect hits the "this doesn't fit" button, the first pass missed. Tracked by `six_week_plans.revision_requested_at` / total `approved` plans.
- **Regen count per plan ≤ 2 across both review stages.** Andy shouldn't be banging on regen to get something shippable. Tracked by `six_week_plans.regen_count`.
- **Median Andy review time < 10 minutes end-to-end.** From strategy review open to detail approve. Tracked via timestamps on the review routes + cockpit entry.

Any of these metrics sliding = content mini-session recalibration of stage 1 + stage 2 prompts + self-review checklist.

### 15.2 Secondary (business — 2–3 months of data)

- **Retainer conversion lift vs. pre-plan baseline.** Pre-plan baseline is the Intro Funnel conversion rate before this feature shipped (measured during Phase 6 shadow period). Target: meaningful positive delta attributable to the plan experience.

### 15.3 Instrumentation notes for Phase 6

- Cost & Usage Observatory reports per-plan Opus spend weekly + flags if median cost drifts > 20% above baseline.
- Admin review time is measured from Cockpit-click-through to Approve click, excluding regens (regens reset the timer).
- "Plan activated but didn't convert" rate is a separate health signal — high activation + low conversion = plan is succeeding as self-run, which is *intended* behaviour (per `project_tier_limits_protect_margin.md`), not a failure.

---

## 16. Out of scope (v1.0 non-goals)

Explicit non-goals — do not build in v1.0, do not expand scope during Phase 5 build sessions:

- **End-of-Week-6 re-planning.** Retainer clients past Week 6 run the next cycle under Andy's hand until Strategic Planning (v1.1) lands. No automatic "generate weeks 7–12" path.
- **Mid-cycle retainer re-planning.** If a retainer client pivots in Week 3, Andy edits Client Context directly. No generator call. (The refresh-review flow at kickoff is the only retainer-side regen this spec supports.)
- **Plan generation for direct/referral/legacy onboarding entries.** Per memory `feedback_onboarding_multiple_entry_paths.md`, those paths have their own onboarding flow. They don't buy the trial shoot, so they don't get the 6-week plan artefact. The retainer's ongoing strategy is authored by Andy in Client Context from day one.
- **Plan versioning UI for the prospect.** If the prospect's plan is superseded by regen (via revision request), they see only the new version. No history UI, no diff. Andy can see supersedes via the `parent_plan_id` chain for audit.
- **Plan editing by the prospect.** No "I'll tweak week 3" affordances. Revision button is the one path; editing is a retainer-side privilege (and even then, only on the refresh-review at kickoff, per §8.2 hand-edit option).
- **Multi-plan per Deal.** Each Deal has at most one "live" plan at any time. Superseded plans archive on `six_week_plans` but the Deal only surfaces the latest approved version.
- **PDF with interactive / progress state.** PDF is a snapshot of the plan, never a live document.
- **Plan exportable as other formats (Notion, GDoc, Trello).** PDF only in v1.0.
- **Chat feature owned by this spec.** Chat is Client Management's primitive; this spec consumes it.
- **Scheduled reminder emails during self-run.** Non-converter path has no nag surfaces.

---

## 17. Content mini-session scope (queued, must run before Phase 5 sessions B + C)

Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` skills loaded. Produces:

- Stage 1 strategy prompt (calibrated against ≥ 8 synthetic trial-shoot scenarios covering different business scales + marketing-infrastructure profiles).
- Stage 2 per-week elaboration prompt.
- Self-review checklist (final form).
- Revision-reply Haiku prompt.
- Portal plan page copy: intro block surround, "Start Week 1" button copy, revision modal copy + "you get one free revision" language, week-card empty-state text.
- PDF layout + footer dry line (sprinkle claim).
- Release email, revision-resolved email (explain path), non-converter expiry email bodies.
- Browser tab title rotation pool for Andy's review surface.
- Andy review UI microcopy (badges, flagged-assumption language, regen-note placeholders).

Estimated size: medium.

---

## 18. Phase 5 sizing

**4 build sessions:**

- **Session A (INFRA + schema)** — data model (3 new tables, column additions, activity_log enum extensions, scheduled_tasks types, sendEmail classifications), migrations, settings-registry entries for all plan.* keys, `assembleSixWeekContext()` helper. Prompt file stubs created (content populated in mini-session before session B). LLM model registry entries.
- **Session B (FEATURE — generator + Andy review)** — the two-stage generator pipeline with self-review, Andy's two-tier review UI at `/lite/six-week-plans/[planId]/review`, strategy-review + detail-review flows, regen paths, self-review-flagged badge. Requires content mini-session completed.
- **Session C (FEATURE — portal surface + PDF + revision flow)** — portal plan section rendering (pre-activation, post-activation, live tracker), "Start Week 1" + task check-off persistence, Puppeteer PDF rendering + caching, revision request modal + Andy revision-review surface, revision-resolved email path. Consumes Client Management portal shell (build depends on that spec having shipped its portal sections).
- **Session D (FEATURE — retainer migration + non-converter expiry + Stripe hook)** — migration job on Deal Won, refresh-review surface at `/lite/clients/[companyId]/strategy/refresh-review` including hand-edit mode, Stripe webhook wiring for first-retainer-payment → Week 1 start, non-converter daily expiry job + final PDF email, Andy manual extend override.

**Preconditions per session:**

All sessions require: foundation session complete, `settings.get()` + seed migration, `sendEmail()` classification-parametered, `external_call_log` wired, `scheduled_tasks` worker running, LLM model registry live, activity_log logging helper live, Puppeteer set up (Branded Invoicing or Quote Builder will land it first), `docs/content/six-week-plan-generator.md` populated (except session A).

Sessions B + C + D require: Daily Cockpit Session A (attention rail) shipped so cockpit surfacing has a target to write into. Session D requires: Client Management portal migration job + archive logic shipped.

**E2E smoke test (mandatory per AUTONOMY_PROTOCOL)** on the trial shoot → plan generation → Andy approval → portal reveal → PDF download → self-activation → Week 1 progress path. Added to the critical-flows list.

---

## 19. Rollback strategy per session

All four sessions: migration reversible (down-migrations included) + feature-flag gated via `features.six_week_plan_enabled` kill switch. Plan generation can be fully disabled without a deploy if Opus costs spike or the quality bar is missed. Session D's Stripe webhook handler is additive — the handler being off doesn't break retainer payment flow, it just means Week 1 clock doesn't auto-fire (Andy can trigger manually).

---

## 20. Cross-cutting discipline checklist

- [x] Route all outbound email through gate-wrapped `sendEmail()` (release, revision-reply, expiry emails).
- [x] Brand-voice drift check on all customer-facing LLM output (stage 2 weeks, revision-reply).
- [x] Every mutation logs via `logActivity()` (17 new kinds, §10.3).
- [x] All timestamps render via `formatTimestamp()`.
- [x] References `docs/specs/surprise-and-delight.md` under §13 (voice & delight treatment).
- [x] Sprinkle bank claim staked (§13.3).
- [x] No technical options surfaced to Andy (all implementation calls silently locked).
- [x] Settings keys registered, no literals in code (§9).
- [x] Self-containment — no handoff-only cross-spec contract references.
- [x] Motion candidates queued for design-system-baseline revisit.
- [x] LLM jobs named in model registry, not SDK-imported.
- [x] External calls log cost tuple with actor attribution.
- [x] Two perpetual LLM contexts honoured — Brand DNA (optional at trial) + Client Context (active once retainer converts).
