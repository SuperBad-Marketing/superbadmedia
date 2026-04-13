# Cost & Usage Observatory — Feature Spec

**Phase 3 output. Locked 2026-04-13.**

> **Prompt files:** `lib/ai/prompts/cost-usage-observatory.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The Cost & Usage Observatory is SuperBad Lite's internal cost-attribution and anomaly-detection surface. Every external API or LLM call made by the platform — Anthropic, OpenAI Images, Stripe, Resend, Twilio, Graph API, Pixieset, SerpAPI, Meta Ads, Google Ads, Remotion renders, and anything else that costs real money per invocation — logs a cost tuple at the call site. The observatory watches those tuples for blowouts, drift, and loops; attributes spend to the right actor (SuperBad itself, a paying subscriber, a prospect, or a shared cohort); tracks tier health so pricing stays honest; and surfaces everything through the Daily Cockpit when Andy needs to know.

The observatory is **operator-only**. Subscribers see their own usage through the surfaces already specced in `docs/specs/saas-subscription-billing.md` §5 (sticky bar, soft cap, hard cap with upgrade prompt) — they never see AUD cost figures, the observatory dashboard, or the call log.

The observatory has **two co-equal primary jobs**:

1. **Alarm system.** Catch runaway spend within minutes, not at month-end. Hard per-job ceilings + rate-based loop detection + learned-baseline drift detection, surfaced as severity-tiered banners on the Daily Cockpit with Claude-drafted diagnosis cards and a tier-3 kill switch.
2. **Attribution engine.** Attribute every cost to the right actor so margins, CPA, and tier health are queryable facts rather than guesses. Forensic queryability falls out of both jobs for free.

This spec also owns the **model registry + external-call observability** patch to FOUNDATIONS.md §11 — the shared primitive that every integration (LLM and non-LLM) routes through for logging. That patch was already flagged for Phase 3.5 by memory `project_llm_model_registry.md`; this spec concretises its shape.

---

## 1. Purpose and shape

The observatory is the quietest piece of Lite — it should almost never need Andy's attention. When it does need his attention, the attention should be cheap: one card, one decision, one click. The design centre is *"a roommate who notices the power bill crept up and mentions it once over coffee, not a fire alarm that screams every time the kettle boils"*.

Three posture rules shape every sub-decision:

- **No silent governors on paying subscribers.** Tier caps are enforced explicitly via `checkUsageLimit()` in the features themselves. The observatory never throttles, never caps, never intervenes between a subscriber and a feature they paid for. If a subscriber is unprofitable, the honest answer is to fix the tier design, not to quietly throttle them. (Memory: `project_tier_limits_protect_margin.md`.)
- **Operator trust over operator control.** Internal/prospect/shared spend is never auto-paused by the platform. Andy sets alert thresholds, sees projections, and decides what to do. The kill-switch exists but only fires when Andy chooses it from a tier-3 severe banner.
- **Estimates, not actuals.** v1 logs estimated AUD from pricing formulas per job at the call site. Reconciliation against real vendor invoices is v1.1. We'd rather have near-real-time estimates that are usually within ±15% than a clean monthly reconciliation that tells us about overruns a month after they happened.

---

## 2. The 9 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Primary jobs** | Alarm + attribution co-equal. Forensic queryability falls out free. Three-level-zoom dashboard; Cockpit banner is the alarm surface; tier-health panel is the attribution primary. |
| Q2 | **Actor model** | Four types: `internal` (SuperBad ops), `external` (paying subscriber/client), `shared` (cohort of subscribers), `prospect` (pre-conversion candidate). One row per call. Shared calls carry a nullable ephemeral `shared_cohort_id` (hash of actor list at log time); prorate happens at query time with even split. |
| Q3 | **Anomaly detection** | Three detectors run in parallel: (a) hard thresholds per job (per-call ceiling + daily ceiling), (b) rate detector (loop-catcher — 10× trailing-hour median rate sustained over 5 min, min 20 calls), (c) learned bands (rolling p95 × multiplier, 7-day / 50-call warmup). |
| Q4 | **Banner voice** | Severity-tiered. Low (2–5× drift) → dry-calm house voice. Mid (5–10× drift) → neutral-louder tone with prominent numbers. Severe (10×+ or hard-ceiling breach) → terse, flat, red, zero voice, kill-switch CTA visible. |
| Q5 | **Prospect attribution** | `prospect` is a first-class actor type. Historical prospect-phase spend transfers to the subscriber/client record on conversion (atomic rewrite inside the existing conversion handler, `converted_from_candidate_id` preserved for audit). CPA, CPA-by-channel, CPA-by-ICP-segment, and payback period are all derivable. |
| Q6 | **Attribution response** | Report + recommend. No auto-action, no silent governors. Reoriented around tier health as primary signal (aggregate per-tier margin, % underwater), with per-subscriber recommendation cards **only rendered for top-tier subscribers** (the only case where individual triage is legitimate — all other negative margin is a tier-design bug, surfaced as a tier-level alert instead). |
| Q7 | **Subscriber visibility** | Operator-only costs. Subscribers see product-level usage (SaaS Billing §5 sticky bar + soft/hard cap). No AUD figures ever surface to subscribers. Two separate ledgers: `usage_records` (subscriber-facing, product dimension) and `external_call_log` (operator-facing, AUD + units). Ledgers do not merge. |
| Q8 | **Investigation UX** | Claude diagnosis card on top, raw-data table expandable below. Opus prompt `diagnose-cost-anomaly.ts` reads the last N calls, job registry, deploy feed, prompt version hashes; produces structured hypothesis + confidence + recommended action. Raw-data escape hatch is always one click away. |
| Q9 | **Platform-level safety net** | No auto-pause, no platform-wide hard cap. Andy-set monthly AUD thresholds (up to 3). Banner fires when MTD spend crosses a threshold **or** when linear run-rate projection crosses one before month-end. Subscriber spend is structurally bounded by SaaS tier caps (SaaS Billing §5). |

---

## 3. End-to-end journey

### 3.1 A call happens

A feature somewhere in Lite makes an external call. Example: the outreach writer drafts an email to a prospect.

1. Feature code calls the helper (not the vendor SDK directly): `ai.outreach.writeEmail({ prospect_id, inputs })`.
2. The helper routes through the **model registry** (`lib/ai/models.ts`), which knows this call maps to `job: 'outreach-writer'` and resolves the current Anthropic model ID + pricing.
3. The helper checks `job_disabled_until` on the registry entry. If the job is in a kill-switched state, it returns a typed error (`{ error: 'job_disabled', until: timestamp }`) and the feature handles gracefully.
4. Otherwise, the helper invokes the vendor SDK, measures units (tokens in/out), computes estimated AUD cost via the registered pricing formula, and inserts one row into `external_call_log` with `{ job, actor_type: 'prospect', actor_id: prospect_id, units: {input_tokens, output_tokens, ...}, estimated_cost_aud, created_at, prompt_version_hash }`.
5. Result returned to the feature. Latency overhead is a single indexed insert; measured target is <5ms added per call.

Non-LLM external calls (Stripe, Resend, Twilio, Graph API, Pixieset, SerpAPI, Meta Ads, Google Ads, OpenAI Images, Remotion render batches) follow the same shape. Every vendor SDK is wrapped in a project helper that routes through the registry and logs the cost tuple. **Feature code never imports a vendor SDK directly.**

### 3.2 Detectors run

Three detector workers run on the scheduled-tasks infrastructure owned by Quote Builder.

- **Hard-threshold detector** — fires on every insert (synchronous check on `per_call_ceiling_aud` for the just-logged row) and every 5 minutes (scans trailing 24h spend per job against `daily_ceiling_aud`). Per-call ceiling breaches create an immediate `cost_anomaly` row with tier assigned at detection time.
- **Rate detector** — runs every minute. For each `{job, actor_id}` pair with activity in the last 5 minutes, compares count against 10× the trailing-hour median rate. Minimum 20 calls in the 5-min window before the detector considers it. Breach creates a `cost_anomaly` with `tier: 'severe'` (loop-in-progress is always severe).
- **Learned-band detector** — runs every 15 minutes. For each registered job with >7 days of history and >50 calls, computes rolling p95 of per-call cost over the trailing 14 days. A call exceeding `p95 × multiplier` (default 3) during the warmup-complete period creates a `cost_anomaly` at tier `low` or `mid` depending on severity ratio.

Each detector has a dedupe key: per `{detector, job}` per 24h window. Subsequent fires update the existing `cost_anomaly` row's counter + last-seen timestamp rather than creating new rows. Banner spam is prevented structurally, not through UI suppression.

### 3.3 An anomaly fires → banner surfaces on Cockpit

When a `cost_anomaly` is created (first fire in window), the observatory emits an event consumed by the Daily Cockpit. The Cockpit's `getHealthBanners()` contract (defined in `docs/specs/daily-cockpit.md`) renders a banner per open anomaly.

Banner content per severity:

- **Tier low (dry-calm).** *"Outreach-writer had a big day. $43.80 yesterday against $6-ish normal. Worth a look."* Single action: *Take a look* → opens observatory dashboard filtered to this anomaly.
- **Tier mid (neutral-louder).** *"Outreach-writer spent $87 in the last 24 hours. Usual band is $4–$8. 11× over."* Actions: *Investigate* + *Acknowledge & suppress 24h*.
- **Tier severe (terse-flat-red).** *"Hard ceiling breached. Outreach-writer: $340.12 today vs $15 ceiling."* Actions: *Kill switch* (immediate, one click, logged, disables the job until Andy re-enables from the dashboard) + *Investigate* + *Acknowledge & suppress 24h*.

Severe anomalies also trigger an immediate email to Andy via `sendEmail({ classification: 'transactional' })` so he sees the alert even when he's away from the platform.

### 3.4 Andy investigates

Clicking *Investigate* opens the anomaly detail view at `/lite/observatory/anomalies/[id]`.

**Top of page: Claude diagnosis card.** Opus prompt `diagnose-cost-anomaly.ts` has already run (fired as a scheduled task the moment the anomaly was created; result cached on the `cost_anomaly` row). Card shows:

- **Hypothesis.** One-paragraph plain-English explanation of what appears to have happened. Written in dry-calm house voice, regardless of banner tier. Example: *"Average tokens per call doubled from 820 to 1,710 starting 2:14pm today. Looking at the calls, outreach-writer started receiving the full email thread as context instead of just the subject line. The prompt template version changed at 2:08pm — likely a regression from the deploy 6 minutes earlier."*
- **Confidence badge.** High / med / low. Prominent, coloured.
- **Recommended action.** One of: acknowledge (benign), investigate further (ambiguous), kill-switch (likely regression or loop). Not auto-executed.
- **Timeline of contributing factors.** Deploy events, prompt-version bumps, cost-model updates in the trailing 24 hours.

**Below the card: raw-data table.** Collapsed by default. Expand shows the last 100 calls for this `{job, actor_id}` combination, with timestamp, actor, units, AUD cost, prompt version hash, and the stack origin if captured. Sortable, filterable by actor type.

**Below that: one-click band editor.** A small inline form: *"If this is a new normal, raise the band."* Andy can push the per-call ceiling or daily ceiling up (or down) directly from the anomaly detail. Changes log to `activity_log` with a `band_adjusted` kind so tuning history is auditable.

### 3.5 Month-to-date projection tile

The observatory dashboard's top tile is always-visible platform status, not just alarms:

- **MTD spend.** Sum of `estimated_cost_aud` across every `external_call_log` row this month.
- **Projection.** Linear run-rate: `MTD ÷ days elapsed × days in month`.
- **Thresholds.** Three Andy-set numbers rendered as ticks on a horizontal bar; MTD is a solid fill; projection is a dashed-line overhang. Green below first threshold, amber between thresholds, red over.
- **If projection crosses a threshold that MTD hasn't yet.** A mid-tier banner fires with run-rate framing: *"At current pace you'll land around $640 this month. You set a flag at $500."* Dedupe: one banner per projected-threshold crossing per month.

### 3.6 A prospect converts

When a candidate converts to a paying subscriber (via trial-shoot → retainer, SaaS signup, direct onboarding, or legacy entry), the conversion handler — already responsible for promoting the candidate to `contacts` + creating `deals` / subscriptions — also runs a single SQL transaction that:

1. Rewrites every `external_call_log` row where `actor_type = 'prospect' AND actor_id = candidate.id` to `actor_type = 'external', actor_id = new_subscriber_or_client_id`.
2. Sets `converted_from_candidate_id = candidate.id` on those rewritten rows.
3. Logs `activity_log.kind = 'cost_attribution_transferred'` with the count of rows rewritten.

The rewrite is atomic with the conversion itself — if conversion fails, rewrite is rolled back. Aggregates then roll forward cleanly: once 180 days pass, the rewritten rows roll up into daily aggregates under the new identity, preserving CPA forever.

---

## 4. Data model

### 4.1 New tables

**`external_call_log`** — the primary ledger. One row per external call.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `job` | text | Must match a registered job key. Required. Enforced by the call-site wrapper. |
| `actor_type` | enum | `'internal' \| 'external' \| 'shared' \| 'prospect'`. |
| `actor_id` | text, nullable | Subscriber id / client id / candidate id / null (for `internal` or shared-with-no-cohort). |
| `shared_cohort_id` | text, nullable | Hash of actor array at log time, or null. |
| `units` | json | Vendor-dependent structure: `{input_tokens, output_tokens}` for LLM, `{count: 1}` for Stripe/Resend/Twilio, `{render_seconds}` for Remotion, etc. |
| `estimated_cost_aud` | decimal(10,4) | Computed by the pricing formula registered with the job. |
| `prompt_version_hash` | text, nullable | For LLM jobs — lets the diagnoser correlate spikes with prompt changes. |
| `converted_from_candidate_id` | text, nullable | Set during conversion rewrite, preserves audit trail. |
| `created_at` | timestamp | Indexed. |

Indexes: `(job, created_at)`, `(actor_id, created_at)`, `(actor_type, created_at)`.

**`cost_anomalies`** — detected anomalies.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `detector` | enum | `'hard_threshold' \| 'rate' \| 'learned_band'`. |
| `job` | text | The job that breached. |
| `actor_scope` | json, nullable | Optional `{actor_type, actor_id}` if the detector fires per-actor (rate detector does). Null if job-wide. |
| `tier` | enum | `'low' \| 'mid' \| 'severe'`. |
| `first_fired_at` | timestamp | |
| `last_fired_at` | timestamp | Updated on dedupe hits. |
| `fire_count` | int | Updated on dedupe hits. |
| `observed_value` | decimal | The value that breached (e.g. $87 daily spend). |
| `expected_band` | json | Snapshot of the band at detection time. |
| `diagnosis_json` | json, nullable | Opus-generated hypothesis + confidence + recommendation. Null until diagnoser runs. |
| `diagnosis_cost_aud` | decimal, nullable | Self-referential — the cost of running the diagnosis itself. |
| `acknowledged_at` | timestamp, nullable | Andy's one-click acknowledgement. |
| `acknowledged_until` | timestamp, nullable | 24h suppression window. |
| `kill_switch_triggered_at` | timestamp, nullable | |
| `resolved_at` | timestamp, nullable | Set automatically when the underlying condition stops firing for 24h. |

**`deploy_events`** — Vercel deploy webhook target.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `commit_sha` | text | |
| `deployed_at` | timestamp | |
| `status` | enum | `'deploying' \| 'ready' \| 'failed'`. |
| `preview_url` | text, nullable | |

Feeds the diagnoser's "recent deploy" context.

**`observatory_settings`** — single-row table for Andy-configurable knobs.

| Column | Type | Notes |
|---|---|---|
| `id` | int pk (always 1) | |
| `monthly_threshold_1_aud` | decimal, nullable | Lowest alert threshold (e.g. $250). |
| `monthly_threshold_2_aud` | decimal, nullable | Middle threshold. |
| `monthly_threshold_3_aud` | decimal, nullable | Highest threshold. |
| `projection_alert_enabled` | boolean | Default true. |
| `weekly_digest_enabled` | boolean | Default true. |
| `updated_at` | timestamp | |

### 4.2 Job registry (lib/ai/models.ts + lib/integrations/registry.ts)

Not a SQL table — a TypeScript module loaded at startup. Every external-call job is declared here. Adding a new job is a code change, not a runtime operation.

Shape per entry:

```
{
  key: 'outreach-writer',                    // unique string, becomes external_call_log.job
  vendor: 'anthropic',                        // free-form grouping for dashboard
  current_model_id: 'claude-opus-4-6',        // resolved at call time
  pricing_formula: computeAnthropicCost,     // (units) => aud
  bands: {
    per_call_ceiling_aud: 0.15,
    daily_ceiling_aud: 50,
    learned_band_multiplier: 3,
    rate_override: null,                      // override default rate detector window
  },
  prompt_version_hash: 'sha256:...',          // updated on every prompt edit
  job_disabled_until: null,                   // kill-switch state, nullable timestamp
  description: 'Cold outreach email writer for prospect track',
}
```

Bands are **required at registration time** — a job without bands fails type-check. The "Unknown job" trap: if `external_call_log.insert()` is called with a `job` key not in the registry, the insert still succeeds (so we never lose a call), but the row is logged with a synthetic tier-severe `cost_anomaly` flagging the missing registration. In development, the same case throws hard.

**Registered jobs inventory (consolidated 2026-04-13 Phase 3.5; reconciled with `lib/ai/prompts/INDEX.md` 2026-04-13 Batch C step 9).** This is the authoritative list of every job name that exists across the locked specs. Phase 5 foundation session seeds the registry from this list. New specs extend; they do not fork.

**Naming convention.** Each job name in this list is the canonical key in `lib/ai/models.ts`. Where a prompt file exists at `lib/ai/prompts/<slug>.ts`, its slug **is** the job name (1:1) — see `lib/ai/prompts/INDEX.md`. Jobs without a prompt file (system-level prompts embedded in code, or stub files still owed) are listed below with `[stub owed]` or `[code-embedded]`. Phase 5 build sessions for each owner spec extract any inline prompt text into the named stub before shipping.

*Anthropic LLM jobs (per-spec owners):*
- **Lead Generation:** `lead-gen-outreach-draft` (Opus), `lead-gen-reply-classifier` (Haiku) [stub owed], `lead-gen-icp-scorer` (Haiku) [stub owed]
- **Brand DNA:** `brand-dna-generate-prose-portrait` (Opus), `brand-dna-generate-section-insight` (Opus), `brand-dna-generate-first-impression` (Opus), `brand-dna-generate-company-blend` (Opus), `brand-dna-generate-retake-comparison` (Opus)
- **Client Context Engine:** `client-context-summarise` (Haiku), `client-context-extract-action-items` (Haiku), `client-context-draft-reply` (Opus), `client-context-regenerate-draft-with-nudge` (Opus), `client-context-reformat-draft-for-channel` (Haiku)
- **Quote Builder:** `quote-builder-draft-from-context` (Opus), `quote-builder-draft-intro-paragraph` (Opus), `quote-builder-draft-send-email` (Opus), `quote-builder-draft-scope-summary` (Haiku), `quote-builder-draft-pdf-cover-line` (Opus, rotation-pool variant optional), `quote-builder-draft-settle-email` (Opus), `quote-builder-draft-cancel-intercept-email` (Opus)
- **Branded Invoicing:** `invoice-draft-send-email` (Opus), `invoice-draft-reminder` (Opus), `invoice-draft-supersede-notification` (Haiku)
- **Content Engine:** `content-score-keyword-rankability` (Haiku), `content-generate-topic-outline` (Haiku), `content-generate-blog-post` (Opus), `content-rewrite-for-newsletter` (Haiku), `content-generate-social-draft` (Haiku), `content-select-visual-template` (Haiku), `content-generate-image-prompt` (Haiku), `content-match-content-to-prospects` (Haiku), `content-draft-outreach-email` (Opus), `content-generate-embed-form-styles` (Haiku)
- **Unified Inbox:** `inbox-classify-inbound-route` (Haiku), `inbox-classify-notification-priority` (Haiku), `inbox-classify-signal-noise` (Haiku), `inbox-threading` (Haiku) [stub owed], `inbox-reply-suggest` (Sonnet) [stub owed]
- **Daily Cockpit:** `cockpit-brief` (Opus for morning slot, Sonnet for midday/evening — slot is a parameter, not a separate job), `cockpit-narrative-regen` (Sonnet) [stub owed — fires from `maybeRegenerateBrief()` on material events]
- **Intro Funnel:** `intro-funnel-signal-tag-extraction` (Haiku), `intro-funnel-reflection-synthesis` (Opus), `intro-funnel-retainer-fit-recommendation` (Opus), `intro-funnel-abandon-email` (Haiku), `intro-funnel-apology-email` (Haiku)
- **Six-Week Plan Generator:** `six-week-plan-strategy` (Opus), `six-week-plan-weeks` (Opus), `six-week-plan-review` (Haiku), `six-week-plan-revision-reply` (Haiku)
- **Cost Observatory:** `observatory-diagnose-cost-anomaly` (Opus), `observatory-draft-negative-margin-email` (Opus), `observatory-draft-weekly-digest` (Haiku)
- **Surprise & Delight:** `delight-voice-line-generate` (Haiku) [stub owed — single short prompt for ambient line generation; may consolidate to `[code-embedded]` if final design uses inline rotation pools]
- **Setup Wizards** (added 2026-04-13): `admin-setup-assistant` (Opus) [stub owed — `lib/ai/prompts/admin-setup-assistant.ts`] — contextual chat helper that opens after two consecutive step failures in admin wizards; reads wizard state + error payload + thread history
- **Finance Dashboard** (added 2026-04-13): `finance-draft-narrative` (Haiku) — regenerates the finance narrative tile on material events; follows the `maybeRegenerateBrief()` pattern
- **Hiring Pipeline** (added 2026-04-13): `hiring-brief-synthesize` (Sonnet) [stub owed], `hiring-discovery-agent` (Sonnet, web-search enabled) [stub owed], `hiring-candidate-score` (Haiku) [stub owed], `hiring-invite-draft` (Sonnet) [stub owed], `hiring-followup-question-draft` (Haiku) [stub owed], `hiring-trial-task-author` (Sonnet) [stub owed], `hiring-portfolio-ingest-vision` (Sonnet vision) [stub owed], `hiring-archive-reflection-ingest` (Haiku) [stub owed]
- **Client Management** (added 2026-04-13 Batch C): `client-mgmt-bartender-opening-line` (Haiku) — single-line bartender greeting; **kickoff-variant branch** (added 2026-04-13 Step 11 Stage 4 F4.b) fires once on first retainer-mode login post-Brand-DNA-gate-clear, surfaces first-shoot-scheduling as primary next action, stamped by `contacts.retainer_kickoff_bartender_said_at`. Variant selection lives inside the prompt file. `client-mgmt-chat-response` (Opus) — multi-turn bartender chat. `client-mgmt-escalation-summary` (Haiku) — concise factual summary for Andy on bartender-flagged escalations.
- **Task Manager** (added 2026-04-13 Batch C): `task-manager-parse-braindump` (Haiku) — parses freeform braindump text into structured tasks.
- **Brand-voice drift check (universal, §11.5):** `voice-drift-check` (Haiku) [code-embedded — the drift-check prompt is part of the `checkBrandVoiceDrift()` primitive defined in FOUNDATIONS §11.5; no separate `lib/ai/prompts/` file is owed]

*Non-LLM integration-registry read jobs (same cost log, no Anthropic cost):*
- **Stripe** (added 2026-04-13 per Finance Dashboard): `stripe-balance-read`, `stripe-balance-transactions-read`
- **Resend:** `resend-send`, `resend-inbound-parse`
- **Microsoft Graph:** `graph-mail-read`, `graph-mail-send`, `graph-subscription-renew`
- **Pixieset / Meta Ads / Google Ads / SerpAPI / OpenAI Images / Remotion** — one `<vendor>-<operation>` pair per integration.

### 4.3 New columns on existing tables

- **`activity_log.kind`** gains values: `cost_anomaly_fired`, `cost_anomaly_acknowledged`, `cost_anomaly_resolved`, `kill_switch_triggered`, `kill_switch_released`, `band_adjusted`, `monthly_threshold_crossed`, `projection_threshold_crossed`, `cost_attribution_transferred`, `observatory_settings_changed`. (10 values.)
- **No changes to `contacts`, `companies`, or `deals`** from this spec directly. All actor attribution works via `actor_id` referencing those tables' ids.

---

## 5. Observatory dashboard (`/lite/observatory`)

Single route, four panels vertically stacked. Admin-only auth. No mobile priority — Andy reviews on desktop.

### 5.1 Panel 1 — Platform status (top, always visible)

- MTD spend tile: big number, sparkline of daily totals for the month.
- Projection tile: run-rate projection, threshold ticks, green/amber/red fill.
- Live kill-switches: if any jobs are currently kill-switched, they render here with a one-click resume button. Empty state: *"Nothing paused. Running clean."*
- Weekly delta: this-week vs last-week spend, percentage change, dry.

### 5.2 Panel 2 — Tier health (the attribution primary)

- One card per SaaS tier (Small / Medium / Large).
- Per card: subscriber count, total tier revenue this month, average margin per subscriber, % of subscribers underwater.
- Health indicator: green (healthy), amber (drifting), red (structurally underwater — tier design needs rethink).
- Red tier state also triggers a dashboard-level banner: *"Medium tier has 34% of subscribers underwater this month. The tier design may need restructuring."* Deduped per calendar month.
- Expand a card → list of subscribers on that tier, sorted by margin ascending.
- Per-subscriber recommendation cards **only render for Large-tier subscribers in negative margin**. Each card shows: cost breakdown by job, top 3 drivers, three Andy-actionable options (cap conversation / renegotiate to custom arrangement / accept as goodwill), and Opus-drafted draft emails for options 1 and 2 that Andy can review and send from the card.

### 5.3 Panel 3 — Live anomalies

- List of `cost_anomalies` with `resolved_at IS NULL`, ordered by tier DESC, then `last_fired_at` DESC.
- Each row: tier badge, job, scope (global / per-actor), observed value, first/last fired, fire count, diagnosis snippet (first 15 words), actions (Investigate / Acknowledge / Kill switch).
- Resolved anomalies in the last 7 days shown in a collapsed "resolved" section below.

### 5.4 Panel 4 — Top jobs this month

- Table: job, vendor, total calls this month, total AUD this month, average AUD per call, trailing-week trend sparkline.
- Sortable by any column.
- Clicking a row opens `/lite/observatory/jobs/[key]` with a detailed view: full call history paginated, band editor, prompt-version history (for LLM jobs), deploy correlation overlay.

### 5.5 Settings — `/lite/observatory/settings`

- Three AUD threshold fields.
- Projection alert toggle.
- Weekly digest toggle.
- List of all registered jobs with their current bands, inline-editable. Changes logged to `activity_log.kind = 'band_adjusted'`.

---

## 6. Banner contract with Daily Cockpit

The Daily Cockpit's `getHealthBanners()` returns an array of active health banners on every render. This spec provides the following contract:

```
type ObservatoryBanner =
  | { kind: 'cost_anomaly', tier: 'low' | 'mid' | 'severe', anomaly_id: string, body: string, actions: Action[] }
  | { kind: 'monthly_threshold', threshold_aud: number, current_mtd_aud: number, actions: Action[] }
  | { kind: 'projection_threshold', threshold_aud: number, projected_aud: number, days_remaining: number, actions: Action[] }
  | { kind: 'tier_health', tier_name: string, percent_underwater: number, actions: Action[] }
  | { kind: 'unknown_job', job_key: string, actions: Action[] }
