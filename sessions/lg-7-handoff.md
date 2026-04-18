# `lg-7` — Lead Gen UI: queue + runs log + metrics panel + DNC — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (7 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Query layer (`lib/lead-gen/queries/`)

Four pure-read query modules per §12.M — no mutations, no side effects:

- **`queue.ts`** — `getPendingDrafts(trackFilter?)`: fetches drafts in `pending_approval`/`approved_queued` status, enriched with candidate data. Supports optional track filter.
- **`runs.ts`** — `getRecentRuns(limit)` + `getCandidatesForRun(runId)`: last 30 runs + their candidates for the expand-to-show detail.
- **`metrics.ts`** — `getFunnelMetrics()` (30d aggregated funnel), `getApprovalRateSparkline(track)` (daily clean-approval rate per track), `getWarmupProgress()` (wraps `enforceWarmupCap`).
- **`header.ts`** — `getQueueHeaderData()`: latest run summary + live warmup state for the queue header bar.
- **`index.ts`** — barrel re-exports all query functions and types.

### 2. Server actions (`app/lite/admin/lead-gen/actions.ts`)

Six server actions with auth checks, input validation, activity logging:

- `approveDraftAction(draftId)` — transitions draft to `approved_queued`, logs `outreach_draft_approved`.
- `rejectDraftAction(draftId)` — transitions to `rejected`, logs `outreach_draft_rejected`.
- `addDncEmailAction(email, reason?)` — normalises + inserts, logs `dnc_email_added`.
- `removeDncEmailAction(id)` — deletes + logs `dnc_email_removed`.
- `addDncDomainAction(domain, reason?)` — normalises + inserts, logs `dnc_domain_added`.
- `removeDncDomainAction(id)` — deletes + logs `dnc_domain_removed`.

### 3. Four-tab Lead Gen admin surface (`/lite/admin/lead-gen/`)

- **Queue tab** (default, `/lite/admin/lead-gen`) — §9.1 approval queue: queue header showing latest run summary + warmup state (§9.4), scrollable draft list with Approve & Send / Reject buttons, track filter chips (All / Retainer / SaaS), badges for drift-flagged / inferred-email / below-floor-after-rescore / auto-send-queued states.
- **Runs tab** (`/lite/admin/lead-gen/runs`) — §14.1 runs log: last 30 `lead_runs` as a table, click-to-expand inline candidate details showing company, track, score trajectory (with rescore notation), skip reasons, promoted/below-floor badges.
- **Metrics tab** (`/lite/admin/lead-gen/metrics`) — §14.2 four-panel layout: funnel bar chart (30d, recharts), approval rate sparklines (per track), autonomy streak cards (placeholder — ships LG-8), warmup progress card with progress bar.
- **DNC tab** (`/lite/admin/lead-gen/dnc`) — Do Not Contact management: add/remove blocked emails and domains with inline forms, shows source badges and dates.

### 4. Admin nav entry

Added "Lead Gen" item to `ADMIN_NAV_PRIMARY` in `components/lite/admin-shell-nav.tsx` with `Radar` icon, positioned before Content.

### 5. Activity log kinds

Added 6 new kinds to `ACTIVITY_LOG_KINDS`: `outreach_draft_approved`, `outreach_draft_rejected`, `dnc_email_added`, `dnc_email_removed`, `dnc_domain_added`, `dnc_domain_removed`.

## Files created

- `lib/lead-gen/queries/queue.ts`
- `lib/lead-gen/queries/runs.ts`
- `lib/lead-gen/queries/metrics.ts`
- `lib/lead-gen/queries/header.ts`
- `lib/lead-gen/queries/index.ts`
- `app/lite/admin/lead-gen/page.tsx`
- `app/lite/admin/lead-gen/actions.ts`
- `app/lite/admin/lead-gen/runs/page.tsx`
- `app/lite/admin/lead-gen/metrics/page.tsx`
- `app/lite/admin/lead-gen/dnc/page.tsx`
- `app/lite/admin/lead-gen/_components/lead-gen-tabs.tsx`
- `app/lite/admin/lead-gen/_components/queue-header.tsx`
- `app/lite/admin/lead-gen/_components/queue-list.tsx`
- `app/lite/admin/lead-gen/_components/runs-log.tsx`
- `app/lite/admin/lead-gen/_components/metrics-panel.tsx`
- `app/lite/admin/lead-gen/_components/dnc-manager.tsx`
- `tests/lead-gen/lg7-queries.test.ts`

