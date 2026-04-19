# `AT-1` — Free Audit Tool backend — Handoff

**Closed:** 2026-04-19
**Type:** FEATURE (large)
**Model tier:** Sonnet

---

## What was built

### 1. `audit_submissions` + `audit_rate_limits` tables (`lib/db/schema/audit-submissions.ts`)

- `audit_submissions`: full schema per spec §8.1 — form input, enrichment results, scores, explanations, PDF timestamps, pipeline linkage (deal/company/contact), IP hash, retry state.
- `audit_rate_limits`: IP-based rate limiting table (ip_hash PK, submission_count, window_start).
- Indexes on domain+created_at, email+created_at, company_id.

### 2. Audit scoring engine (`lib/audit/scoring.ts`)

Pure functions. Five category scorers:
- **Advertising Presence** — Meta Ads (creative count, spend bracket) + Google Ads (campaign count, creatives). Weight: 25%.
- **Social Presence** — Instagram (followers, posts, 30d cadence) + YouTube (subscribers, videos, 90d cadence). Weight: 20%.
- **Website Quality** — PageSpeed score, domain age, about/pricing pages, team size, pricing tier. Weight: 25%.
- **Online Reputation** — Google Maps rating, review count, photo count, last photo date. Weight: 20%.
- **Content Activity** — Blog detection, YouTube upload cadence, Instagram post cadence, social handle presence. Weight: 10%.

`scoreAuditCategory()` → 0–100 raw score → letter grade (A through F, 10 tiers).
`scoreAuditOverall()` → weighted average of available categories (unavailable excluded, not zero-scored).

### 3. Enrichment orchestrator (`lib/audit/enrichment.ts`)

`runAuditEnrichment()` — runs all 9 signals in parallel via Promise.allSettled:
- Meta Ads (via `searchMetaAdLibrary`, domain-matched)
- Google Ads Transparency (via `searchGoogleAdsTransparency`, domain-matched)
- Google Maps (via `searchGoogleMaps` or direct place ID if URL provided)
- PageSpeed, WHOIS, Instagram, YouTube, Website Scrape, Maps Extras (reuse LG-3 enrichment functions)

Social handle overrides: when user provides Instagram handle, Facebook page URL, YouTube channel, or Google Maps URL, those skip discovery guessing.

All API calls logged to `external_call_log` with `actor_type: 'prospect'` and `context: 'audit_tool'`.

Progress callback support for SSE streaming.

### 4. Category explanations (`lib/audit/explanations.ts`)

`generateCategoryExplanations()` — Haiku-tier LLM generates 2–3 sentence plain-English explanation per category. Runs all available categories in parallel. Unavailable categories get a standard fallback message.

### 5. PDF report template (`lib/audit/report-template.ts`)

`buildAuditReportHtml()` — 3-page branded report:
- Page 1: Cover (SuperBad mark, "Marketing Audit", company name, date)
- Page 2: Scorecard (overall grade large + colour-coded, category table with grades + scores + explanations)
- Page 3: Soft CTA ("Want to talk through this?" + email)

`auditPdfFilename()` — generates `SuperBad-Marketing-Audit-{CompanyName}.pdf`.

### 6. Report delivery (`lib/audit/deliver-report.ts`)

`deliverAuditReport()` — renders PDF via `renderToPdf()`, sends via `sendEmail()` with attachment. Logs `audit_pdf_sent` activity.

### 7. Pipeline integration (`lib/audit/pipeline.ts`)

`createAuditDeal()` — domain dedup per spec §7.3:
- Existing company + existing deal → add new contact, reuse deal
- Existing company + no deal → create new deal on existing company
- No company → full `createDealFromLead()` with `source: 'audit_tool'`

Logs `audit_completed` activity on the deal.

### 8. Follow-up draft generator (`lib/audit/followup.ts`)

`generateAuditFollowUp()` — Opus-tier draft referencing weakest category by name and score. Subject: "Your {weakest_category} score — {CompanyName}". Logs `audit_followup_drafted` activity.

### 9. Rate limiting (`lib/audit/rate-limit.ts`)

Three-gate abuse protection:
- `checkRateLimit()` — IP rate limit (default 3/24h via `audit.rate_limit_per_ip`)
- `checkDailyCap()` — global daily cap (default 50 via `audit.daily_cap`)
- `hashIp()` — SHA-256 hash, no raw IP stored

### 10. Turnstile verification (`lib/audit/turnstile.ts`)

`verifyTurnstile()` — Cloudflare Turnstile server-side validation. Uses `TURNSTILE_SECRET_KEY` env var.

### 11. API routes

- `/api/audit/submit` (POST) — synchronous form handler. Validates (honeypot → rate limit → daily cap → Turnstile → enrichment → scoring → deal → follow-up + PDF). Returns JSON with scores.
- `/api/audit/submit-stream` (POST) — SSE streaming variant. Same validation + enrichment, but streams signal progress events for the cinematic reveal UI. Events: `started`, `signal`, `enrichment_complete`, `scored`, `complete`.

### 12. `sendEmail()` attachment support

Extended `SendEmailParams` with optional `attachments: Array<{ filename, content: Buffer }>`. Wired through to Resend SDK.

### 13. Migration (`0050_at1_audit_tool.sql`)

Creates `audit_submissions` + `audit_rate_limits` tables. Seeds 4 settings keys.

### 14. LG-11 migration fix (`0049_lg11_case_snippets.sql`)

