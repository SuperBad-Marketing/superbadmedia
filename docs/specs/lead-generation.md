# Lead Generation — Feature Spec

**Phase 3 output. Locked 2026-04-12.**

> **Prompt files:** `lib/ai/prompts/lead-generation.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

Lead Generation is the first feature to feed the Sales Pipeline. It sources, qualifies, enriches, scores, drafts, and (eventually) sends cold outreach to prospective SuperBad clients across two tracks (retainer and SaaS), earning autonomy by track as Andy approves drafts, and respecting a non-overrideable email-warmup ceiling and a Do Not Contact list.

It is also the concrete first implementation of several locked Foundations primitives: §11.1 universal audit log, §11.2 safe-to-send gate, §11.3 timezone-correct timestamps, §11.4 outreach quiet window, §11.5 brand-voice drift check. Lead Gen does **not** invent new infrastructure for any of these — it composes them.

Integration with the Sales Pipeline (`docs/specs/sales-pipeline.md`) is via the two locked touchpoints from Pipeline §10.4: `createDealFromLead()` and `attachOutboundEmailToDeal()`. No other write path into `deals` exists from Lead Gen.

---

## 1. Purpose and shape

Lead Gen is an **operations pipeline**, not a research tool. Andy does not sit down and search. The system runs on its own on a daily schedule and the only surface Andy touches day-to-day is an **approval queue** of Claude-drafted cold emails ready to send. A metrics panel and a runs log sit behind the queue for trust and debugging. Scoring rules, search rules, and sender identity are set once in Settings and essentially never touched again.

Two prospect tracks share one unified search and one scoring pipeline:

- **Retainer track** — higher-revenue, multi-stakeholder, higher customer LTV businesses who'd benefit from SuperBad's creative + performance retainer arm.
- **SaaS track** — lower-revenue, lean-team, DIY-leaning businesses who'd benefit from SuperBad's subscription products.

A single candidate is scored against **both** track rulesets and assigned to whichever track scores highest, provided it clears a qualification floor on that track. Below the floor on both, it's discarded. The source mix (Meta Ad Library, Google Maps, Google Ads Transparency Center, PageSpeed, whois, Instagram Business Discovery, YouTube Data API, website scrape) carries enough signal bias on its own that track-splitting at the search layer would be redundant.

Prospects live as **candidates** in a `lead_candidates` table until the first outbound send fires, at which point `createDealFromLead()` promotes them to a Pipeline Deal at the `Lead` stage. This keeps the Pipeline's Lead column from becoming a graveyard of untouched prospects — only candidates that have actually been contacted occupy space in the Pipeline.

---

## 2. The 13 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Financial-viability-first targeting across two tracks** | Retainer (higher revenue, multi-stakeholder, higher LTV) and SaaS (lower revenue, lean team). Vertical-agnostic. |
| Q2 | **Unified search + dual-scored + winner-takes-all** | One search, two rulesets, highest qualifying score wins the track. Qualification floor + score normalisation required. |
| Q3 | **Expanded enrichment signal set** | Nine signal sources (§4.2), viability profile degrades gracefully when any source fails or returns nothing. |
| Q4 | **Dual-scoring engine: rules now, Claude soft-adjustment as v1.1 upgrade** | v1 passes `softAdjustment = 0`. v1.1 enables a Haiku-tier Claude call that returns ±10 with rationale. |
| Q5 | **Claude soft-adjustment deferred to v1.1** | Same conclusion from a different angle. Locked in Q4; logged here for clarity. |
| Q6 | **Contact email discovery via Hunter.io + pattern inference fallback** | Hunter.io is primary. Pattern fallback (firstname@domain, etc.) is last-resort and marked `email_confidence: 'inferred'`. |
| Q7 | **Single approval queue + earned autonomy graduation per track** | One list, newest first. Per-track streak-based graduation into auto-send with probation + maintenance standard + circuit breakers. |
| Q8 | **Warmup ramp: 5 → 10 → 15 → 20 → 30/day over 4 weeks** | Non-overrideable. Lives in `resend_warmup_state`. Gates every outbound send. |
| Q9 | **Engagement-gated indefinite sequences with 4-tier engagement model** | Clicks trump opens, opens count as positive signal, 3 consecutive non-engagements ends the sequence. Sub-60s opens degraded but not zero. |
| Q10 | **Automated daily search from Settings + Candidate→Deal architecture** | 3am daily run, Settings configured once, "Run now" button, "Looking for something specific?" manual brief override. Warmup cap is authoritative and clamps daily search output. |
| Q11 | **Three-tab surface: Queue / Runs log / Metrics** | Queue is primary. Metrics has a closed list of 4 panels (funnel, approval rate sparkline, autonomy streak, warmup progress). |
| Q12 | **Three-tier DNC with single enforcement function** | Company + email + domain. `isBlockedFromOutreach()` is the only read path. Unsubscribe handler, complaint handler, manual CRUD are the only writers. |
| Q13 | **Single fixed sender: Andy Robinson <hi@contact.superbadmedia.com.au>** | One identity, one warmup, one reply pipe. Multi-sender retrofits cheaply in v1.1 if ever needed. |
| Q14 | **Reactive ICP scoring — rules-only, post-send, track-change-capable** | Engagement + reply + file-note signals feed `rescoreCandidate()`. Deterministic rules, bounded [−20, +25]. Track can change once mid-sequence. Added 2026-04-18. |
| Q15 | **No Apollo.io — enrichment via public APIs only** | Meta Ad Library + Google Maps + Google Ads Transparency + Hunter.io + 6 enrichment signals. No purchased contact databases. Confirmed 2026-04-18. |

---

## 3. Sourcing strategy

### 3.1 Source list (v1)

| Source | Role | Notes |
|---|---|---|
| **Meta Ad Library API** | Primary discovery for ad-running businesses | Free, public, high rate limits. Filters: location, active-ad status, ad count, estimated spend bracket where exposed. |
| **Google Maps (via SerpAPI `google_maps` engine)** | Primary discovery for location-based businesses not running ads | SerpAPI already in the stack for Content Engine. Query shape: `category + location` derived from Settings standing brief. |
| **Google Ads Transparency Center** (via SerpAPI) | Discovery for Google-advertising businesses not visible in Meta's library | Catches the "runs Google ads but not Meta" segment. |

### 3.2 Enrichment signal set (all optional, profile degrades)

Every discovered candidate flows through enrichment. The nine inputs feed a structured `viabilityProfile` consumed by both track scorers.

| Signal | Source | What it tells us |
|---|---|---|
| **Active ads + estimated spend bracket** | Meta Ad Library API | Marketing maturity + budget presence |
| **Google Ads activity + creative count** | Google Ads Transparency Center (via SerpAPI) | Cross-platform marketing maturity |
| **Website technical quality** | Google PageSpeed Insights API | Crude but useful proxy for agency-vs-DIY website |
| **Domain age** | `whois` lookup | Business longevity (stable old business vs brand-new outfit) |
| **Instagram presence + follower count + post cadence** | Instagram Business Discovery API | Social maturity + approximate audience size |
| **YouTube channel + subscriber count + upload cadence** | YouTube Data API v3 | Long-form content presence (retainer signal) |
| **Google Maps reviews + rating + category** | SerpAPI | Consumer business legitimacy + size proxy |
| **Website scrape (about page, team page, pricing page)** | Custom fetch + cheerio | Team size signal, service list, stated pricing tier, "About" language |
| **Google Maps photo count + last photo date** | SerpAPI | Recency of business activity |

**Claude soft-adjustment** (Q4/Q5 deferred to v1.1) is the tenth input, slotted behind a feature flag:

```ts
// v1 default — always zero
scoreForRetainerTrack(profile, softAdjustment = 0): number
scoreForSaasTrack(profile, softAdjustment = 0): number

// v1.1 upgrade — enable the flag; a Haiku-tier Claude call reads the profile + the two rule-scored numbers + SuperBad's business context, returns { adjustment: -10..+10, rationale: string }
```

The adjustment is bounded. It never pushes a candidate that scored zero on rules into qualification; it only nudges already-plausible candidates up or down. Rationale is stored on the candidate for auditability.

### 3.3 Search input UX (Q10 lock)

**Setting once, running daily.** The search is configured in Settings → Lead Generation → Daily Search, wrapped in a setup wizard on first open.

**Fields:**
- On/off toggle
- Location + radius (default `Melbourne + 25km`)
- Category (optional free text — "cafes", "dental clinics", "boutique fitness" — feeds the Google Maps query)
- **Standing brief** (1–3 sentences, free text — feeds the Claude draft generator and the optional v1.1 Claude soft-adjustment)
- **Max new prospects per day** (default 8)
- **Dedup window** (default 90 days — candidates already seen in this window are skipped)
- **Run time** (default 03:00 Melbourne local)
- **Run now** button (ad-hoc trigger)

**Warmup clamp (visible, non-overrideable):** the Settings surface shows live-computed effective cap:

```
Max new prospects/day: [20]

