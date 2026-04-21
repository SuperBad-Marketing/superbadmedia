# COB-11 Handoff — Cost & Usage Observatory: Settings, Per-Job Detail, Tier Health, Emails

**Date:** 2026-04-21
**Wave:** 21 (final session)
**Status:** COMPLETE

## What was built

### 1. Settings page (`/lite/observatory/settings`)

Server component at `app/lite/observatory/settings/page.tsx`. Admin-auth gated. Breadcrumb back to observatory.

- **Three AUD threshold fields** — number inputs with dollar prefix, nullable (empty = not set).
- **Projection alert toggle** — checkbox with description.
- **Weekly digest toggle** — checkbox with description.
- **Full job registry table** — all registered jobs with vendor, per-call/daily bands, learned-band multiplier, live/paused status. Job names link to per-job detail view.
- **Save button** — PATCHes settings via `/api/admin/observatory/settings`, logs `observatory_settings_changed` to activity log.

### 2. Per-job detail page (`/lite/observatory/jobs/[key]`)

Server component at `app/lite/observatory/jobs/[key]/page.tsx`. Admin-auth gated. Breadcrumbs to observatory + settings.

- **Job header** — mono font job name, vendor + description, total call count, current band values.
- **30-day bar chart** — daily totals as proportional bars with tooltip showing date/cost/calls.
- **Prompt version table** — hash (truncated), first/last seen, call count, total cost. Only renders for jobs with prompt_version_hash data.
- **Call history table** — paginated (100/page), showing time (relative + absolute tooltip), actor type/id, cost, prompt hash.

### 3. Tier-health panel on observatory dashboard

`TierHealthPanel` client component added to `/lite/observatory` between Platform Status and Anomalies panels.

- **One card per SaaS tier** — subscriber count, revenue, avg margin, % underwater, health dot (green/amber/red).
- **Expandable** — click a tier card to see subscriber list sorted by margin ascending.
- **Large-tier recommendation cards** — negative-margin subscribers on the Large tier get an expanded card showing top 3 cost drivers and action options (cap conversation / renegotiate / accept as goodwill).
- **All-green empty state** — "Every tier is healthy. Margins are where they should be."

### 4. `tier_health` + `unknown_job` banner kinds

`getObservatoryHealthBanners()` in `lib/observatory/health-banners.ts` now emits:

- **`tier_health`** banners when a tier has ≥30% underwater subscribers (health = red).
- **`unknown_job`** banners when an unregistered job key appears in the last 24 hours of `external_call_log`.

### 5. Weekly digest email

`lib/observatory/weekly-digest-email.ts`:

- **`buildWeeklyDigest()`** — assembles subject + HTML body from the content copy pools in `docs/content/cost-usage-observatory/weekly-digest.md`. Posture-adaptive subject lines (green/amber/red). Sections: The number, Tier check, Top jobs, Anomalies, closer.
- **`sendWeeklyDigestEmail()`** — sends via `sendEmail({ classification: 'transactional' })`. Returns `{ sent: false }` if digest is disabled.
- **Scheduled task handler** — `weekly_digest_send` registered in handler index, delegates to `sendWeeklyDigestEmail()`.

### 6. Negative-margin email

`lib/observatory/negative-margin-email.ts`:

- **`sendNegativeMarginEmail(subscriber, tierName)`** — transactional email to Andy showing revenue/cost/margin breakdown, top cost drivers, and action options. Links to observatory.

### 7. API routes

- `GET /api/admin/observatory/settings` — returns settings + job band list.
- `PATCH /api/admin/observatory/settings` — updates individual settings, logs activity.
- `GET /api/admin/observatory/job-detail?job=X&page=N` — returns job detail with call history, daily summary, prompt versions.
- `GET /api/admin/observatory/tier-health` — returns per-tier health cards.

### 8. Query modules

- `lib/observatory/queries/tier-health.ts` — joins deals + saas_tiers + external_call_log to compute per-tier margins.
- `lib/observatory/queries/job-detail.ts` — paginated call history, daily summary, prompt version history.
- `lib/observatory/queries/settings.ts` — reads settings + builds job band list from registry.

## New files

- `lib/observatory/queries/tier-health.ts`
- `lib/observatory/queries/job-detail.ts`
- `lib/observatory/queries/settings.ts`
- `lib/observatory/weekly-digest-email.ts`
- `lib/observatory/negative-margin-email.ts`
- `lib/scheduled-tasks/handlers/weekly-digest-send.ts`
- `app/api/admin/observatory/settings/route.ts`
- `app/api/admin/observatory/job-detail/route.ts`
- `app/api/admin/observatory/tier-health/route.ts`
- `app/lite/observatory/settings/page.tsx`
- `app/lite/observatory/jobs/[key]/page.tsx`
- `components/lite/observatory/tier-health-panel.tsx`
- `components/lite/observatory/observatory-settings-form.tsx`
- `components/lite/observatory/job-detail-view.tsx`
- `tests/cob11-settings-jobs-tierhealth.test.ts`

## Edited files

- `app/lite/observatory/page.tsx` — added tier-health panel + settings link
- `lib/observatory/health-banners.ts` — wired `tier_health` + `unknown_job` banner kinds
- `lib/observatory/index.ts` — added exports for new query modules + email modules
- `lib/scheduled-tasks/handlers/index.ts` — registered `weekly_digest_send` handler

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob11-settings-jobs-tierhealth.test.ts` — 10 passed
- Full suite run — 282 files, 2873 tests, zero regressions (up from 281/2863)

## Rollback

- All changes are additive — git-revertable
- New pages are admin-gated; no client-facing impact
- Weekly digest is gated by `observatory.weekly_digest_enabled` setting

## Key decisions

- **Settings use string serialisation for `settings.set()`** — the settings system stores all values as strings; the query module parses them back on read.
- **Tier health queries join deals + saas_tiers + external_call_log** — correlates subscriber revenue with their `actor_type='external'` cost entries using `company_id` as the join key.
- **Unknown job detection scans last 24h** — avoids false positives from historical job names that may have been deregistered.
- **Tier health banners fire at ≥30% underwater** — matching the "red" threshold used in the panel.
- **Large-tier-only recommendation cards** — per spec, only Large tier shows per-subscriber action cards; Small/Medium surface as tier-level alerts.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- **Wave 21 is complete.** All 11 COB sessions + CMS-6 are shipped.
- **Wave 22 (Daily Cockpit) is next.** DC-1 should start the aggregator scaffold + banner strip. The observatory's `getObservatoryHealthBanners()` is one of the banner sources DC-5 needs to call.
- The observatory's complete banner contract (5 kinds) is now fully implemented: `cost_anomaly`, `monthly_threshold`, `projection_threshold`, `tier_health`, `unknown_job`.
- The weekly digest handler (`weekly_digest_send`) is registered but no recurring scheduled task row exists in the DB yet — the seed migration or a Phase 5 infra session should create the Sunday-evening task entry.
