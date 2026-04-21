# COB-10 Handoff — Cost & Usage Observatory: Dashboard Shell + Anomaly Detail View

**Date:** 2026-04-21
**Wave:** 21
**Status:** COMPLETE

## What was built

### 1. Observatory dashboard page (`/lite/observatory`)

Server component at `app/lite/observatory/page.tsx`. Admin-auth gated. Four panels vertically stacked per spec §5:

- **Platform Status panel** — MTD spend (big number + sparkline), linear run-rate projection, week-vs-prior delta, threshold bar with green/amber/red colouring + threshold ticks + dashed projection overhang.
- **Kill Switch bar** — renders only when jobs are paused. Each row shows job name, disabled-until timestamp, and a one-click Resume button that hits `POST /api/admin/observatory/kill-switch` (from COB-9).
- **Live Anomalies panel** — unresolved `cost_anomalies` ordered by tier DESC then last_fired_at DESC. Each row: tier badge, job (mono font), detector label, diagnosis snippet (first 15 words), observed value, fire count × relative time. Click navigates to detail view. Resolved anomalies (last 7 days) in a collapsible section.
- **Top Jobs panel** — table of all jobs this month with vendor, total calls, total AUD, avg/call. Sortable by any column (click column header toggles asc/desc).

### 2. Anomaly detail page (`/lite/observatory/anomalies/[id]`)

Server component at `app/lite/observatory/anomalies/[id]/page.tsx`. Admin-auth gated. Breadcrumb links back to observatory.

- **Diagnosis Card** — renders `diagnosis_json` from the anomaly row: hypothesis paragraph, confidence badge (high/med/low with colour), recommended action, timeline markdown. Shows "Diagnosis pending" if diagnosis hasn't run yet.
- **Actions bar** — Kill switch (prominent red for severe, secondary for others), Acknowledge & suppress 24h, Adjust bands (opens inline band editor). Kill switch calls existing COB-9 API route. Acknowledge calls new `POST /api/admin/observatory/anomaly`. Band editor calls existing COB-7 bands API route.
- **Raw Data table** — collapsed by default. Last 100 calls for the anomaly's job (+ actor if scoped). Columns: time, actor type/id, units (formatted per type), cost, prompt hash.

### 3. API routes

- `GET /api/admin/observatory/dashboard` — returns `{ mtd, anomalies: { active, resolved }, top_jobs, kill_switched }`. All data fetched in parallel.
- `GET /api/admin/observatory/anomaly?id=X` — returns anomaly row + last 100 calls.
- `POST /api/admin/observatory/anomaly` — acknowledge action (updates acknowledged_at_ms + acknowledged_until_ms, logs to activity_log).

### 4. Data query layer

- `lib/observatory/queries/dashboard.ts` — `getMtdSummary()`, `getActiveAnomalies()`, `getRecentResolvedAnomalies()`, `getTopJobs()`, `getKillSwitchedJobs()`.
- `lib/observatory/queries/anomaly-detail.ts` — `getAnomalyDetail(id)`.

### 5. Admin nav entry

Observatory added to `ADMIN_NAV_UTILITY` in `admin-shell-nav.tsx` with `Activity` icon from lucide-react, matching `/lite/observatory` prefix.

### 6. Layout

`app/lite/observatory/layout.tsx` wraps `AdminShellWithNav` + `AdminEventToasts` following the Finance pattern.

## New files

- `lib/observatory/queries/dashboard.ts`
- `lib/observatory/queries/anomaly-detail.ts`
- `app/api/admin/observatory/dashboard/route.ts`
- `app/api/admin/observatory/anomaly/route.ts`
- `app/lite/observatory/layout.tsx`
- `app/lite/observatory/page.tsx`
- `app/lite/observatory/anomalies/[id]/page.tsx`
- `components/lite/observatory/platform-status-panel.tsx`
- `components/lite/observatory/anomalies-panel.tsx`
- `components/lite/observatory/top-jobs-panel.tsx`
- `components/lite/observatory/kill-switch-bar.tsx`
- `components/lite/observatory/diagnosis-card.tsx`
- `components/lite/observatory/raw-data-table.tsx`
- `components/lite/observatory/anomaly-actions.tsx`
- `tests/cob10-dashboard-anomaly-detail.test.ts`

## Edited files

- `lib/observatory/index.ts` — added exports for query modules
- `components/lite/admin-shell-nav.tsx` — added `Activity` icon import + observatory nav entry

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/cob10-dashboard-anomaly-detail.test.ts` — 13 passed
- Full suite run — 281 files, 2863 tests, zero regressions (up from 280/2850)

## Rollback

- All changes are additive — git-revertable
- Observatory pages are admin-gated; no client-facing impact
- Nav entry removal is a single line change

## Key decisions

- **Server components for pages** — both dashboard and anomaly detail are server components with data fetching. Client interactivity (sort, collapse, actions) is in child client components.
- **MTD daily aggregation uses Melbourne timezone offset** — `+10 hours` in the SQLite date function to group by AEST day, matching the platform's default timezone.
- **Projection only shows when MTD > 0** �� avoids divide-by-zero on day 1 of month.
- **Diagnosis snippet truncated to 15 words** — keeps anomaly list scannable; full hypothesis on detail page.
- **Band editor is inline on the detail page** — per spec §3.3 "one-click band editor", not a separate settings route. Changes route through existing COB-7 bands API.
- **Activity icon for nav** — `Activity` (pulse line) from lucide-react suits the observatory metaphor better than `Telescope` or `Eye`.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- COB-11 is the final Wave 21 session. Per the tracker it should handle whatever remains — likely the settings page at `/lite/observatory/settings` (spec §5.5: threshold fields, projection/digest toggles, job band list), the per-job detail view at `/lite/observatory/jobs/[key]` (spec §5.4: call history, band editor, prompt-version history), and the tier-health panel (spec §5.2: per-tier cards with margins, expand to subscriber list).
- The tier-health panel needs SaaS subscription + external_call_log join queries — it reads subscriber tier from the subscriptions table and correlates with actor_type='external' spend.
- `getObservatoryHealthBanners()` from COB-9 does NOT yet emit `tier_health` or `unknown_job` kind banners — those need the tier-health panel data and should be wired in COB-11.
- The weekly digest email (spec §7 prompt 3) and negative-margin email (spec §7 prompt 2) are not yet built — if they're in scope for COB-11, they'll need the tier-health aggregation.