⚠ Warmup cap this week: 5/day
⚠ Effective max today: 5 (3 sequence follow-ups queued → 2 new candidates)
```

**Manual override on the Lead Gen surface:**
- **"Looking for something specific?"** button opens a modal with a single free-text field. Text becomes the ad-hoc brief for a one-off run. Same warmup clamp applies. Run is logged in `lead_runs` with `trigger = 'manual_brief'` and the brief text stored in `manual_brief_text`.

### 3.4 Daily run sequence

The 3am cron (or `Run now` click, or `manual_brief` click) executes:

```
1.  Compute today's send budget:
    effective_cap = warmup_daily_cap − scheduled_sequence_touches_today
    target = min(settings.max_per_day, effective_cap)
    If target ≤ 0: log run summary with capped_reason, exit.

2.  Query all sources in parallel for the standing brief (or manual brief if override).
    Per-source failures logged to lead_runs.error; run continues with remaining sources.

3.  Deduplicate against:
    - `lead_candidates.email_or_domain` within dedup window
    - `deals` (any existing deal for the same company/domain)
    - `dnc_emails`, `dnc_domains`, `companies.do_not_contact` (via isBlockedFromOutreach)

4.  Enrich each survivor with the 9-signal set in parallel.

5.  Build viabilityProfile for each.

6.  Score against both rulesets:
    - qualification floor check per track
    - winner-takes-all track assignment
    - discard if fails floor on both

7.  Take top `target` by score, within warmup budget.

8.  For each, discover contact email via Hunter.io; mark email_confidence.

9.  Generate first-touch draft via Claude (Opus-tier) using:
    - Standing brief / manual brief
    - SuperBad's own Brand DNA profile (§11.5 compliance)
    - viabilityProfile
    - prior touches (empty for first touch)
    - recent SuperBad blog posts (empty in v1; Content Engine populates in v1.1)
    - sender identity (SUPERBAD_SENDER constant)

10. Pass draft through `checkBrandVoiceDrift()` per Foundations §11.5.
    On drift failure: regenerate once with drift feedback; on second failure, flag visibly but do not block.

11. Insert into `lead_candidates` + enqueue into approval queue.

12. Write `lead_runs` summary row (append-only audit log).
```

**Build-time discipline §12.A:** step 1 (`enforceWarmupCap()`) and step 3 (`isBlockedFromOutreach()`) are the only two functions that gate Lead Gen writes. No other code path adds candidates or sends outbound email without calling both.

---

## 4. Data model (Drizzle)

### 4.1 `lead_candidates`

Append-only until promotion to a Deal. Holds prospects sourced by the daily run before any outbound has fired.

```ts
export const leadCandidates = sqliteTable('lead_candidates', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),

  // Identity
  company_name: text('company_name').notNull(),
  domain: text('domain'),               // nullable — some Maps-sourced candidates have no website
  contact_email: text('contact_email'), // nullable until Hunter.io resolves
  contact_name: text('contact_name'),
  contact_role: text('contact_role'),
  email_confidence: text('email_confidence', { enum: ['verified', 'inferred', 'unknown'] }),

  // Viability profile (structured JSON — shape in §4.3)
  viability_profile_json: text('viability_profile_json', { mode: 'json' }).notNull(),

  // Scoring
  saas_score: integer('saas_score').notNull(),
  retainer_score: integer('retainer_score').notNull(),
  qualified_track: text('qualified_track', { enum: ['saas', 'retainer'] }).notNull(),
  scoring_debug_json: text('scoring_debug_json', { mode: 'json' }),
  soft_adjustment: integer('soft_adjustment').notNull().default(0), // v1.1 populates; v1 always 0
  soft_adjustment_rationale: text('soft_adjustment_rationale'),

  // Run provenance
  lead_run_id: text('lead_run_id').notNull().references(() => leadRuns.id),
  sourced_from: text('sourced_from', { enum: ['meta_ad_library', 'google_maps', 'google_ads_transparency', 'manual_brief', 'manual_entry'] }).notNull(),

  // Draft state
  pending_draft_id: text('pending_draft_id').references(() => outreachDrafts.id),

  // Transition state
  promoted_to_deal_id: text('promoted_to_deal_id').references(() => deals.id),
  promoted_at: integer('promoted_at', { mode: 'timestamp_ms' }),
  skipped_at: integer('skipped_at', { mode: 'timestamp_ms' }),
  skipped_reason: text('skipped_reason'),

  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => Date.now()),
})
```

### 4.2 `outreach_drafts`

Every Claude-generated draft for a cold touch. Lives here through approval, mutates into an `outreach_sends` row on approval+send.

```ts
export const outreachDrafts = sqliteTable('outreach_drafts', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),

  // What this draft is for
  candidate_id: text('candidate_id').references(() => leadCandidates.id),
  deal_id: text('deal_id').references(() => deals.id),                  // populated on follow-up touches
  sequence_id: text('sequence_id').references(() => outreachSequences.id),
  touch_kind: text('touch_kind', { enum: ['first_touch', 'follow_up', 'stale_nudge'] }).notNull(),
  touch_index: integer('touch_index').notNull(),                        // 1 for first touch, 2+ for follow-ups

  // Draft content
  subject: text('subject').notNull(),
  body_markdown: text('body_markdown').notNull(),

  // Generation metadata
  model_used: text('model_used').notNull(),                             // e.g. 'claude-opus-4-6'
  prompt_version: text('prompt_version').notNull(),                     // for debugging prompt drift
  generation_ms: integer('generation_ms'),
  drift_check_score: integer('drift_check_score'),                      // from checkBrandVoiceDrift
  drift_check_regenerated: integer('drift_check_regenerated', { mode: 'boolean' }).notNull().default(false),
  drift_check_flagged: integer('drift_check_flagged', { mode: 'boolean' }).notNull().default(false),

  // Approval state
  status: text('status', { enum: ['pending_approval', 'approved_queued', 'sent', 'rejected', 'superseded', 'expired'] }).notNull().default('pending_approval'),
  approved_at: integer('approved_at', { mode: 'timestamp_ms' }),
  approved_by: text('approved_by').references(() => users.id),
  approval_kind: text('approval_kind', { enum: ['manual', 'auto_send', 'nudged_manual'] }),

  // Nudge chat (reusing Content Engine's rejection-chat primitive)
  nudge_thread_json: text('nudge_thread_json', { mode: 'json' }),

  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => Date.now()),
})
```

### 4.3 `outreach_sends`

Authoritative send record. Written after `sendEmail()` succeeds. Tracks engagement for the tier evaluator (Q9).

```ts
export const outreachSends = sqliteTable('outreach_sends', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  draft_id: text('draft_id').notNull().references(() => outreachDrafts.id),
  sequence_id: text('sequence_id').notNull().references(() => outreachSequences.id),
  deal_id: text('deal_id').notNull().references(() => deals.id),

  resend_message_id: text('resend_message_id').notNull().unique(),
  sent_at: integer('sent_at', { mode: 'timestamp_ms' }).notNull(),

  // Engagement signals from Resend webhooks
  first_opened_at: integer('first_opened_at', { mode: 'timestamp_ms' }),
  open_count: integer('open_count').notNull().default(0),
  first_open_dwell_sec: integer('first_open_dwell_sec'),    // null if unknown / machine prefetch suspected
  first_clicked_at: integer('first_clicked_at', { mode: 'timestamp_ms' }),
  click_count: integer('click_count').notNull().default(0),
  replied_at: integer('replied_at', { mode: 'timestamp_ms' }),
  bounced_at: integer('bounced_at', { mode: 'timestamp_ms' }),
  bounce_kind: text('bounce_kind', { enum: ['hard', 'soft', 'complaint'] }),
  unsubscribed_at: integer('unsubscribed_at', { mode: 'timestamp_ms' }),

  // Engagement tier (computed after a cooloff window; rolls forward on new events)
  engagement_tier: integer('engagement_tier'),              // 1=click, 2=full open, 3=sub-60s open, 4=none
})
```

### 4.4 `outreach_sequences`

One per active contact thread. Holds the state machine for engagement-gated continuation.

```ts
export const outreachSequences = sqliteTable('outreach_sequences', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  deal_id: text('deal_id').notNull().references(() => deals.id),
  track: text('track', { enum: ['saas', 'retainer'] }).notNull(),

  status: text('status', { enum: ['active', 'paused', 'stopped_engagement', 'stopped_reply', 'stopped_bounce', 'stopped_unsubscribe', 'stopped_manual'] }).notNull().default('active'),
  stopped_reason: text('stopped_reason'),

  // Engagement cutoff counter — Q9 lock
  consecutive_non_engagements: integer('consecutive_non_engagements').notNull().default(0),
  cutoff_threshold: integer('cutoff_threshold').notNull().default(3),

  // Scheduling
  next_touch_due_at: integer('next_touch_due_at', { mode: 'timestamp_ms' }),
  last_touch_at: integer('last_touch_at', { mode: 'timestamp_ms' }),
  touches_sent: integer('touches_sent').notNull().default(0),

  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => Date.now()),
})
```

### 4.5 `lead_runs`

Append-only audit log of every daily run + ad-hoc run. Powers the Runs tab and the Metrics panel.

```ts
export const leadRuns = sqliteTable('lead_runs', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  run_started_at: integer('run_started_at', { mode: 'timestamp_ms' }).notNull(),
  run_completed_at: integer('run_completed_at', { mode: 'timestamp_ms' }),
  trigger: text('trigger', { enum: ['scheduled', 'run_now', 'manual_brief'] }).notNull(),
  manual_brief_text: text('manual_brief_text'),

  found_count: integer('found_count').notNull().default(0),
  dnc_filtered_count: integer('dnc_filtered_count').notNull().default(0),
  qualified_count: integer('qualified_count').notNull().default(0),
  drafted_count: integer('drafted_count').notNull().default(0),

  warmup_cap_at_run: integer('warmup_cap_at_run').notNull(),
  effective_cap_at_run: integer('effective_cap_at_run').notNull(),
  capped_reason: text('capped_reason'),

  error: text('error'),
  per_source_errors_json: text('per_source_errors_json', { mode: 'json' }),
})
```

### 4.6 `dnc_emails` and `dnc_domains`

Email and domain blocklists (Q12 lock).

```ts
export const dncEmails = sqliteTable('dnc_emails', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  email: text('email').notNull().unique(),                              // lowercased + trimmed
  reason: text('reason'),
  source: text('source', { enum: ['unsubscribe_link', 'manual', 'csv_import', 'complaint'] }).notNull(),
  added_at: integer('added_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => Date.now()),
  added_by: text('added_by').references(() => users.id),
})