```

The Cockpit renders these with its existing banner system; visual treatment is a responsibility of the Cockpit spec. Severity-tier styling (low/mid/severe) is inherited from the cost_anomaly case; the other four kinds default to mid-tier unless escalated.

Daily Cockpit's `docs/specs/daily-cockpit.md` banner treatment section will be patched in Phase 3.5 to include this contract.

---

## 7. Claude prompts (new)

All prompts go through the brand-voice drift check (FOUNDATIONS §11.5) and route via the model registry.

1. **`diagnose-cost-anomaly.ts`** (Opus). Inputs: anomaly row, last 100 calls for the implicated job/actor, registry entry snapshot, deploy events in trailing 24h, prompt-version history. Output (structured JSON): `{ hypothesis, confidence: 'high' | 'med' | 'low', recommended_action, timeline_markdown }`.
2. **`draft-negative-margin-email.ts`** (Opus). Generates two draft emails per recommendation card: option 1 "cap conversation" and option 2 "renegotiate to custom arrangement". Reads Brand DNA + Client Context Engine for the recipient. Drift-checked.
3. **`draft-weekly-digest.ts`** (Haiku). Generates the Sunday evening email digest. Template-heavy (tier health summary, top jobs, anomalies, MTD vs projection) but prose glue is Haiku-drafted. Drift-checked.

---

## 8. Integrations — what every vendor logs

Every external-call wrapper passes through the registry. Here's the coverage that must exist on day one:

| Vendor | Jobs logged | Actor attribution rule |
|---|---|---|
| **Anthropic** | `outreach-writer`, `reply-classifier`, `icp-scorer`, `brand-dna-generator`, `brand-dna-section-insight`, `brand-dna-prose-portrait`, `client-context-summariser`, `client-context-extractor`, `client-context-drafter`, `portal-bartender-opener`, `portal-bartender-chat`, `cockpit-morning-brief`, `cockpit-midday-brief`, `cockpit-evening-brief`, `quote-draft-from-context`, `quote-intro-paragraph`, `quote-send-email`, `quote-scope-summary`, `quote-pdf-cover-line`, `quote-settle-email`, `quote-cancel-intercept-email`, `invoice-email`, `invoice-reminder`, `invoice-supersede-notification`, `intro-funnel-claude-synthesis`, `intro-funnel-retainer-fit`, `inbox-reply-drafter`, `inbox-routing-suggestion`, `content-draft-generator`, `content-fan-out`, `content-newsletter-body`, `anomaly-diagnoser`, `negative-margin-email-drafter`, `weekly-digest-drafter`, `ad-creative-writer`, `ad-rationale-doc` | Based on the call context: portal chat → `external`, actor_id = subscriber; outreach → `prospect`; Andy admin actions → `internal`; cross-subscriber cron jobs → `shared` with cohort id. |
| **OpenAI Images** | `content-hero-image`, `content-og-image`, `brand-dna-question-visual` | Follows the triggering call's attribution. |
| **Stripe** | `stripe-invoice-create`, `stripe-subscription-create`, `stripe-subscription-update`, `stripe-payment-intent`, `stripe-customer-create`, `stripe-customer-portal-session`, `stripe-webhook-ingest` | `external` for per-subscriber/client operations; `internal` for admin creation; `prospect` for Intro Funnel trial-shoot payments (rewrites on conversion). |
| **Resend** | `resend-transactional-send`, `resend-outreach-send`, `resend-digest-send` | `external` for client emails, `internal` for Andy-ops emails, `prospect` for outreach. Classification (transactional/outreach) also passed to `sendEmail()` per FOUNDATIONS §11.2 patch. |
| **Twilio** | `twilio-sms-send` | `prospect` for Intro Funnel abandon cadence, `external` for client comms. |
| **Graph API** | `graph-message-fetch`, `graph-message-send`, `graph-subscription-renew` | `internal` (Unified Inbox is Andy's tool). |
| **Pixieset** | `pixieset-gallery-fetch`, `pixieset-gallery-create` | `prospect` (for trial-shoot galleries pre-conversion), `external` (for client galleries post-conversion). |
| **SerpAPI** | `serpapi-keyword-search`, `serpapi-ranking-check` | `shared` when batch for Content Engine across subscribers with cohort id; `external` for single-subscriber checks. |
| **Meta Ads API** | `meta-campaign-create`, `meta-creative-upload`, `meta-insights-fetch` | `internal` for SuperBad's own ads, `external` for per-client campaigns, `prospect` for trial-shoot retargeting. |
| **Google Ads API** | `google-campaign-create`, `google-creative-upload`, `google-insights-fetch` | Same rule as Meta. |
| **Remotion** | `remotion-video-render`, `remotion-template-compile` | Matches the triggering call's attribution (usually `external` for SaaS Content Engine subscribers). |
| **Vercel (deploy webhook)** | `deploy-event-ingest` | `internal`. Zero cost — the log entry exists so the deploy timeline is queryable from the observatory. |

**Phase 3.5 backward reconciliation pass must diff each of the above specs** for missing actor_type/actor_id specification at call sites, as called out in the memory `project_llm_model_registry.md`. Any call site that isn't explicit about what actor type it's passing is a bug.

---

## 9. FOUNDATIONS.md §11 patch (owed, authored by this spec)

This spec's build Phase 5 session A includes the FOUNDATIONS patch. Summary of what the patch adds:

- **New §11 principle: "Every external call routes through the model/integration registry."** Feature code never imports `@anthropic-ai/sdk`, `stripe`, `resend`, `twilio`, etc. directly. All imports live in the registry module; feature code imports named job helpers.
- **New §11 principle: "Every external call logs a cost tuple at the call site."** Enforced by the wrapper (insert fails if any required field is missing in development; falls through to a synthetic unknown-job anomaly in production).
- **New §11 principle: "Jobs declare bands at registration time."** Bands are required; missing bands fail build.
- **New §11 principle: "Quarterly model/version review ritual."** Phase 6 owned. Add a calendar reminder: review model IDs, Stripe API version, Resend, Meta/Google Ads SDK versions, pricing formulas.
- **New §11 section: Unified send-gate classification.** Extends the `sendEmail()` signature already owed from Task Manager spec: `classification: 'transactional' | 'outreach'` is now a required parameter. Transactional bypasses the gate (legal + compliance obligation); outreach passes through the send-gate's rules. This patch was already on the owed list; this spec rolls it in.

---

## 10. Cross-spec flags (for Phase 3.5 reconciliation)

The Phase 3.5 backward pass needs to verify the following changes land in the referenced specs:

1. **Every locked integration-using spec** (lead-generation, intro-funnel, quote-builder, branded-invoicing, brand-dna-assessment, client-context-engine, client-management, saas-subscription-billing, content-engine, unified-inbox, daily-cockpit, task-manager, onboarding-and-segmentation, surprise-and-delight) must specify, at each external-call site, the `actor_type` and `actor_id` it passes. This is the "missing actor attribution" review called out by `project_llm_model_registry.md`.
2. **Daily Cockpit** must patch to include the `ObservatoryBanner` union in its `getHealthBanners()` contract (§6 above).
3. **SaaS Subscription Billing** must add a note clarifying that `usage_records` and `external_call_log` are separate ledgers with distinct purposes, so future developers don't try to merge them.
4. **Lead Generation** must specify that the conversion handler (candidate → subscriber/client) runs the prospect-phase rewrite transaction atomically. Lead Gen owns the promotion code path; this spec owns the rewrite function the handler calls.
5. **Intro Funnel** must specify that trial-shoot payments log Stripe calls with `actor_type: 'prospect', actor_id: candidate.id` until the candidate converts.
6. **Every spec with LLM calls** must declare a `prompt_version_hash` convention — any prompt template change increments a hash constant imported from the registry.
7. **Surprise & Delight** — no changes needed. Observatory surfaces are fully operator-facing; the closed-list ambient voice lives on subscriber-facing surfaces only.
8. **FOUNDATIONS.md** patch list (above) is authored and applied by Phase 5 session A of this spec.

---

## 11. Voice & delight treatment

Observatory surfaces are **operator-only and information-dense**. Voice applies lightly and only where it helps comprehension:

- **Tier-low and tier-mid banner bodies.** Dry house voice. Calibrated down — the banner is signal, not entertainment. Voice is the frame, numbers are the content.
- **Tier-severe banner bodies.** Terse and flat. Voice steps out of the way. Red colour treatment + direct action CTA. No punchlines. Example: *"Hard ceiling breached. Outreach-writer: $340.12 today vs $15 ceiling."* Full stop.
- **Claude diagnosis cards.** Dry-calm house voice throughout, regardless of tier. Hypothesis delivered with confidence where warranted, hedged where not. Never jokey — diagnosis is a service moment.
- **Projection framing.** *"At current pace you'll land around $640 this month. You set a flag at $500."* Matter-of-fact, projecting forward, not alarming.
- **Empty states.** *"Nothing paused. Running clean."* / *"No anomalies this week. Everything inside the bands."* Dry-calm, reassuring by virtue of being honest and short.
- **Weekly digest email.** Full house voice — this is the one surface where voice leads, because the digest is a Sunday-evening read and Andy is choosing to engage. Subject line sprinkle-claimed in a content mini-session below. Tone: dry observer, modest numbers, honest about drift.

**Closed-list ambient slots this spec consumes:** one — the observatory dashboard's empty-state and between-session voice. Not a new slot; rides under the existing "internal ops copy" category.

**Hidden eggs this spec fires:** zero. Observatory is an admin surface; admin eggs are handled separately via the Surprise & Delight admin-egg expansion brainstorm.

**New sprinkle claims:** one — the weekly digest email subject line (*"the observatory report"* pool, dry rotation, calibrated to MTD posture: calm if green, observant if amber, direct if red). Claimed in the content mini-session.

---

## 12. Content authoring mini-session owed

A small-to-medium content session. Produces:

- **Tier-low banner body pool (~10 variants).** Stratified by job family (LLM / payments / comms / media rendering).
- **Tier-mid banner body pool (~8 variants).** Same stratification.
- **Tier-severe banner body pool (~5 variants).** Flat, terse, no voice — these are essentially templated around the breached metric.
- **Diagnosis card hypothesis prompt calibration.** Run the Opus prompt against 8–10 synthetic anomaly scenarios (prompt regression, loop, model upgrade, data spike, third-party price change, ambiguous drift, warmup-fresh false positive, multi-job cascade). Tune prompt until hypotheses are consistently accurate and appropriately confident.
- **Dashboard empty-state copy (~6 surfaces).** Observatory landing, tier-health all-green, anomalies list empty, top-jobs loading, settings blank slate, kill-switches empty.
- **Weekly digest email copy framework.** Subject-line pool (~5 variants, sprinkle-claimed), opener pool (~6 variants), section headings, closer pool.
- **Threshold-crossed and projection-crossed banner copy.** Dry-calm, honest, projecting framing.
- **Kill-switch confirmation modal copy.** Terse. Example: *"Disable outreach-writer. Nothing will call it until you re-enable. Confirm."*
- **Resume-from-kill-switch confirmation.** One-line, dry. Example: *"Bringing outreach-writer back. Last spike was 3 hours ago."*

Must run before Phase 5 session B (detectors + banners) of this spec.

---

## 13. Phase 5 sizing

Three build sessions, sequenced.

**Session A — Logging primitives + registry + FOUNDATIONS patch.** Medium-large.
- Create `external_call_log`, `cost_anomalies`, `deploy_events`, `observatory_settings` tables + Drizzle migrations.
- Build `lib/ai/models.ts` and `lib/integrations/registry.ts` — the job/vendor registry.
- Wrap every vendor SDK in a project helper that routes through the registry + logs the cost tuple. This is the widest-touch piece — every integration needs its wrapper written, every feature call site updated to use the wrapper.
- Extend `sendEmail()` with the `classification` parameter (owed from Task Manager; rolled in here).
- Implement Vercel deploy webhook → `deploy_events`.
- Write FOUNDATIONS.md §11 patch.
- Phase 3.5 cross-spec flags addressed: every integration spec reviewed for actor attribution at call sites.
- Typecheck + unit tests for the wrapper (band-required at registration, unknown-job trap, tuple-completeness at insert).

**Session B — Detectors + banners + diagnosis prompt.** Medium.
- Three detector workers on the scheduled-tasks infrastructure.
- Dedupe logic + `cost_anomaly` upsert patterns.
- `diagnose-cost-anomaly.ts` Opus prompt + calibration against the content-session scenarios.
- Banner contract wiring into Daily Cockpit's `getHealthBanners()`.
- Severe-tier immediate email dispatch via `sendEmail({ classification: 'transactional' })`.
- Kill-switch toggle plumbing end-to-end.
- Prompt-version-hash tracking per job.

**Session C — Observatory dashboard + settings + digest.** Medium.
- Four-panel dashboard at `/lite/observatory`.
- Anomaly detail view at `/lite/observatory/anomalies/[id]` (diagnosis card + raw-data expandable + band editor).
- Job detail view at `/lite/observatory/jobs/[key]`.
- Settings page at `/lite/observatory/settings`.
- Projection algorithm + MTD tile + threshold bar visualisation.
- Tier-health panel with Large-tier per-subscriber recommendation cards.
- `draft-negative-margin-email.ts` Opus prompt.
- Weekly digest email template + `draft-weekly-digest.ts` Haiku prompt + Sunday evening scheduled task.
- Manual testing: simulate anomalies across all three detectors, verify banner surfaces, verify kill-switch round-trip, verify prospect-conversion rewrite.

Sessions A and B are partially parallelisable; session C depends on B.

---

## 14. Build risks and mitigations

- **Band miscalibration during the first 4–8 weeks.** Every declared band is a guess at launch. Risk: alert fatigue. Mitigation: one-click band editor on every anomaly detail view, logged to `activity_log` so tuning history is auditable. Andy is expected to tune bands actively during weeks 1–8; a simple "band tuning dashboard" tile surfacing the top-5 recently-tuned bands keeps the process visible.
- **Call-site discipline.** If any vendor SDK gets imported directly by feature code, that call silently bypasses the observatory. Mitigation: the registry module is the only module that imports vendor SDKs; an ESLint rule forbids direct imports from feature code; Phase 5 Session A includes a full sweep of the codebase for pre-existing direct imports to rewrite. Phase 3.5 reviewed every spec for explicit actor attribution; Session A reviews every implementation.
- **Cost estimation drift.** Pricing formulas drift when vendors update their pricing (Anthropic has done so multiple times). Mitigation: pricing formulas carry a version field; quarterly review ritual (FOUNDATIONS §11 patch) catches drift. v1.1 reconciliation with actual vendor invoices would catch drift faster but is explicitly out of v1 scope.
- **Diagnosis hallucination.** Claude can produce a confident-sounding but wrong diagnosis. Mitigation: confidence badge is prominent; raw-data table is always one click away; content mini-session calibrates the prompt against synthetic scenarios before launch; Andy's band-edit and kill-switch decisions remain manual.
- **Prospect-to-subscriber rewrite atomicity.** If conversion fails partway, attribution breaks. Mitigation: single SQL transaction inside the existing conversion handler; unit-tested with seed data.
- **Recursive diagnosis loop.** The anomaly-diagnoser's own Opus calls are logged. If diagnoser cost spikes (e.g. too many simultaneous anomalies), it could trigger its own anomaly. Mitigation: diagnoser has a per-hour max-calls cap in the registry; a diagnoser-triggered anomaly on the diagnoser itself is dedupe-collapsed to a single severe banner with a different code path that Andy investigates manually.
- **Phase 3.5 backward pass load.** This spec mandates a review of 14+ other specs for actor attribution. Mitigation: the review is checklist-driven and lightweight (find every external-call reference, verify actor_type/actor_id is stated); Phase 3.5 sizing explicitly accounts for this.

---

## 15. Out of scope (v1)

- **Auto-pause / auto-throttle / silent governors.** Explicitly prohibited by `project_tier_limits_protect_margin.md` and Andy's Q9 direction.
- **Subscriber-facing cost exposure.** Subscribers see usage in product terms only (SaaS Billing §5). No AUD figures surface to subscribers under any circumstances.
- **Actual-vs-estimated reconciliation.** v1.1. v1 logs estimated cost only.
- **Per-dimension weighted proration of shared-cohort spend.** v1 is even-split. Weighted proration (e.g. by `usage_records` draws) is v1.1 if there's an honest need.
- **Time-of-month or day-of-week projection seasonality.** v1 is linear run-rate. v1.1 if linear is consistently off.
- **Platform-wide hard monthly cap.** Andy explicitly declined this in Q9.
- **Per-subscriber recommendation cards for Small and Medium tiers.** Only Large-tier cards render. Small/Medium negative margin surfaces as a tier-level alert.
- **Named cohorts.** v1 uses ephemeral hashed `shared_cohort_id` at log time. First-class named cohorts in a `cost_cohorts` table are v1.1 if they emerge naturally.
- **Aggregate pricing-strategy recommendations (Q1 option D).** Belongs to the v1.1 Strategic Planning feature (`project_strategic_planning_postlaunch.md`), which will consume observatory data.
- **Mobile-first UI for the dashboard.** Observatory is desktop-primary.
- **External observability integrations (Datadog, Sentry, Grafana, etc.).** Lite owns its own observability; no external dashboards.
- **Real-time streaming log tail.** The dashboard polls every 30s; no WebSocket log streaming. v1.1 if there's a need.
- **Per-environment separation (staging vs production observability).** Staging will just log to the same tables (or its own SQLite file); no environment segmentation in v1.

---

## 16. Future work (v1.1 and beyond)

- Actual-vs-estimated reconciliation via Anthropic / Stripe / Resend / OpenAI / Meta / Google Ads billing APIs. Auto-tunes pricing formulas. Flags estimation drift.
- Weighted-proration of shared-cohort spend (by usage_records draw, or by explicit weight at log time).
- Time-of-month and day-of-week projection seasonality.
- Confidence-gated auto-acknowledgement for high-confidence benign anomalies (e.g. "outreach list was 3× normal size because of a new vertical onboarding today").
- Aggregate pricing recommendations — the observatory-fed input to the Strategic Planning v1.1 feature.
- Named cohorts (`cost_cohorts` table).
- Cost-per-feature ROI panel — revenue attributed to outputs of each feature vs cost of running that feature.
- Per-subscriber cost deltas on upgrade/downgrade — "was costing $X on Medium, now costs $Y on Large, margin went from -$2 to +$14".
- Per-prompt cost trend lines — a chart showing prompt-version-hash changes against average cost per call over time, to catch regression.

---

## 17. Success criteria

A build of this spec is "done" when all of the following are true:

1. Every external-call site in Lite routes through the registry and logs a cost tuple. No direct vendor SDK imports in feature code (verified by ESLint rule).
2. Typecheck passes; job registration fails build if bands are missing.
3. The "unknown job" trap fires correctly in development (throw) and production (synthetic anomaly).
4. Three detectors run on schedule; each has a manual trigger for testing.
5. Anomaly banners surface on the Daily Cockpit via the `getHealthBanners()` contract across all three tiers with appropriate visual treatment.
6. Tier-severe banners trigger an immediate transactional email to Andy.
7. Kill-switch round-trip works: severe banner → one-click disable → vendor calls return typed error → Andy re-enables from dashboard → calls resume.
8. Claude diagnosis card renders with hypothesis, confidence, and recommendation within 30 seconds of anomaly creation.
9. Raw-data table expands and shows accurate per-call metadata.
10. Band editor adjusts bands inline and logs to `activity_log`.
11. MTD tile and projection tile reflect real data; threshold-crossing and projection-crossing banners fire correctly.
12. Tier-health panel renders per-tier margins from real data; Large-tier negative-margin subscribers render recommendation cards with Opus-drafted emails.
13. Prospect-to-subscriber rewrite transaction runs atomically inside the conversion handler and is verified against seed data.
14. Weekly digest email fires Sunday evening with correct content.
15. FOUNDATIONS.md §11 patch is authored, applied, and reviewed.
16. Phase 3.5 cross-spec review has been performed and every integration spec specifies actor attribution at call sites.
17. Manual end-to-end test: simulate a prompt-regression anomaly, verify banner surfaces, diagnosis renders, raw-data shows the regression window, band editor raises the band, anomaly resolves after 24h of clean calls.
