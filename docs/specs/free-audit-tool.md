# Free Audit Tool — Feature Spec

**Phase 3 output. Locked 2026-04-18.**

> **Prompt files:** `lib/ai/prompts/free-audit-tool.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 5 compiles from.

The Free Audit Tool is a public-facing inbound lead-generation surface at `/get-started/audit`. A business owner enters their details and receives an instant, branded marketing health scorecard — graded A–F across five categories — plus a PDF report emailed to them. The tool reuses the Lead Generation enrichment pipeline (spec §3.2) end-to-end, creating a warm lead in the Sales Pipeline with an auto-drafted follow-up email referencing their weakest score.

It is the primary inbound complement to the outbound Lead Generation system. Where Lead Gen finds prospects and reaches out cold, the Audit Tool lets prospects find SuperBad and self-qualify.

---

## 1. The 12 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Domain + email + name + optional social handles** | More info = better report, messaged honestly. Social handles skip discovery guessing. |
| Q2 | **Graded scorecard — overall A–F + 5 category sub-grades** | Emotional response over raw data. Shareable. Hides methodology. |
| Q3 | **Both — immediate on-screen reveal + branded PDF emailed** | Instant gratification on screen; branded take-away in inbox. |
| Q4 | **Lives at `/get-started/audit`** | Same public surface as Content Engine demo + Intro Funnel. Same codebase, same deploy. |
| Q5 | **Deal + auto-drafted follow-up referencing weakest score** | Warm lead skips `lead_candidates`, creates Deal directly via `createDealFromLead()` with `source: 'audit_tool'`. Opus draft references their specific gap. |
| Q6 | **Cinematic progressive reveal** | Processing animation with per-signal status → beat → grade lands with weight → categories build in. House spring motion. |
| Q7 | **Domain dedup without comparison** | Second audit for same domain links to existing company/Deal, adds new contact. No score comparison (signal noise would erode trust). |
| Q8 | **Follow-up leads with weakest category** | One sharp observation beats a comprehensive breakdown. Full scorecard is already in the PDF. |
| Q9 | **Rate limit + Cloudflare Turnstile + honeypot** | IP rate limit (3/24h) + invisible Turnstile + honeypot field. API costs are real (~$0.15–0.30/audit). |
| Q10 | **Audit completions inform lead gen targeting** | Existing viability profile reused by daily search dedup; scoring boost for self-auditors. Abandonments not tracked. |
| Q11 | **Full branded PDF — cover page, scorecard, recommendations, soft CTA** | 3–4 pages. Named filename. Forwardable. Per-category Claude recommendations. Earned CTA on final page. |
| Q12 | **No wizard — works out of the box** | Consumes enrichment APIs already configured via lead gen. Turnstile is an env var. |

---

## 2. Input form

### 2.1 Fields

| Field | Required | Purpose |
|---|---|---|
| **Business name** | Yes | Display + PDF cover + Deal record |
| **Website URL** | Yes | Primary enrichment input — domain extracted, all 9 signals keyed off this |
| **Your name** | Yes | Contact record + follow-up personalisation |
| **Email** | Yes | Report delivery + Deal contact + follow-up email |
| **Instagram handle** | No | Skips Instagram Business Discovery guessing; direct profile lookup |
| **Facebook page URL** | No | Feeds Meta Ad Library lookup with exact page ID |
| **YouTube channel** | No | Skips YouTube channel discovery; direct Data API lookup |
| **Google Maps listing URL** | No | Skips Maps search; direct place ID extraction |

### 2.2 Progressive disclosure

Optional fields are collapsed under a "Add your social profiles for a more detailed report" expandable. The form defaults to showing only the 4 required fields — clean and fast for people who want to get in and out. The expandable explains honestly: each handle you provide lets us check a real signal instead of guessing.

### 2.3 Messaging

Above the form: a single dry line. Not "Free Marketing Audit!" — something closer to the house voice. Content mini-session produces the final copy; intent is: understated, confident, no exclamation marks.

Below the submit button: "Takes about 20 seconds. We'll check your ads, your socials, your website, and your reputation — then grade you honestly."

### 2.4 Abuse protection

- **Cloudflare Turnstile** — invisible challenge, free tier. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` env vars. Validated server-side before enrichment runs.
- **Honeypot field** — invisible `<input>` with `tabindex="-1"` and `aria-hidden="true"`. Any submission with this field populated is silently dropped.
- **IP rate limit** — 3 submissions per IP per rolling 24 hours. Checked before Turnstile validation (cheapest gate first). Returns a friendly "You've checked a few already today — come back tomorrow" message, not an error.
- **Daily audit cap** — `settings.get('audit.daily_cap')` (default: 50). Hard ceiling on total audits per day across all visitors. When hit, form shows "We've hit our daily limit — try again tomorrow." Prevents API cost runaway from viral traffic or a social campaign driving unexpected volume.