export const dncDomains = sqliteTable('dnc_domains', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
  domain: text('domain').notNull().unique(),                            // lowercased + trimmed, no @ no protocol
  reason: text('reason'),
  added_at: integer('added_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => Date.now()),
  added_by: text('added_by').notNull().references(() => users.id),
})
```

Company-level DNC lives on `companies.do_not_contact` (already defined in Pipeline spec §4).

### 4.7 `resend_warmup_state`

Single-row config table for the warmup ramp. One row for the single sender in v1.

```ts
export const resendWarmupState = sqliteTable('resend_warmup_state', {
  id: text('id').primaryKey().default('default'),                       // single row
  sender_local_part: text('sender_local_part').notNull(),
  sender_domain: text('sender_domain').notNull(),
  started_at: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  current_week: integer('current_week').notNull().default(1),           // 1..4, then 5+ = graduated
  daily_cap: integer('daily_cap').notNull().default(5),
  sent_today: integer('sent_today').notNull().default(0),
  sent_today_reset_at: integer('sent_today_reset_at', { mode: 'timestamp_ms' }).notNull(),
  manual_override: integer('manual_override', { mode: 'boolean' }).notNull().default(false), // reserved; never true in v1
})
```

### 4.8 `autonomy_state`

Per-track streak tracking + graduation state (Q7 lock).

```ts
export const autonomyState = sqliteTable('autonomy_state', {
  track: text('track', { enum: ['saas', 'retainer'] }).primaryKey(),

  mode: text('mode', { enum: ['manual', 'probation', 'auto_send', 'circuit_broken'] }).notNull().default('manual'),

  // Streak counter toward graduation
  clean_approval_streak: integer('clean_approval_streak').notNull().default(0),
  graduation_threshold: integer('graduation_threshold').notNull().default(10),

  // Probation window
  probation_sends_remaining: integer('probation_sends_remaining'),
  probation_threshold: integer('probation_threshold').notNull().default(5),

  // Maintenance standard (rolling 20-send window)
  rolling_window_size: integer('rolling_window_size').notNull().default(20),
  maintenance_floor_pct: integer('maintenance_floor_pct').notNull().default(80),

  // Circuit breaker
  circuit_broken_at: integer('circuit_broken_at', { mode: 'timestamp_ms' }),
  circuit_broken_reason: text('circuit_broken_reason'),

  last_graduated_at: integer('last_graduated_at', { mode: 'timestamp_ms' }),
  last_demoted_at: integer('last_demoted_at', { mode: 'timestamp_ms' }),
})
```

### 4.9 Companion changes to existing tables

- **`contacts.email_status`** (Pipeline spec §4): add enum value `'unsubscribed'`. Not destructive. Flag for Pipeline spec update.
- **`companies`**: no schema change — `do_not_contact` already exists from Pipeline.
- **`activity_log`** (Pipeline §4): Lead Gen writes rows with `kind` values `outreach_sent`, `outreach_opened`, `outreach_clicked`, `outreach_replied`, `outreach_bounced`, `outreach_unsubscribed`, `sequence_stopped_engagement`, `sequence_stopped_manual`, `autonomy_graduated`, `autonomy_demoted`. No schema change required; enum extension only.

---

## 5. Viability profile shape

The JSON payload at `lead_candidates.viability_profile_json`. Every field is optional — scorers tolerate missing values.

```ts
interface ViabilityProfile {
  // Advertising signals
  meta_ads?: {
    active_ad_count: number
    estimated_spend_bracket: 'unknown' | 'low' | 'medium' | 'high'
    has_active_creatives: boolean
  }
  google_ads?: {
    active_creative_count: number
    has_active_campaigns: boolean
  }

  // Web signals
  website?: {
    domain_age_years: number | null
    pagespeed_performance_score: number | null       // 0..100
    has_about_page: boolean
    has_pricing_page: boolean
    team_size_signal: 'solo' | 'small' | 'medium' | 'large' | 'unknown'
    stated_pricing_tier: 'unknown' | 'budget' | 'mid' | 'premium'
  }

  // Social signals
  instagram?: {
    follower_count: number
    post_count: number
    posts_last_30d: number | null
  }
  youtube?: {
    subscriber_count: number
    video_count: number
    uploads_last_90d: number | null
  }

  // Google Maps signals
  maps?: {
    category: string
    rating: number | null
    review_count: number
    photo_count: number
    last_photo_date: string | null   // ISO
  }

  // Per-source fetch status
  fetch_errors?: Record<string, string>     // keyed by signal name
}
```

---

## 6. Scoring rules

### 6.1 Pure functions, per track

```ts
// lib/lead-gen/scoring.ts
export function scoreForSaasTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean }

