# DC-4 Handoff — Daily Cockpit: Attention Rail Wiring

**Date:** 2026-04-21
**Wave:** 22 (fourth session)
**Status:** COMPLETE

## What was built

### 1. Real `getWaitingItems()` implementations for 9 source specs

Replaced aggregator stubs with database-backed implementations:

- **`lib/quotes/cockpit.ts`** — `getQuoteWaitingItems()`: draft quotes (age_of_wait) + quotes expiring within 48h (time_sensitive). Joins companies for display names.
- **`lib/invoicing/cockpit.ts`** — `getInvoiceWaitingItems()`: draft invoices pending review (respects auto_send_at_ms window) + overdue invoices with days-overdue label.
- **`lib/saas-products/cockpit-waiting.ts`** — `getSaasWaitingItems()`: deals with `subscription_state = 'past_due'`. Scoped `fleet`.
- **`lib/inbox/cockpit.ts`** — `getInboxWaitingItems()`: threads where last inbound > last outbound and >24h old (reply-waiting) + open tickets >48h stale. Dedupes overlaps.
- **`lib/outreach/cockpit.ts`** — `getLeadGenWaitingItems()`: outreach drafts in `pending_approval` status, aggregated as single chip with count.
- **`lib/intro-funnel/cockpit.ts`** — `getIntroFunnelWaitingItems()`: bookings within 24h needing prep (time_sensitive) + completed questionnaires awaiting review (age_of_wait).
- **`lib/content/cockpit.ts`** — `getContentWaitingItems()`: own-company blog posts in `in_review` (scope: own) + fleet posts stalled >48h in review (scope: fleet).
- **`lib/brand-dna/cockpit.ts`** — `getBrandDnaWaitingItems()`: client assessments stuck in `in_progress` for >7 days. Hardcoded threshold (rare, high-value items).
- **`lib/six-week-plans/cockpit.ts`** — `getSixWeekPlanWaitingItems()`: plans in `pending_strategy_review` or `pending_detail_review` + plans with unresolved revision requests.

### 2. Wired hiring pipeline (already built, not imported)

`lib/hiring/cockpit.ts` existed from HP-19 but the aggregator had a local stub. Now properly imported.

### 3. Updated aggregator

`lib/cockpit/aggregator.ts` now imports 13 real sources (was 3 real + 8 stubs). Remaining stubs: `getClientManagementWaitingItems` (needs portal escalation mechanism), `getWizardWaitingItems` (needs acknowledgement mechanism). Health banner stubs unchanged (DC-5 scope).

### 4. Sort contract enforcement

Sort was already correctly implemented in DC-1. DC-4 added comprehensive test coverage: 6 sort tests covering time_sensitive-first ordering, deadline ascending, wait-start ascending, tiebreaks, empty arrays, and mixed-type ordering.

## New files

- `lib/quotes/cockpit.ts`
- `lib/invoicing/cockpit.ts`
- `lib/saas-products/cockpit-waiting.ts`
- `lib/inbox/cockpit.ts`
- `lib/outreach/cockpit.ts`
- `lib/intro-funnel/cockpit.ts`
- `lib/content/cockpit.ts`
- `lib/brand-dna/cockpit.ts`
- `lib/six-week-plans/cockpit.ts`
- `tests/dc4-waiting-items.test.ts`

## Edited files

- `lib/cockpit/aggregator.ts` — replaced 8 stubs with real imports, added 2 new sources (brand-dna, six-week-plans)

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run tests/dc4-waiting-items.test.ts` — 8 passed
- Full suite — 286 files, 2912 tests, zero regressions (up from 285/2904)

## Rollback

- All changes are additive — git-revertable
- Each source is wrapped in `Promise.allSettled` — one broken source never crashes the cockpit
- All new files are pure query functions with no side effects

## Key decisions

- **Hardcoded 7-day threshold for stuck Brand DNA assessments.** The `brand_dna.stuck_assessment_days` settings key doesn't exist in the registry. Since this is a rare chip (spec calls it "rare; high-value"), hardcoded is fine for v1; promote to settings key if the threshold needs tuning.
- **Lead gen drafts aggregated as single chip.** Rather than one chip per draft (which could flood the rail), outreach drafts show as a single "N drafts awaiting approval" chip. The oldest draft's timestamp drives urgency.
- **SaaS payment-failure chips scoped as `fleet`.** Past-due subscribers are fleet-level items per spec's fleet-scoping convention.
- **Inbox deduplication.** Threads that appear in both reply-waiting (>24h) and open-ticket (>48h) sets only appear once (reply-waiting takes precedence).
- **Client Management and Wizard stubs remain.** Client Management needs portal escalation state that isn't queryable yet. Wizard completions need an acknowledgement mechanism (tap-through marks as seen) that doesn't exist yet. Both are low-frequency sources.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)

## Next session should know

- **DC-4 completes the attention rail wiring.** All high-frequency waiting-item sources are live. The 2 remaining stubs (Client Management, Setup Wizards) are low-frequency and can be wired when their parent specs add the needed state columns.
- **DC-5 (banner strip wiring) is next in the cockpit sequence.** Same pattern as DC-4 but for `getHealthBanners()` — some are already wired (task, observatory, SaaS, hiring, finance), remaining stubs are inbox, content engine, and wizards.
- The pre-existing egg build error (`lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain) still blocks dev overlay and production builds.
- Source naming convention is mixed: `task_manager` (underscore) vs `hiring-pipeline` / `quote-builder` (hyphen). The waiting page display `.replace(/_/g, " ")` only handles underscores. Low-priority consistency fix.