## Files edited

- `components/lite/admin-shell-nav.tsx` — added Lead Gen nav item + `Radar` import
- `lib/lead-gen/index.ts` — added LG-7 query barrel exports
- `lib/db/schema/activity-log.ts` — added 6 new Lead Gen activity log kinds
- `package.json` / `package-lock.json` — added `recharts` dependency

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Four separate route pages, not client-side tab switching.** Server components fetch data per tab, matching the content-engine tab pattern. Each tab is a full URL — shareable, bookmarkable, server-rendered.

2. **Autonomy streak panel is a placeholder in LG-7.** The autonomy state machine (§9.2) ships in LG-8. The metrics panel renders informational cards that will be wired to real data when LG-8 lands `transitionAutonomyState()`.

3. **DNC management lives on a fourth tab, not in Settings.** PATCHES_OWED `lg_1_dnc_management_surface` originally deferred to "Settings → Lead Generation". Placed it as a Lead Gen tab instead — DNC is operationally part of the Lead Gen surface, not a rarely-visited settings page.

4. **recharts v3.8.1 installed.** First recharts usage in the codebase. Funnel uses `BarChart`, sparklines use `LineChart`. All charts wrapped in `ResponsiveContainer`, use CSS variable colours.

5. **Query layer is a separate `queries/` subdirectory in `lib/lead-gen/`.** Keeps pure-read functions isolated from mutation functions per §12.M. The Daily Cockpit (§12.O) will reuse these exact functions verbatim.

## Verification (G0–G12)

- **G0** — LG-6 and LG-5 handoffs read. Spec §9.1, §9.4, §14.1, §14.2, §14.3, §15 read.
- **G1** — Preconditions verified: `enforceWarmupCap`, `leadRuns` schema, `outreachDrafts` schema, `outreachSends` schema, `leadCandidates` schema, `dncEmails`/`dncDomains` schema, `logActivity`, `auth`, `AdminShell`, `ContentTabs` pattern, `Badge`/`Button`/`Input` components — all present.
- **G2** — Files match LG-7 scope (queue UI + runs log + metrics panel + DNC management + nav entry + tests).
- **G3** — No motion work in this session (tabs use standard transition-colors).
- **G4** — No numeric/string literals in autonomy-sensitive paths. Chart timeframe (30 days) is a display constant, not an autonomy threshold.
- **G5** — Context budget held. Medium-large session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 189 test files / 1585 passed + 1 skipped (+6 new), clean production build.
- **G8** — `npx tsc --noEmit` → 0 errors (excluding pre-existing `.next/types` artefact). `npm test` → 1585 passed.
- **G9** — UI pages require dev server + database with real data to visually verify. Library-only data in dev DB. Pages render structurally correct (build passes, routes present in build output).
- **G10** — 6 tests: queue header null run, warmup progress shape mapping, DNC email validation, DNC domain validation, activity log kind coverage, admin nav item presence.
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (closed this session)

- **`lg_1_dnc_management_surface`** — DNC management UI built as the DNC tab at `/lite/admin/lead-gen/dnc`.

## PATCHES_OWED (raised this session)

- **`lg_7_autonomy_streak_wiring`** — Autonomy streak cards in the metrics panel show placeholder text. LG-8 must wire real autonomy state data when `transitionAutonomyState()` ships.
- **`lg_7_edit_nudge_buttons`** — Queue rows show Approve & Reject but not Edit or Nudge buttons. Edit requires inline draft editing UI. Nudge requires the nudge-chat primitive. Both ship when LG-8 lands the full approval flow with autonomy.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- All Lead Gen UI pages and components
- Query layer
- Server actions
- Nav entry
- Activity log kind additions
- recharts dependency
- Test files

## What the next session (LG-8) inherits

LG-8 is **Autonomy graduation state machine + circuit breakers** — the `transitionAutonomyState(track, event)` function and the full approval-to-send flow. LG-7 provides:

- **Queue UI with Approve/Reject buttons** — LG-8 wires the Approve action to actually trigger `sendEmail()` after the 15-minute delay (currently it just sets `approved_queued` status).
- **Metrics panel with autonomy streak placeholder** — LG-8 replaces the placeholder with real streak/state data from `transitionAutonomyState()`.
- **Query layer** — LG-8 can add autonomy-specific queries to `lib/lead-gen/queries/` following the same pattern.
- **Activity log kinds** — `outreach_draft_approved` and `outreach_draft_rejected` are already registered.