export function scoreForRetainerTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean }
```

Both functions are **pure**: `(ViabilityProfile, softAdjustment) → { score, breakdown, qualifies }`. No I/O, no side effects, fully unit-testable.

### 6.2 Qualification floors

| Track | Floor | Rationale |
|---|---|---|
| SaaS | 40 / 100 | Below this the candidate is too thin to justify even an auto-drafted cold touch. |
| Retainer | 55 / 100 | Retainer pitches are higher-stakes and higher-cost; the floor is higher to keep the queue's quality up. |

Floors live as constants in `scoring.ts`. Changes ship as deploys, not config.

### 6.3 Winner-takes-all track assignment

```ts
function assignTrack(profile): { track: 'saas' | 'retainer' | null; score: number } {
  const saas = scoreForSaasTrack(profile)
  const retainer = scoreForRetainerTrack(profile)

  const saasQualifies = saas.qualifies
  const retainerQualifies = retainer.qualifies

  if (!saasQualifies && !retainerQualifies) return { track: null, score: 0 }
  if (saasQualifies && !retainerQualifies) return { track: 'saas', score: saas.score }
  if (retainerQualifies && !saasQualifies) return { track: 'retainer', score: retainer.score }
  return saas.score >= retainer.score
    ? { track: 'saas', score: saas.score }
    : { track: 'retainer', score: retainer.score }
}
```

### 6.4 Build-time disciplines for scoring

- **§12.B** — `scoring.ts` is the only place rules live. No inline scoring logic anywhere else. Unit tests cover every rule path.
- **§12.C** — Rule changes are deploys, not config. No "scoring rules UI" in v1. Changes are reviewed as code.
- **§12.D** — `scoring_debug_json` is populated on every candidate so future tuning can eyeball "why did this score 74."

---

## 7. Contact email discovery

### 7.1 Hunter.io as primary

Once a candidate clears scoring + qualification, the pipeline resolves a contact email:

1. **Hunter.io Domain Search API** — pass the candidate domain, receive ranked contacts (name, role, email, confidence).
2. Prefer contacts with `role` matching a closed list: `founder`, `ceo`, `owner`, `marketing-manager`, `marketing-director`, `growth-lead`.
3. If Hunter returns a high-confidence match, store `email_confidence = 'verified'`.
4. If Hunter returns only low-confidence or no match, fall back to **pattern inference**: try `firstname@domain`, `firstname.lastname@domain`, `first-initial-lastname@domain`. Store the best guess with `email_confidence = 'inferred'`.
5. If both fail, candidate is skipped with `skipped_reason = 'no_contact_email'`.

### 7.2 Inferred emails get a softer send posture

- Draft is still generated.
- Send is still allowed (no way to verify without trying).
- **Bounce on an inferred-email first touch is treated as normal**, not as a reputation incident — it's expected occasionally. The candidate is marked skipped, not escalated.

---

## 8. Draft generation

### 8.1 The draft generator function

One entry point:

```ts
// lib/lead-gen/draft-generator.ts
export async function generateDraft(args: {
  track: 'saas' | 'retainer'
  touchKind: 'first_touch' | 'follow_up' | 'stale_nudge'
  touchIndex: number
  viabilityProfile: ViabilityProfile
  standingBrief: string
  manualBriefOverride?: string
  priorTouches: OutreachSend[]
  recentBlogPosts: BlogPost[]                // always [] in v1; Content Engine populates in v1.1
  contactInfo: { name?: string; email: string; role?: string; company: string }
  nudgeFeedback?: string                     // populated when reusing the surface for nudged regeneration
}): Promise<{
  subject: string
  bodyMarkdown: string
  modelUsed: string
  promptVersion: string
  generationMs: number
}>
```

### 8.2 Prompt inputs (composed, not baked)

- **System prompt** loads from a version-controlled file at `lib/lead-gen/prompts/outreach-system.md`. No inlined prompt strings in route handlers (§12.E).
- **SuperBad's own Brand DNA profile** is read into the system prompt — cold outreach sounds like Andy, not like a generic outreach bot. This is the `superbad-brand-voice` skill content loaded at generation time. (The client's Brand DNA is not available for cold outreach — the prospect isn't a client yet. Per Foundations §11.5, SuperBad's own profile is used in that case.)
- **SuperBad business context** loaded from the `superbad-business-context` skill (pricing ranges, verticals, trial shoot offering).
- **viabilityProfile** fed in as structured JSON so the prompt can reference specific signals.
- **Prior touches** supply thread context for follow-ups and nudges.

### 8.3 Required output discipline

- Every draft has a subject AND a body (no "placeholder" variants).
- Body includes the Spam Act footer block: unsubscribe link, sender identity (Andy Robinson, SuperBad Media, Melbourne address), reason for sending.
- Body must never invent facts not in the viability profile. The system prompt includes a "do not hallucinate specifics" instruction and a post-generation sanity check flags drafts that reference signals not present in `viabilityProfile` (e.g. "I saw your ad for X" when `meta_ads` is absent).

### 8.4 Drift check (Foundations §11.5)

Every generated draft passes through `checkBrandVoiceDrift(draft, superbadBrandDnaProfile)` before the draft is shown in the queue. One automatic regeneration on drift failure, second failure surfaces a visible "voice drift flagged" warning on the queue row without blocking.

### 8.5 Nudge regeneration

Reuses the Content Engine's rejection-chat primitive. When Andy types a nudge into the draft surface's nudge field:

1. The existing draft + Andy's feedback are posted to `generateDraft()` with `nudgeFeedback` populated.
2. The new draft replaces the old one, the `outreach_drafts` row is updated, and the nudge feedback is appended to `nudge_thread_json` for audit.
3. The regenerated draft goes through the drift check again.
4. Approval after a nudge is classified as `approval_kind: 'nudged_manual'` — this counts as a non-clean approval for the autonomy streak calculator (§9.2).

---

## 9. Approval queue + earned autonomy

### 9.1 The queue surface

One scrollable list, newest first, across both tracks. Each row:

```
┌──────────────────────────────────────────────────────────┐
│ Acme Co — Retainer · score 78 · first touch              │
│ Subject: Thought you'd find this useful                   │
│ "Saw your café's been running that lamington ad for..."   │
│                                                           │
│ [Approve & Send]  [Edit]  [Nudge]  [Reject]               │
└──────────────────────────────────────────────────────────┘
```

**Row states:**
- Default: green Approve button, clickable
- Autonomy active for this row's track: row is shown with a subtle `auto-send in 15m` countdown pill instead of a button — the send is queued and Andy can still Reject to pull it back
- Drift flagged: amber warning pill
- Email inferred: small `email: inferred` tag

Track filter chips sit above the list (`All` / `Retainer` / `SaaS`). No sorting controls in v1 — newest first is the only order.

### 9.2 Autonomy graduation state machine

Per track. Completely independent — SaaS can be in `auto_send` while retainer is still in `manual`.

**States:**
1. **`manual`** — default. Every draft needs explicit Approve click. Streak counter tracks consecutive clean approvals.
2. **`probation`** — unlocked after `clean_approval_streak ≥ graduation_threshold` (default 10). Drafts are queued for auto-send with a **15-minute delay** during which Andy can Reject. Probation lasts `probation_threshold` drafts (default 5).
3. **`auto_send`** — unlocked after completing probation without intervention. Drafts are queued with the 15-minute delay and send automatically. Maintenance standard enforced on rolling window.
4. **`circuit_broken`** — unrecoverable (this run) state entered on any of the circuit-breaker conditions (§9.3). Track demotes to `manual`. Streak resets to zero. Andy must manually approve the next ≥10 drafts to re-graduate.

**Clean vs non-clean approval:**
- **Clean:** `approval_kind = 'manual'` with zero edits to the draft body or subject. Increments streak.
- **Non-clean:** any edit before approval, any nudge regeneration, or any rejection. Does not increment streak; resets it to zero if currently ≥ 1. (Keeps the graduation bar honest — "did the draft land as-is" is the signal we care about.)

**Maintenance standard:**
- Rolling window of the last 20 outreach_sends in this track.
- Required `clean_approval_rate ≥ maintenance_floor_pct` (default 80%).
- Below floor → demote from `auto_send` back to `manual`, log `autonomy_demoted` activity event, reset streak.

### 9.3 Circuit breakers

Auto-demote to `circuit_broken` + `manual` on any of:
- Any **hard bounce** from an `auto_send`-classified send.
- Any **spam complaint** from any send.
- Any **unsubscribe within 60 seconds** of a send (strong "this was bad" signal).
- `drift_check_flagged = true` on any `auto_send`-classified send.

Circuit breakers write an `activity_log` row with a loud `urgent` sound and a notification.

### 9.4 Queue surface header

Shows live state:

```
Today's run: 3:02am — found 47 → qualified 12 → drafted 5 (warmup cap 5/day)
SaaS:     auto-send · 3/5 probation · 17 sends rolling 95% clean
Retainer: manual    · 7/10 toward graduation
Warmup:   Week 1 · 5/day · 16 days until next ramp
```

### 9.5 Build-time disciplines for autonomy

- **§12.F** — Autonomy state transitions live in one function `transitionAutonomyState(track, event)`. No direct writes to `autonomy_state` elsewhere.
- **§12.G** — Every transition writes to `activity_log`. No silent flips.
- **§12.H** — The 15-minute auto-send delay is enforced in the sequence runner, not in the UI. Cancel is a pure DB operation.

---

## 10. Warmup ramp + sender posture

### 10.1 The ramp (Q8 lock)

| Week | Daily cap |
|---|---|
| Week 1 | 5 |
| Week 2 | 10 |
| Week 3 | 15 |
| Week 4 | 20 |
| Week 5+ | 30 |

The cap is **per calendar day in Melbourne timezone**. Resets at midnight Melbourne local. The cap applies to **all outbound Lead Gen sends combined** — first touches, follow-ups, stale nudges, manual-override sends. It does **not** apply to transactional sends, magic-link auth, Stripe receipts, newsletter sends, or anything else unrelated to cold outreach.

### 10.2 The enforcement function

```ts
// lib/lead-gen/warmup.ts
export async function enforceWarmupCap(): Promise<{
  cap: number
  used: number
  remaining: number
  can_send: boolean
}>
```

Called by:
1. The daily search runner (step 1 of §3.4) to compute how many drafts to produce.
2. The sequence runner before every outbound follow-up.
3. The send step immediately before `sendEmail()` — belt-and-braces check.

**Build-time discipline §12.I** — `enforceWarmupCap()` is the only function that reads or writes `resend_warmup_state`. The ramp week progression is computed from `started_at`, not manually advanced — no "skip ahead" option in the codebase.

### 10.3 Single sender identity

```ts
// lib/lead-gen/sender.ts
export const SUPERBAD_SENDER = {
  display_name: 'Andy Robinson',
  local_part: 'hi',
  domain: 'contact.superbadmedia.com.au',
  reply_to: 'hi@contact.superbadmedia.com.au',
} as const