---

## 3. Enrichment pipeline

### 3.1 Reuse

The audit tool calls the **same enrichment functions** built for Lead Generation (Wave 13 LG-2 and LG-3):

- `fetchMetaAdLibrary(domain)` / `fetchMetaAdLibraryByPageId(pageId)` — uses Facebook page URL if provided
- `fetchGoogleMaps(query)` / `fetchGoogleMapsByPlaceId(placeId)` — uses Maps URL if provided
- `fetchGoogleAdsTransparency(domain)`
- `fetchPageSpeedInsights(domain)`
- `fetchWhoisDomainAge(domain)`
- `fetchInstagramProfile(handle)` — uses provided handle if available, else derives from domain
- `fetchYouTubeChannel(channelId)` / `fetchYouTubeChannelByHandle(handle)` — uses provided channel if available
- `fetchWebsiteScrape(domain)`
- `fetchMapsExtras(placeId)`

All calls go through `external_call_log` with `actor: 'prospect'` (Cost & Usage Observatory attribution).

### 3.2 Orchestration

```ts
async function runAuditEnrichment(input: AuditInput): Promise<ViabilityProfile> {
  // All 9 signals in parallel, each with independent try/catch
  // Social handles override discovery where provided
  // Returns ViabilityProfile (same shape as lead-generation.md §5)
  // Per-signal errors logged in profile.fetch_errors
}
```

Graceful degradation: if any signal fails, the remaining signals still produce a profile. Categories with no data show "We couldn't check this one" instead of a grade. The overall grade is computed from available categories only.

### 3.3 External call attribution

All API calls log to `external_call_log` with:
- `actor_type: 'prospect'`
- `actor_id: audit_submission.id`
- `context: 'audit_tool'`

This lets the Cost & Usage Observatory attribute audit-tool API spend separately from lead-gen spend.

---

## 4. Scoring & grading

### 4.1 Five categories

| Category | Grade label | Signals consumed |
|---|---|---|
| **Advertising Presence** | How visible your paid marketing is | Meta Ads (active count, spend bracket, creatives) + Google Ads (active campaigns, creatives) |
| **Social Presence** | How active and established your social channels are | Instagram (followers, post count, 30d cadence) + YouTube (subscribers, videos, 90d cadence) |
| **Website Quality** | How your website performs and presents | PageSpeed score + domain age + about page + pricing page + team size signal |
| **Online Reputation** | What customers see when they search for you | Google Maps (rating, review count, photo count, last photo date, category) |
| **Content Activity** | How much you're putting out there | Blog detection from website scrape + YouTube upload cadence + Instagram post cadence + social handle presence |

### 4.2 Grading scale

Each category produces a 0–100 raw score using the same sub-scorer logic pattern as `lead-generation.md §6`. The raw score maps to a letter grade:

| Score range | Grade |
|---|---|
| 90–100 | A |
| 80–89 | A− |
| 70–79 | B+ |
| 60–69 | B |
| 50–59 | B− |
| 40–49 | C+ |
| 30–39 | C |
| 20–29 | C− |
| 10–19 | D |
| 0–9 | F |