Fixed pre-existing issues:
- Added `--> statement-breakpoint` markers (multi-statement SQL without markers was failing with better-sqlite3)
- Fixed settings INSERT to include `type` and `updated_at_ms` columns (were missing, causing 6 unseeded settings keys)

### New files (12)

| File | Purpose |
|---|---|
| `lib/db/schema/audit-submissions.ts` | Schema for audit_submissions + audit_rate_limits |
| `lib/audit/scoring.ts` | Pure scoring functions (5 categories + overall) |
| `lib/audit/enrichment.ts` | 9-signal enrichment orchestrator |
| `lib/audit/explanations.ts` | Haiku-generated category explanations |
| `lib/audit/report-template.ts` | PDF report HTML template |
| `lib/audit/deliver-report.ts` | PDF render + email delivery |
| `lib/audit/pipeline.ts` | Deal creation + domain dedup |
| `lib/audit/followup.ts` | Opus follow-up draft generator |
| `lib/audit/rate-limit.ts` | IP rate limit + daily cap |
| `lib/audit/turnstile.ts` | Cloudflare Turnstile verification |
| `app/api/audit/submit/route.ts` | Synchronous form handler |
| `app/api/audit/submit-stream/route.ts` | SSE streaming form handler |
| `lib/db/migrations/0050_at1_audit_tool.sql` | Migration |
| `lib/ai/prompts/free-audit-tool.md` | Prompt reference file |
| `tests/at1-scoring.test.ts` | Scoring engine tests |

### Edited files (7)

| File | Change |
|---|---|
| `lib/db/schema/index.ts` | Export audit-submissions |
| `lib/db/schema/activity-log.ts` | +4 kinds (audit_completed, audit_followup_drafted, audit_pdf_sent, audit_retry_completed) |
| `lib/ai/models.ts` | +2 job slugs (audit-category-explanation → haiku, audit-followup-draft → opus) |
| `lib/settings.ts` | +4 settings keys (audit.daily_cap, audit.rate_limit_per_ip, audit.scoring_boost, audit.profile_reuse_days) |
| `lib/channels/email/send.ts` | Added attachments support to sendEmail |
| `lib/db/migrations/0049_lg11_case_snippets.sql` | Fixed breakpoints + settings INSERT columns |
| `lib/db/migrations/meta/_journal.json` | Added entry 50 |

### Settings keys (4 new)

| Key | Default | Type |
|---|---|---|
| `audit.daily_cap` | `50` | integer |
| `audit.rate_limit_per_ip` | `3` | integer |
| `audit.scoring_boost` | `8` | integer |
| `audit.profile_reuse_days` | `90` | integer |

### Test files (1 new, 1 edited)

| File | Tests |
|---|---|
| `tests/at1-scoring.test.ts` | 7 — all 5 categories + overall weighted average + empty profile |
| `tests/settings.test.ts` | Updated count 139 → 149 |

## Key decisions

1. **Two API routes (sync + SSE).** The sync `/api/audit/submit` returns JSON for simple integration. The SSE `/api/audit/submit-stream` streams signal progress for the cinematic reveal UI (AT-2). Both share identical validation and orchestration logic.

2. **Discovery sources used for single-domain lookup.** Meta Ad Library and Google Ads Transparency are search APIs, not domain-lookup APIs. The enrichment orchestrator searches for the business name/domain and matches results. This is imprecise but reuses existing infrastructure without new API integrations.

3. **Follow-up draft → Unified Inbox compose path.** Per spec §7.2, follow-up drafts go through the Unified Inbox compose path (not the outreach approval queue). The `followup_draft_id` field on `audit_submissions` will link to the compose draft once the Inbox surface consumes it. For now, the draft text is generated but not yet wired into Inbox tables (those are built in Wave 9 — already closed — but the compose action route would need an explicit integration point).

4. **PDF delivery via sendEmail attachments.** Extended `sendEmail()` to support attachments rather than creating a separate PDF delivery mechanism. Resend SDK supports `attachments` natively.

5. **Fixed LG-11 migration (0049).** Pre-existing issues: missing breakpoint markers caused all migration-dependent tests to fail (81 files); missing `type` + `updated_at_ms` columns in settings INSERT left 6 keys unseeded. Both fixed as part of this session since they blocked verification.

## What the next session should know

- **AT-2 is the frontend.** Form page at `/get-started/audit`, cinematic reveal (SSE consumer), results page. The SSE endpoint at `/api/audit/submit-stream` is ready — AT-2 consumes it.
- **Lead gen cross-pollination wiring.** Spec §4.6 says the daily search should check `audit_submissions.domain` within `audit.profile_reuse_days` and apply `audit.scoring_boost`. This is a patch to the daily search runner in `lib/lead-gen/` — not yet done. Small integration, could be a PM session or folded into AT-2.
- **Follow-up → Inbox wiring.** `generateAuditFollowUp()` produces draft text but doesn't insert into the Unified Inbox compose_drafts table. That integration needs the Inbox route to accept an audit-sourced compose action. Could be a PM session.
- **Content mini-session owed.** Spec §13 lists form copy, processing status lines, error messaging, etc. Not yet written — AT-2 will need placeholder copy or the CMS session should run first.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 215 files, 1813 passed, 0 failures, 1 skipped
- No browser check required (backend-only session)

## Rollback strategy

**Feature-flag-gated.** Set `audit.daily_cap` to 0 via `settings.set()` to disable the tool entirely. Schema is additive (new tables only). Git-revertable with no data shape changes to existing tables.