export const SUPERBAD_FROM_STRING =
  `${SUPERBAD_SENDER.display_name} <${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}>`
```

Every Lead Gen send uses this constant. Retrofit path to multi-sender in v1.1 is documented in §15.

### 10.4 Cold-subdomain DNS (Phase 2 baseline)

- `contact.superbadmedia.com.au` has its own SPF, DKIM, DMARC records, fully isolated from `superbadmedia.com.au`.
- DMARC policy starts at `p=quarantine` during warmup, tightens to `p=reject` once the ramp completes.
- Setup is wrapped in a setup-wizard step per `feedback_setup_is_hand_held`.

---

## 11. Engagement-gated sequences

### 11.1 The 4-tier engagement model (Q9 lock)

Every outbound send, after a 24h cooloff window, is classified into a tier used for both:
(a) the sequence cutoff counter
(b) the metrics panel weighted engagement score

| Tier | Condition | Cutoff counter effect | Metrics weight |
|---|---|---|---|
| **1 — click** | Any click on any link | Resets `consecutive_non_engagements` to 0 | 4 |
| **2 — full open** | At least one open with `first_open_dwell_sec ≥ 60` OR multiple opens | Resets to 0 | 2 |
| **3 — sub-60s open** | Only one or more opens, all with `first_open_dwell_sec < 60`, no clicks | Increments by 1 (treated as non-engagement) | 1 |
| **4 — none** | No opens, no clicks | Increments by 1 | 0 |

**Key property:** a click ALWAYS trumps any open, regardless of open timing. Sub-60s opens are treated as non-engagement for the cutoff counter because Apple Mail Privacy Protection prefetches typically dwell under 60s — but they still count as positive signal in the weighted metrics score, matching Andy's "an open is still a positive signal" directive.

### 11.2 Sequence continuation logic

```
if sequence.status != 'active': exit
if sequence.consecutive_non_engagements >= sequence.cutoff_threshold:
    transition sequence to 'stopped_engagement'
    exit
if sequence.last_touch_at + cadence > now:
    skip (not yet due)
if enforceWarmupCap().remaining == 0:
    skip (no budget; will retry next run)
if !isWithinQuietWindow():
    skip (outside 08:00–18:00 Mon–Fri Melbourne; will retry)
if isBlockedFromOutreach(contact.email, deal.company_id).blocked:
    transition sequence to 'stopped_unsubscribe' (or 'stopped_bounce', as appropriate)
    exit

generate follow-up draft via generateDraft({ touchKind: 'follow_up', priorTouches: ... })
enqueue into approval queue OR auto-send per autonomy state
```

### 11.3 Cadence

- Touch 1 (first touch): sent on approval
- Touch 2: 4 days after Touch 1
- Touch 3: 7 days after Touch 2
- Touch 4+: 10 days after the prior touch

Cadence values are constants. Tuning in v1.1 based on real data.

### 11.4 Terminal states

- `stopped_engagement` — 3 consecutive non-engagements (normal sequence end)
- `stopped_reply` — manual "They replied" button in Pipeline OR inbound email matched (v1.1 when Unified Inbox lands)
- `stopped_bounce` — hard bounce on any touch
- `stopped_unsubscribe` — recipient clicked unsubscribe
- `stopped_manual` — Andy clicked Stop on the sequence

**No sequence ever "ages out."** Engagement-gated indefinite continuation means a highly engaged prospect can receive 20 touches over 8 months if they keep engaging.

---

## 12. Do Not Contact (three tiers)

### 12.1 The enforcement function

```ts
// lib/lead-gen/dnc.ts — the ONLY place DNC rules are interpreted
export async function isBlockedFromOutreach(
  email: string,
  companyId?: string,
): Promise<{ blocked: boolean; reason: 'company' | 'email' | 'domain' | null }>
```

Called from exactly three places:
1. Daily search dedup step
2. Draft generator pre-render
3. Send step (immediately before `sendEmail()`)

### 12.2 Population paths

| Source | Writes to | Notes |
|---|---|---|
| **Unsubscribe link click** | `dnc_emails` (`source: 'unsubscribe_link'`) | Also flips `contacts.email_status = 'unsubscribed'` if contact exists |
| **Resend spam complaint webhook** | `dnc_emails` (`source: 'complaint'`) + `companies.do_not_contact = true` + `contacts.email_status = 'complained'` | Triple-write belt and braces |
| **Manual DNC management surface** | `dnc_emails`, `dnc_domains`, `companies.do_not_contact` | Settings → Lead Generation → Do Not Contact |
| **CSV import** | `dnc_emails` or `dnc_domains` | Via bulk-add textarea in the management surface |

### 12.3 Unsubscribe link flow

1. Every Lead Gen outbound includes a visible footer unsubscribe link + `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058).
2. Link URL: `/api/unsubscribe?token=<signed>` where the token is a server-signed payload `{ email, contact_id?, issued_at }`.
3. Handler: validates token → inserts to `dnc_emails` (idempotent on email uniqueness) → renders a single-page confirmation page in SuperBad voice.
4. No expiry on tokens — unsubscribe links remain valid indefinitely (legal requirement).

### 12.4 Management surface

**Location:** Settings → Lead Generation → Do Not Contact

Three tabs (Companies / Emails / Domains), each with:
- Entry count at the top
- Search box
- Scrollable list with source + added_at + unblock button
- Single-add input + bulk-paste textarea (emails and domains tabs only)

Companies tab is read-only on the list itself — unblocking routes through the Company profile for safety (forces a deliberate action).

### 12.5 Build-time disciplines for DNC

- **§12.J** — `isBlockedFromOutreach()` is the only read path. No direct queries on `dnc_emails`, `dnc_domains`, or `companies.do_not_contact` from anywhere except this function and the management surface.
- **§12.K** — All writes normalise email/domain to lowercased + trimmed before insert. Uniqueness enforced at the DB layer.
- **§12.L** — Unsubscribe tokens are signed server-side. No unsigned unsubscribe URLs anywhere.

---

## 13. Integration touchpoints

### 13.0 Reply-intelligence primitive (formalised 2026-04-13 Phase 3.5 per `project_outreach_reply_intelligence` + Hiring Pipeline reuse)

The LLM reply classifier is an externally-consumable primitive, not private to Lead Generation. Hiring Pipeline is the second consumer; future email-driven flows inherit the same shape.

**Classifier interface** (`lib/reply-intelligence/classify.ts`):

```ts
classifyReply({
  threadContext: { originalOutboundBody, recentMessages },
  replyBody: string,
  classificationContext: 'outreach' | 'hiring_invite' | <extendable>,
}): Promise<{
  intent: 'positive' | 'objection' | 'question' | 'negative' | 'auto_responder',
  confidence: number,            // 0..1
  signals: string[],             // freeform tags, e.g. ['price_concern', 'timeline_pushback']
  summary: string,               // one-line human-readable
}>
```

Routes through the `reply-classifier` job in the model registry (Haiku). Drift-checked. Logs to `external_call_log`.

**Dispatch-table registration pattern.** Each consumer registers a handler map at module-load:

```ts
registerReplyDispatch('outreach', {
  positive: handlePositiveOutreachReply,
  objection: queueForAndyReview,
  question: queueForAndyReview,
  negative: suppressAndAutoArchive,
  auto_responder: ignoreAndRequeue,
})

registerReplyDispatch('hiring_invite', {
  positive: linkApplyFormAndTransitionToApplied,
  objection: queueForAndyReview,
  question: queueForAndyReview,
  negative: archiveWithDisposition('they_withdrew'),
  auto_responder: ignore,
})
```

Dispatch lookup resolves `(classificationContext, intent) → handler`. Missing handler = structured error logged + fallback to `queueForAndyReview`. Registry lives in `lib/reply-intelligence/dispatch.ts`; consumer specs import `registerReplyDispatch()` at their module root.

**Shared-primitive registry entry** (for Phase 3.5 step 7): owner = Lead Generation; consumers = Lead Generation, Hiring Pipeline (2026-04-13), Unified Inbox (reply-classification surface), plus any future email-driven flow.

### 13.1 Into Sales Pipeline (consuming Pipeline's §10.4 touchpoints)

### 13.1 Into Sales Pipeline (consuming Pipeline's §10.4 touchpoints)

**Candidate → Deal promotion happens at first-send time, not at candidate-creation time.**