### 4.3 Overall grade

Weighted average of available category scores (categories with no data are excluded from the average, not scored as zero):

| Category | Weight |
|---|---|
| Advertising Presence | 25% |
| Social Presence | 20% |
| Website Quality | 25% |
| Online Reputation | 20% |
| Content Activity | 10% |

### 4.4 Per-category explanation

Each category gets a 2–3 sentence plain-English explanation generated by Claude (Haiku-tier) from the raw signals. Not a recommendation — just an honest read of what the signals say. Example intent:

- Advertising Presence (B−): "You're running a handful of Meta ads but no Google campaigns. The ads you have are active, which puts you ahead of most businesses your size — but you're only visible on one platform."

### 4.5 Scoring functions

```ts
// lib/audit/scoring.ts
export function scoreAuditCategory(
  category: AuditCategory,
  profile: ViabilityProfile,
): { score: number; grade: string; available: boolean }

export function scoreAuditOverall(
  categoryScores: CategoryScore[],
): { score: number; grade: string }
```

Pure functions. No I/O. Fully unit-testable.

### 4.6 Lead gen cross-pollination (Q10 lock)

When the daily search (`runDailySearch`) encounters a domain that already has an audit submission:
1. Skip re-enrichment — reuse the stored `viability_profile_json` if it's less than 90 days old.
2. Apply a +8 scoring boost to both track scores (self-auditing is a genuine qualification signal — they're interested enough to check their own marketing).
3. Dedup against the existing Deal if one was already created from the audit.

The boost is bounded: it cannot push a below-floor candidate above the qualification floor on its own (+8 on a 30/100 SaaS score is still below the 40 floor).

---

## 5. On-screen reveal experience

### 5.1 Processing phase

After form submission, the page transitions to a full-screen processing view. Each enrichment signal gets a status line that updates live as API calls complete:

```
Checking your website...          ✓
Scanning ad activity...            ✓
Looking at your social presence... ●  (in progress)
Checking your online reputation... ○  (queued)
Reviewing your content...          ○
```

Status updates arrive via server-sent events (SSE) from the enrichment orchestrator. Each signal completion fires an event. The UI updates individual lines from queued → in progress → complete with house spring transitions on the checkmark.

### 5.2 The beat

After all signals complete, a 1.5-second deliberate pause. The status lines fade down. The screen holds empty for a beat. This is the "the machine is thinking" moment — borrowed from the Brand DNA reveal pattern.

### 5.3 Grade reveal

The overall grade lands at large scale (120px+) with a subtle scale-up entrance using the house spring. The `score-reveal` sound fires (if browser audio is available — no prompt, just opportunistic `AudioContext`). After the grade settles (400ms), a one-line plain-English summary fades in below: "Your marketing is [strong/decent/patchy/thin] — here's the breakdown."

### 5.4 Category build

Category grades appear one by one, staggered 200ms apart, each with a fade-up + house spring entrance. Each category shows: icon, name, letter grade (colour-coded: A/A− green, B+/B/B− amber, C+/C/C− orange, D/F red), and the 2–3 sentence explanation underneath.

### 5.5 Footer

Below the categories, a quiet line: "A PDF of this report is on its way to [email]. Keep it, forward it, or come back any time."

No CTA button on the results page. The earned CTA lives in the PDF (Q11 lock) and in the follow-up email (Q5/Q8 lock). The on-screen experience is generous — it gives without asking.

### 5.6 Graceful degradation

If fewer than 3 categories have data (severe API failures), skip the cinematic reveal entirely. Show a simplified results page with available categories and a message: "We couldn't get a complete picture — [list of what failed]. Your partial report is below, and we'll email you a full version once we can check the rest." Enqueue a retry for failed signals via `scheduled_tasks`.

---

## 6. PDF report

### 6.1 Structure (3–4 pages)

**Page 1 — Cover**
- SuperBad mark (top)
- "Marketing Audit" in large type
- Company name
- Date
- Named filename: `SuperBad-Marketing-Audit-[CompanyName].pdf`

**Page 2 — Scorecard**
- Overall grade (large, centred)
- One-sentence summary
- 5 category grades in a grid/table with letter + colour + score

**Page 3 — Recommendations**
- One section per category
- Grade + 2–3 sentence explanation (same as on-screen)
- 1–2 sentence "what you could do about this" recommendation (Claude Haiku-generated, specific to their signals, not generic advice)
- Recommendations naturally describe services SuperBad offers without being a pitch

**Page 4 — Soft CTA (earned)**
- Clean, minimal
- "Want to talk through this?"
- `andy@superbadmedia.com.au`
- No button, no urgency, no pitch. Follows `feedback_earned_ctas_at_transition_moments`.

### 6.2 Rendering

Uses the shared `renderToPdf()` Puppeteer renderer (landed in QB-3). HTML template at `lib/audit/report-template.ts`. Follows `feedback_takeaway_artefacts_brand_forward`: named filename, cover page, SuperBad mark.

### 6.3 Email delivery

Sent via `sendEmail()` with `classification: 'transactional'`. Template:
- Subject: "Your marketing audit — [CompanyName]"
- Body: 1–2 dry sentences ("Here's your report. The honest version, not the polite one."), PDF attachment, no CTA in the email body (the PDF has it).
- `from`: default SuperBad sender (not the cold outreach subdomain — this is transactional, they requested it).

---

## 7. Pipeline integration

### 7.1 Deal creation (Q5 lock)

On successful enrichment + scoring:

```ts
const deal = await createDealFromLead({
  company: {
    name: input.businessName,
    domain: extractDomain(input.websiteUrl),
    billing_mode: 'stripe',
  },
  contact: {
    name: input.name,
    email: input.email,
    role: null,       // unknown from form
    is_primary: true,
  },
  source: 'audit_tool',
  initial_value_cents: null,
  initial_value_estimated: true,
})
```

Deal enters Pipeline at **Lead** stage (not Contacted — no outbound has been sent yet; the follow-up draft goes through the approval queue or auto-sends per Q7.2).

### 7.2 Auto-drafted follow-up (Q5/Q8 lock)

After Deal creation, an Opus-tier Claude draft is generated:

```ts
generateAuditFollowUp({
  contact: { name, email },
  company: { name, domain },
  auditScores: categoryScores,
  weakestCategory: lowestScoringCategory,
  viabilityProfile: profile,
  brandDna: superbadBrandDnaProfile,
})
```

**Prompt intent:** reference the prospect's weakest category by name and score, make one specific observation about what the signals showed, and suggest a conversation — not a pitch. Voice-checked via `checkBrandVoiceDrift()`.

The draft is inserted into the **Unified Inbox** as a compose draft on the Deal's thread (not the outreach approval queue — audit follow-ups are warm, not cold). Andy sees it in his inbox next time he opens Lite, reviews, and sends with one click.

**Activity logging:** `audit_completed`, `audit_followup_drafted`. Both logged on the Deal's activity timeline.

### 7.3 Domain dedup (Q7 lock)

Before creating a new Deal, check:
1. Does a company with this domain already exist?
2. Does a Deal for this company already exist?

If yes to both: add the new contact to the existing company (if not already there), link the audit submission to the existing Deal, and still generate the follow-up draft (the new contact may be a different person). Do not create a duplicate Deal.

If company exists but no active Deal: create a new Deal on the existing company.

---

## 8. Data model

### 8.1 `audit_submissions`

One row per completed audit. Holds the form input, enrichment results, scores, and pipeline linkage.

```ts
export const auditSubmissions = sqliteTable('audit_submissions', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),

  // Form input
  business_name: text('business_name').notNull(),
  website_url: text('website_url').notNull(),
  domain: text('domain').notNull(),
  contact_name: text('contact_name').notNull(),
  contact_email: text('contact_email').notNull(),
  instagram_handle: text('instagram_handle'),
  facebook_page_url: text('facebook_page_url'),
  youtube_channel: text('youtube_channel'),
  google_maps_url: text('google_maps_url'),

  // Enrichment
  viability_profile_json: text('viability_profile_json', { mode: 'json' }).notNull(),

  // Scoring
  overall_score: integer('overall_score').notNull(),
  overall_grade: text('overall_grade').notNull(),
  category_scores_json: text('category_scores_json', { mode: 'json' }).notNull(),
  // Shape: { advertising: { score, grade, available }, social: { ... }, ... }

  // Per-category explanations (Haiku-generated)
  explanations_json: text('explanations_json', { mode: 'json' }),

  // PDF
  pdf_generated_at: integer('pdf_generated_at', { mode: 'timestamp_ms' }),
  pdf_emailed_at: integer('pdf_emailed_at', { mode: 'timestamp_ms' }),

  // Pipeline linkage
  deal_id: text('deal_id').references(() => deals.id),
  company_id: text('company_id').references(() => companies.id),
  contact_id: text('contact_id').references(() => contacts.id),
  followup_draft_id: text('followup_draft_id'),

  // Abuse tracking
  ip_hash: text('ip_hash').notNull(),  // SHA-256, not raw IP

  // Enrichment retry
  retry_pending: integer('retry_pending', { mode: 'boolean' }).notNull().default(false),
  retry_signals_json: text('retry_signals_json', { mode: 'json' }),  // which signals to retry

  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => Date.now()),
})
```

### 8.2 `audit_rate_limits`

IP-based rate limiting. Lightweight — no PII stored.

```ts
export const auditRateLimits = sqliteTable('audit_rate_limits', {
  ip_hash: text('ip_hash').primaryKey(),  // SHA-256
  submission_count: integer('submission_count').notNull().default(1),
  window_start: integer('window_start', { mode: 'timestamp_ms' }).notNull(),
})
```

### 8.3 Companion changes to existing tables

- **`activity_log.kind`**: add `audit_completed`, `audit_followup_drafted`, `audit_pdf_sent`, `audit_retry_completed`. Non-breaking enum extension.
- **`lead_candidates`**: add `sourced_from` enum value `'audit_tool'` for cross-pollination tracking. (Note: audit submissions don't create `lead_candidates` rows — this value is used when the daily search reuses an audit's viability profile.)

### 8.4 Settings keys

| Key | Default | Type | Description |
|---|---|---|---|
| `audit.daily_cap` | `50` | `number` | Max audits per day across all visitors |
| `audit.rate_limit_per_ip` | `3` | `number` | Max submissions per IP per 24h |
| `audit.scoring_boost` | `8` | `number` | Scoring boost applied when daily search encounters an audit domain |
| `audit.profile_reuse_days` | `90` | `number` | Days before an audit's viability profile is considered stale for lead gen reuse |

---

## 9. Build-time disciplines

1. **§12.A (Lead Gen) applies here.** All enrichment calls go through the same logged, cost-attributed pipeline. No direct vendor SDK imports.
2. **Scoring functions are pure.** `scoreAuditCategory` and `scoreAuditOverall` live in `lib/audit/scoring.ts`, are pure functions, and are fully unit-testable.
3. **No raw `process.env` in components.** Turnstile keys use `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) and `TURNSTILE_SECRET_KEY` (server via `lib/env.ts`).
4. **PDF uses shared renderer.** `renderToPdf()` from QB-3. No second PDF pipeline.
5. **Follow-up draft goes through Unified Inbox compose path**, not the outreach approval queue. Audit leads are warm, not cold.
6. **Abuse protection gates are ordered cheapest-first:** honeypot → IP rate limit → daily cap → Turnstile → enrichment. Most rejections never hit external APIs.
7. **SSE for reveal progress.** Server-sent events for the processing phase. No WebSocket (overkill for a one-directional status stream that lasts 20 seconds).
8. **`external_call_log` attribution.** All API calls logged with `actor: 'prospect'`, `context: 'audit_tool'` for Observatory cost separation.

---

## 10. Cross-spec integration points

| Consuming/producing spec | Integration |
|---|---|
| **Lead Generation** (§3.4 step 3) | Daily search dedup checks `audit_submissions.domain` within `audit.profile_reuse_days`. Reuses viability profile + applies `audit.scoring_boost`. |
| **Sales Pipeline** (§10.4) | `createDealFromLead()` with `source: 'audit_tool'`. Standard touchpoint, no new write path. |
| **Unified Inbox** | Follow-up draft inserted as compose draft on the Deal's thread. |
| **Cost & Usage Observatory** | `external_call_log` rows with `context: 'audit_tool'` enable per-feature cost attribution. |
| **Daily Cockpit** | New audit completions surface as a data source (count + company names in the morning brief). |

---

## 11. Success criteria

1. **Completion rate:** ≥60% of visitors who start the form complete it (4 required fields is low friction).
2. **Follow-up send rate:** ≥80% of auto-drafted follow-ups are sent by Andy (high = drafts are good enough to send with minimal edits).
3. **Reply rate on follow-ups:** ≥10% (warm leads should outperform cold outreach's 2–3% target).
4. **Cost per audit:** <$0.50 in API costs (enrichment + Haiku explanations + Opus follow-up draft).
5. **Time to results:** <30 seconds from form submission to grade reveal on screen.

---

## 12. Out of scope

- **Score comparison over time** (Q7 lock — signal noise makes this misleading in v1).
- **Public-facing leaderboard or benchmarks** ("see how you compare to your industry") — needs aggregated data that doesn't exist yet.
- **Custom branding per audit** (prospect's own colours/logo on the report) — this is SuperBad's tool, SuperBad's brand.
- **Audit tool for SaaS subscribers' clients** — Content Studio may reuse the pattern later; not v1.0.
- **Automatic retry scheduling for failed signals** — v1.0 logs the failure and shows partial results. Retry is manual (re-submit) or via a simple `scheduled_tasks` handler for the worst cases (§5.6).
- **Social sharing of results** ("share your grade on LinkedIn") — tempting but adds scope for marginal value.

---

## 13. Content mini-session owed

- Form copy (headline, subtitle, field labels, progressive-disclosure messaging, submit button text, processing status lines)
- Per-category explanation prompt calibration (Haiku)
- Follow-up email prompt calibration (Opus)
- PDF copy (cover line, recommendation section intros, CTA page copy)
- Report delivery email template
- Error/rate-limit/daily-cap messaging
- Browser tab titles (form, processing, results)

---

## 14. Phase 5 sizing

**2 sessions:**

| Session | Type | Context | Purpose |
|---|---|---|---|
| **AT-1** | FEATURE | large | Backend: form handler, Turnstile + honeypot + rate-limit validation, enrichment orchestration (reuse LG-2/LG-3), audit scoring engine, Deal creation + follow-up draft generation, PDF generation + email delivery, SSE endpoint for processing progress, daily search cross-pollination, data model + migration |
| **AT-2** | UI | large | Frontend: form page at `/get-started/audit`, progressive disclosure for optional fields, cinematic processing reveal (SSE consumer), grade reveal with motion + sound, category build-in, results page, graceful degradation for partial results, Turnstile widget integration |

**Dependencies:** Wave 13 (LG-1 through LG-5 minimum — enrichment pipeline + scoring engine must exist). Shared PDF renderer from QB-3. `sendEmail()` from A7. `createDealFromLead()` from LG-1.

**Rollback:** Feature-flag-gated via `settings.get('audit.daily_cap')` set to 0 disables the tool. Git-revertable (additive schema only).