```ts
// When an outreach_draft transitions to 'sent':
const deal = await createDealFromLead({
  company: { name: candidate.company_name, domain: candidate.domain, billing_mode: 'stripe' },
  contact: { name: candidate.contact_name, email: candidate.contact_email, role: candidate.contact_role, is_primary: true },
  source: `lead_gen_${candidate.sourced_from}`,
  initial_value_cents: null,
  initial_value_estimated: true,
})

await attachOutboundEmailToDeal(deal.id, {
  draft_id: draft.id,
  resend_message_id: sendResult.id,
  subject: draft.subject,
  body_markdown: draft.body_markdown,
  sent_at: sendResult.sent_at,
  direction: 'outbound',
})
// attachOutboundEmailToDeal automatically triggers the Lead → Contacted auto-advance per Pipeline Q5
```

The candidate row is updated with `promoted_to_deal_id` and `promoted_at`. The candidate row itself is not deleted (audit trail).

**Manually-entered prospects** (Andy types a company directly into the Pipeline) skip `lead_candidates` entirely and call `createDealFromLead()` directly with `source: 'manual_entry'`. They do not occupy a row in `lead_candidates`.

### 13.2 Into the Resend adapter (Foundations §11.2)

Every Lead Gen outbound send imports `sendEmail()` from `lib/integrations/resend.ts` and **never** imports the Resend client directly. The adapter's `canSendTo()` gate is extended (or confirmed to already consult, during the Phase 5 integration session) to call `isBlockedFromOutreach()` for Lead-Gen-purpose sends.

### 13.3 Into the quiet window gate (Foundations §11.4)

Every sequence follow-up and stale nudge passes through `isWithinQuietWindow()`. Rejected sends are deferred to the next safe window rather than dropping.

**Exception:** first-touch sends queued by the approval queue during business hours are not gated — Andy is awake, he just clicked Approve, the intent is immediate. Automated auto-send from probation/auto_send states IS gated, because those are truly automated.

### 13.4 Into the drift check (Foundations §11.5)

Every generated draft passes `checkBrandVoiceDrift()` using **SuperBad's own Brand DNA profile**, not a client profile (cold outreach has no client yet). One auto-regen, second failure flags visibly.

### 13.5 Into the universal audit log (Foundations §11.1)

Every mutation writes a row to `activity_log` via `logActivity()`. New `kind` values listed in §4.9. No Lead Gen code path writes to a Lead Gen table without an adjacent activity log row in the same transaction.

### 13.6 Into the Daily Cockpit (future spec)

Lead Gen emits no independent attention signals. The Cockpit consumes:
- `outreach_sends` for funnel metrics
- `autonomy_state` for the "SaaS graduated today" surface if it wants one
- `lead_runs` for "today's run summary" tile if it wants one
- `outreach_sequences` with `status != 'active'` in the last 24h for "things that stopped overnight" narrative

All of these are pure reads. The Cockpit spec decides the display; Lead Gen exposes the data.

### 13.7 Into the Client Context Engine (spec #7 in the backlog)

Lead Gen's `generateDraft()` function is **architecturally** a special case of the Context Engine's draft primitive — empty-history cold fallback using SuperBad's Brand DNA. The Context Engine spec may formalise this and refactor `generateDraft()` to delegate to `generateContextualDraft({ context: null, brandDnaSource: 'superbad' })` without behavioural change. Flagged in §16.

### 13.8 Into the Content Engine (spec #10 in the backlog)

Lead Gen's `generateDraft()` accepts a `recentBlogPosts: BlogPost[]` parameter that is always `[]` in v1. When Content Engine ships, the Content Engine query layer populates this from recently-approved posts, giving outreach drafts access to "by the way, we just wrote about exactly your problem" references.

---

## 14. Runs log + metrics panel

### 14.1 Runs log tab

Table of the last 30 `lead_runs` rows:

| Date | Trigger | Found | DNC filtered | Qualified | Drafted | Sent | Opened | Clicked | Replied | Approval rate |

Click a row → expands inline to show the list of `lead_candidates` created by that run, their viability profiles, their scores, and their eventual outcomes (sent/rejected/superseded/unsubscribed/bounced).

No filters, no sorts. Closed list.

### 14.2 Metrics panel (Q11 closed list of 4)

**1. Funnel (30 days)**
Bar chart showing totals across 30d for: `found → qualified → DNC-filtered → drafted → sent → opened → clicked → replied`. Catches pipeline leaks.

**2. Approval rate sparkline (30 days, per track)**
Two sparklines — SaaS clean-approval rate and Retainer clean-approval rate, day by day. Y-axis is percentage clean approvals over drafts shown. Catches Claude draft drift.

**3. Autonomy streak (per track)**
Two cards:
```
SaaS · manual
Clean streak: 7 / 10
"3 more clean approvals to unlock probation"

Retainer · auto-send · 17-send rolling 95% clean
Maintenance floor: 80%
Last graduated: 2 weeks ago
```

**4. Warmup progress**
```
Week 1 · daily cap 5 · used 4/5 today
16 days until Week 2 (→ cap 10)
```

No other metrics panels in v1. Additions deferred to a future Analytics spec if ever needed.

### 14.3 Build-time disciplines for metrics

- **§12.M** — Metrics queries are pure reads. No mutations, no side effects.
- **§12.N** — The four panels are a closed list. Additions require explicit spec amendment.
- **§12.O** — Daily Cockpit reuses the same underlying query functions verbatim. No duplicate query logic.

---

## 15. Build-time disciplines (consolidated §12)

All disciplines from the spec, gathered here for the Phase 5 checklist:

- **§12.A** — Daily search runner calls `enforceWarmupCap()` (step 1) and `isBlockedFromOutreach()` (step 3). These are the only two Lead Gen gate functions.
- **§12.B** — `scoring.ts` is the only location of scoring rules.
- **§12.C** — Scoring changes are deploys, not config. No scoring rules UI.
- **§12.D** — `scoring_debug_json` populated on every candidate.
- **§12.E** — Prompts live in version-controlled files under `lib/lead-gen/prompts/`. No inline prompt strings in route handlers.
- **§12.F** — Autonomy state transitions route through `transitionAutonomyState(track, event)`.
- **§12.G** — Every autonomy transition writes to `activity_log`.
- **§12.H** — The 15-minute auto-send delay is enforced in the sequence runner, not the UI.
- **§12.I** — `enforceWarmupCap()` is the only reader/writer of `resend_warmup_state`. Week progression computed from `started_at`, not manually advanced.
- **§12.J** — `isBlockedFromOutreach()` is the only read path for DNC rules.
- **§12.K** — DNC writes normalise email/domain (lowercase + trim) before insert. DB uniqueness enforced.
- **§12.L** — Unsubscribe tokens are server-signed. No unsigned unsubscribe URLs.
- **§12.M** — Metrics queries are pure reads.
- **§12.N** — Metrics panel is a closed list of 4.
- **§12.O** — Daily Cockpit reuses metrics query functions verbatim (no duplication).
- **§12.P** — Single sender identity lives as a constant in `lib/lead-gen/sender.ts`. No inline from-strings anywhere.
- **§12.Q** — No direct Resend imports (inherits Foundations §12.14). Every Lead Gen send imports `sendEmail()` from the adapter.
- **§12.R** — `logActivity()` called at the end of every Lead Gen mutation in the same transaction (inherits Foundations §12.13).
- **§12.S** — `checkBrandVoiceDrift()` called on every Lead Gen draft before display or send (inherits Foundations §12.17).
- **§12.T** — Automated outreach respects the quiet window (inherits Foundations §12.16). First-touch manual approvals exempt.
- **§12.U** — `rescoreCandidate()` lives in `scoring.ts` alongside pre-send scorers. No rescore logic anywhere else.
- **§12.V** — Every rescore writes to `activity_log` via `logActivity()`.
- **§12.W** — Track changes write to `activity_log` and are capped at one per candidate.
- **§12.X** — Reactive adjustment bounds (`[−20, +25]`) are constants in `scoring.ts`, not config.

---

## 16. Reactive ICP scoring (post-send score adjustment)

**Added 2026-04-18. Extends Q4/Q5 locks with a v1 reactive scoring layer.**

### 16.1 Motivation

Pre-send scoring (§6) is a snapshot — it uses only enrichment signals available before any contact has happened. Once outreach begins, the prospect's behaviour generates new signal: engagement tiers, reply classifications, sequence progression, and Andy's file notes. Reactive scoring closes the loop — the ICP score becomes a living number that tracks what we're actually learning, not just what we guessed on day one.

### 16.2 Trigger events

A rescore fires on any of these events:

| Event | Source | What it signals |
|---|---|---|
| Engagement tier computed/updated | LG-9 engagement evaluator (Resend webhooks) | Click = high interest. Full open = moderate. Sub-60s = noise. None = cold. |
| Reply classified | Reply-intelligence classifier (§13.0) | Positive = strong. Objection/question = engaged but hesitant. Negative = disqualify. |
| Sequence touch sent | Sequence scheduler | Responsiveness pattern (replied-to-touch-2 vs ghosted-after-touch-4). |
| File note added | Pipeline activity (manual Andy note on the Deal) | Andy's gut reads — qualitative signal the rules can't capture. |
| Bounce (hard) | Resend webhook | Contact info was wrong — degrade confidence, don't disqualify outright. |

### 16.3 The rescore function

Lives in `scoring.ts` alongside the pre-send scorers. Same pure-function discipline (§12.B).

```ts
// lib/lead-gen/scoring.ts
export function rescoreCandidate(args: {
  currentSaasScore: number
  currentRetainerScore: number
  currentTrack: 'saas' | 'retainer'
  viabilityProfile: ViabilityProfile
  engagementHistory: EngagementEvent[]
  replyClassifications: ReplyClassification[]
  touchesSent: number
  fileNotes: FileNote[]
  hardBounced: boolean
}): {
  saasScore: number
  retainerScore: number
  qualifiedTrack: 'saas' | 'retainer' | null
  trackChanged: boolean
  rescoreBreakdown: RescoreBreakdown
}
```

**Inputs:**
- Original viability profile (unchanged — pre-send enrichment is not re-fetched)
- Full engagement history for this candidate's sequence
- All reply classifications from the reply-intelligence primitive
- Touch count (sequence depth)
- File notes on the associated Deal (text content, not structured)
- Bounce status

**Output:**
- Updated scores for both tracks (not deltas — full recomputed scores)
- Updated qualified track (winner-takes-all, same logic as §6.3)
- `trackChanged` flag for downstream consumers
- Full breakdown for auditability (stored in `scoring_debug_json`)

### 16.4 Score adjustment rules (deterministic, no LLM)

Reactive scoring is **rules-only** in v1. No LLM call. Adjustments are additive to the base enrichment score.

```
Engagement adjustments (cumulative across all sends):
  click on any touch               → +5 per unique click event (cap +15)
  full open (tier 2)               → +2 per event (cap +6)
  sub-60s open (tier 3)            → +0 (noise — no adjustment)
  no engagement (tier 4)           → −2 per event (cap −8)

Reply adjustments:
  positive reply                   → +12 (one-time, not per reply)
  objection or question            → +5 (engaged enough to object/ask)
  negative reply                   → −15 (strong disqualify signal)
  auto_responder                   → +0 (no signal)

Responsiveness pattern:
  replied within 24h of any touch  → +4
  replied within 72h               → +2
  no reply after 3+ touches        → −3

File note adjustment:
  any file note exists on Deal     → +3 (Andy cared enough to annotate)

Hard bounce:
  hard bounce on any touch         → −10 (contact info unreliable)

All adjustments are bounded: total reactive adjustment ∈ [−20, +25].
Final score = clamp(base_enrichment_score + reactive_adjustment, 0, 100).
```

**Floor re-check:** after rescore, if the updated score drops below the track's qualification floor (SaaS 40, Retainer 55), the candidate is **not auto-discarded** — the sequence is already in flight. Instead, the candidate is flagged with `below_floor_after_rescore = true` for visibility in the queue UI. Andy can manually stop the sequence if warranted.

### 16.5 Track changes mid-sequence

A rescore **can change the qualified track**. When `trackChanged = true`:

1. The `outreach_sequences.track` column is updated to the new track.
2. The **next** draft generated for this sequence uses the new track's tone/positioning (retainer vs SaaS pitch angle).
3. Prior sends are not retroactively reclassified — they stay tagged with the original track for accurate historical metrics.
4. An `activity_log` row is written: `kind: 'candidate_track_changed'`, with old/new track and the rescore breakdown.
5. The autonomy state machine reads from `outreach_sequences.track`, so the new track's autonomy rules apply from the next touch onward.

**Guard rail:** a track can only change **once** per candidate. If a rescore would flip it a second time, the flip is suppressed and logged as `track_change_suppressed` in the activity log. This prevents ping-pong between tracks on noisy signals.

### 16.6 Schema additions

```ts
// Additions to lead_candidates (§4.1)
reactive_adjustment: integer('reactive_adjustment').notNull().default(0),
reactive_adjustment_json: text('reactive_adjustment_json', { mode: 'json' }),
rescored_at: integer('rescored_at', { mode: 'timestamp_ms' }),
rescore_count: integer('rescore_count').notNull().default(0),
below_floor_after_rescore: integer('below_floor_after_rescore', { mode: 'boolean' }).notNull().default(false),
track_change_used: integer('track_change_used', { mode: 'boolean' }).notNull().default(false),
previous_track: text('previous_track', { enum: ['saas', 'retainer'] }),
track_changed_at: integer('track_changed_at', { mode: 'timestamp_ms' }),
```

No new tables. No new crons. Columns are all nullable or defaulted — zero impact on existing candidate creation flow.

### 16.7 Activity log kinds

New `activity_log.kind` values:
- `candidate_rescored` — fired on every rescore, includes old/new scores
- `candidate_track_changed` — fired when track flips, includes old/new track + breakdown
- `candidate_track_change_suppressed` — fired when a second flip is blocked
- `candidate_below_floor` — fired when rescore drops a candidate below their track floor

### 16.8 Where rescoring is called

Two call sites only:

1. **LG-9 engagement tier evaluator** — after computing/updating an engagement tier or processing a reply classification, calls `rescoreCandidate()` and updates the candidate row.
2. **Pipeline activity handler** — when a file note is added to a Deal that has a `promoted_from_candidate_id`, calls `rescoreCandidate()` on the original candidate.

No other code path triggers a rescore. Same discipline as the pre-send scoring chokepoint (§12.B).

### 16.9 Build-time disciplines

- **§12.U** — `rescoreCandidate()` lives in `scoring.ts` alongside pre-send scorers. No rescore logic anywhere else.
- **§12.V** — Every rescore writes to `activity_log` via `logActivity()`.
- **§12.W** — Track changes write to `activity_log` and are capped at one per candidate.
- **§12.X** — Reactive adjustment bounds (`[−20, +25]`) are constants in `scoring.ts`, not config.

### 16.10 UI impact

Minimal. The queue row (§9.1) gains:

- A small `rescored` tag when `rescore_count > 0`, showing current score vs original (e.g. `score 78 → 84`)
- A `track changed` tag when `track_change_used = true` (e.g. `SaaS → Retainer`)
- A `below floor` amber warning when `below_floor_after_rescore = true`

These are display-only additions to existing queue rows. No new surfaces, no new tabs.

### 16.11 Metrics panel impact

The existing funnel panel (§14.2 panel 1) is unchanged — it counts candidates at each stage regardless of rescoring. A fifth metrics panel is **not** added; instead, the Runs log detail view (click-to-expand per §14.1) shows the score trajectory when `rescore_count > 0`:

```
Acme Co — Retainer · score 78 → 84 (rescored 3×)
  Touch 1: sent, tier 2 (full open) → +2
  Touch 2: sent, tier 1 (click) → +5, positive reply → +12, replied <24h → +4
  Track: SaaS → Retainer (after touch 2)
```

### 16.12 Session impact

Reactive scoring adds work to two existing sessions:

- **LG-4** (scoring engine): add `rescoreCandidate()` function + unit tests for all adjustment rules + bounds. ~half session additional.
- **LG-9** (engagement tier evaluator + sequence scheduler): wire rescore calls after engagement tier updates and reply classifications. Wire the file-note trigger from Pipeline activity. ~half session additional.

Wave 13 stays at 10 sessions. No session splits required.

---

## 17. Sourcing strategy — no Apollo (confirmed 2026-04-18)

SCOPE.md originally listed Apollo.io as a potential paid data source. **Apollo is explicitly excluded.** The sourcing and enrichment strategy is:

- **Discovery:** Meta Ad Library API, Google Maps (via SerpAPI), Google Ads Transparency Center (via SerpAPI)
- **Enrichment:** PageSpeed Insights, whois, Instagram Business Discovery, YouTube Data API, Google Maps photos, website scrape (fetch + cheerio)
- **Contact discovery:** Hunter.io (domain search) + pattern inference fallback
- **Scoring context:** all nine enrichment signals above, plus reactive post-send signals (§16)

This mix builds comprehensive business profiles without Apollo. The enrichment signal set (§3.2) was designed to degrade gracefully — any single source can fail or return nothing without breaking the pipeline. The combination of advertising signals (Meta + Google), web signals (PageSpeed + whois + scrape), social signals (Instagram + YouTube), and local signals (Maps) covers the same ground Apollo would, using publicly available APIs with clear terms of service.

**References cleaned up:** SCOPE.md §1, SCOPE.md §non-goals, FOUNDATIONS.md §reality-check, BUILD_PLAN.md Wave 13 dependency line.

---

## 18. Open questions deferred to Phase 5

1. **Sub-60s open classification threshold** — 60 seconds is the starting point. Real-world data may warrant 30s or 90s. Tune in v1.1.
2. **Cadence values** — 4 / 7 / 10 days is the starting point. Tune with real engagement data in v1.1.
3. **Hunter.io pattern inference rules** — the exact fallback pattern list. Build-time decision.
4. **Send-failure-mid-promotion edge case** — if `sendEmail()` fails after `createDealFromLead()` has already run (race between steps), the Deal exists at `Lead` without any outbound recorded. Decision needed: roll back the Deal, or let it sit as a manual re-send candidate. Recommendation: let it sit, with a `skipped_reason = 'send_failed'` on the candidate row and a surfaced retry button. Phase 5 lock.
5. **Maintenance floor rolling window size** — 20 sends is the starting point. May be too narrow for the retainer track (lower volume). Tune in v1.1.
6. **Daily run error recovery** — if the 3am run dies mid-flight (process crash, API outage), how does the next run behave? Current plan: lead_runs row is marked with `error`, next run starts fresh and ignores the incomplete row. Adequate for v1; may want retry-from-step logic in v1.1.
7. **Retrofit path to multi-sender** — if a second sender is added in v1.1: add `senders` table, add `sender_id` FK to `outreach_drafts` + `outreach_sends`, parameterise `enforceWarmupCap()` on `sender_id`, add sender picker to Settings. Estimated half-day. Documented here so future-me doesn't panic.

---

## 17. Risks carried forward

1. **Enrichment pipeline is the single largest failure surface.** Nine APIs, each with its own rate limits, auth, schema, and failure modes. Mitigation: each signal is optional, `viabilityProfile` degrades gracefully, `lead_runs.per_source_errors_json` captures per-source failures without killing the whole run.
2. **Warmup discipline must be enforced by code, not trust.** `enforceWarmupCap()` and `isBlockedFromOutreach()` are the two chokepoints that protect compliance + reputation. Any new code path (retry, manual resend, future feature) that bypasses either is a regression. Mitigation: both functions live in named files with tests asserting they're called from every send path; §12 covers them explicitly.
3. **Earned autonomy graduation is the "cleverest" thing in the spec and therefore the most dangerous.** Four failure modes: graduates too early, graduates too late, circuit-breaker silent trip, state machine bugs. Mitigation: the metrics panel surfaces all four states visibly, no silent transitions, dedicated Phase 5 test session with manufactured scenarios.
4. **Engagement tiering noise from Apple Mail Privacy Protection.** The 3 sub-60s-in-a-row rule can false-positive on legitimate recipients using Apple Mail. Mitigation: clicks always reset the counter; this rule will need real-world tuning in v1.1.
5. **Candidate → Deal ordering bug surface.** Race between `createDealFromLead()` and `sendEmail()` failure is deferred to Phase 5 as open question #4. Mitigation: the deferred answer with the "sit as retryable" posture is safe even if implemented reactively.
6. **Resend shared-IP deliverability drift.** Foundations already flags this. Mitigation: dedicated IP upgrade path documented; swap is an adapter change.
7. **Hunter.io cost creep.** Domain search is the primary email discovery path and Hunter bills per lookup. If daily runs hit the free tier cap, candidates bottleneck at step 8 of §3.4. Mitigation: Hunter lookup is called only AFTER scoring + qualification (not during discovery), so free-tier budget is spent only on already-qualified candidates. Rare to blow through.

---

## 19. Cross-spec changes flagged

### `docs/specs/sales-pipeline.md`
- **`contacts.email_status` enum** gains `'unsubscribed'`. Non-breaking (new value). Spec update + migration needed when Pipeline is next edited.
- **`activity_log.kind` enum** gains Lead Gen values listed in §4.9. Non-breaking.

### `docs/specs/design-system-baseline.md`
- No new BHS locations required by this spec. The existing 8-location list (plus the RETAINER/SAAS Won badge added by Pipeline) covers Lead Gen's surface.

### `SCOPE.md`
- Apollo.io references replaced with the actual sourcing stack (Meta Ad Library + Google Maps + Google Ads Transparency Center + Hunter.io) as of 2026-04-18. SCOPE now matches spec.

### `FOUNDATIONS.md`
- No changes. Lead Gen composes §11.1–§11.5 as designed.

### Future spec: `docs/specs/client-context-engine.md`
- Lead Gen's `generateDraft()` will refactor into a special case of the Context Engine primitive at Context Engine build time. Flagged §13.7.

### Future spec: `docs/specs/content-engine.md`
- Lead Gen's `recentBlogPosts` parameter is populated from Content Engine queries once it ships. Flagged §13.8.

### Future spec: `docs/specs/unified-inbox.md`
- Inbound reply detection currently requires a manual "They replied" button in Pipeline. When Unified Inbox lands, inbound email matching auto-transitions the sequence to `stopped_reply`. Flagged here; not a Pipeline spec change.

### Future spec: `docs/specs/setup-wizards.md`
- Lead Gen adds wizard steps for: Meta Ad Library API key, SerpAPI key (shared with Content Engine), Hunter.io key, PageSpeed API key, Instagram Business Discovery OAuth, YouTube Data API key, Resend cold-subdomain DNS setup (SPF/DKIM/DMARC), initial Settings → Lead Generation → Daily Search configuration.

---

## 20. What Phase 5 sessions this spec implies

Rough session breakdown for the Phase 4 build plan:

1. **Schema + DNC + `isBlockedFromOutreach`** — tables, migrations, enforcement function, management surface.
2. **Enrichment pipeline part 1: Meta Ad Library + Google Maps + Google Ads Transparency Center** — the three primary discovery sources.
3. **Enrichment pipeline part 2: PageSpeed + whois + Instagram + YouTube + website scrape + Maps extras** — the six qualification signals.
4. **Scoring engine + candidate creation + daily cron skeleton** — pure-function scoring, winner-takes-all, candidate row creation, 3am cron wrapper.
5. **Draft generator + Brand Voice integration + drift check wiring** — Claude API, prompt files, drift pass.
6. **Resend integration + warmup state machine + `enforceWarmupCap`** — adapter extensions, warmup table, send path.
7. **Lead Gen UI: queue + runs log + metrics panel** — shadcn + recharts, header, three tabs, Settings panel.
8. **Autonomy graduation state machine + circuit breakers** — state transitions, 15-minute delay, maintenance floor, circuit breakers.
9. **Engagement tier evaluator + sequence scheduler** — 4-tier classification, cutoff counter, cadence scheduler.
10. **End-to-end integration test** — manufactured candidates through the entire pipeline, including warmup clamp and DNC enforcement under load.

Sessions 2–3 may split further if any single source turns out harder than expected.

---

## 21. Success criteria

Lead Generation is "done" for v1 when:
- [ ] Daily 3am run produces qualified drafts end-to-end with zero manual steps
- [ ] Warmup ramp is enforced — it's impossible to send more than `daily_cap` on any day via any path
- [ ] DNC enforcement is impossible to bypass — `isBlockedFromOutreach()` is the only read path
- [ ] Autonomy graduation works end-to-end in a test harness (manual → probation → auto_send → maintenance demotion → circuit break)
- [ ] Engagement tier evaluator correctly classifies test fixtures covering all four tiers
- [ ] The three-tab Lead Gen surface renders with real data from a real run
- [ ] Metrics panel 4 panels are present and reading correctly
- [ ] Brand voice drift check runs on every draft
- [ ] Quiet window gate runs on every automated sequence touch
- [ ] Candidate → Deal promotion happens exactly once per first send
- [ ] Settings → Daily Search wizard walks through all required config
- [ ] One real prospect has received one real cold email through the full pipeline and Andy has approved it with no edits
- [ ] Reactive scoring fires on engagement tier update and adjusts candidate score correctly
- [ ] Reactive scoring fires on reply classification and adjusts candidate score correctly
- [ ] Track change mid-sequence works end-to-end: score flips track, next draft uses new track positioning, activity logged
- [ ] Track change is capped at one per candidate — second flip is suppressed and logged
- [ ] Below-floor-after-rescore flag surfaces correctly in the queue UI
- [ ] Reactive adjustment bounds (−20 to +25) are enforced — no score escapes the clamp
- [ ] No Apollo.io dependency anywhere in the codebase — enrichment uses only the nine-signal set from §3.2
