# `ce-11` — Subscriber list management + fleet overview — Handoff

**Closed:** 2026-04-18
**Wave:** 12 — Content Engine (11 of 13)
**Model tier:** Sonnet (as recommended — standard UI session)

---

## What was built

The **List tab** at `/lite/content/list` (subscriber list management) and **fleet overview** at `/lite/content/subscribers` (per-subscriber engine health). Two admin surfaces consuming CE-1's newsletter subscriber schema.

**Files created:**

- `lib/content-engine/subscriber-list.ts` — `listSubscribers()`, `getListHealth()`, `importSubscribersFromCsv()`, `exportSubscribersCsv()`, `generateEmbedCode()`. CSV import with dedup + validation + `pending_confirmation` status. CSV export includes all contacts (including removed) with status column. Health stats: bounce/unsub/inactive rates + recent removals.

- `lib/content-engine/fleet-overview.ts` — `getFleetSummary()`, `getFleetList()`. Fleet summary: total subscribers, posts this month, aggregate list, drafts waiting. Per-subscriber: engine status derivation (healthy / draft_waiting / domain_not_verified / list_declining), post count, list size, last review date.

- `app/lite/content/list/page.tsx` — Server component. List tab with health panel, CSV import, embed code generator, export button, subscriber table.

- `app/lite/content/list/actions.ts` — 2 server actions: `importSubscribersAction`, `exportSubscribersAction`. Admin-role-gated, Zod-validated.

- `app/lite/content/_components/subscriber-table.tsx` — Client component. Status badges + consent source labels + date formatting.

- `app/lite/content/_components/csv-import.tsx` — Client component. File upload + client-side CSV parse + server action call. Handles email/name columns, quoted fields.

- `app/lite/content/_components/csv-export-button.tsx` — Client component. Triggers server action + blob download.

- `app/lite/content/_components/embed-code-panel.tsx` — Client component. Shows pre-generated embed form HTML with copy button. Pure `generateEmbedCode` inlined (avoids pulling `@/lib/db` into client bundle).

- `app/lite/content/_components/list-health-panel.tsx` — Server component. Rate cards (bounce/unsub/inactive with warn thresholds) + count breakdown + recent removals list.

- `app/lite/content/subscribers/page.tsx` — Server component. Fleet overview with 4 summary cards + compact per-subscriber table with status badges.

- `tests/content-engine/ce11-subscriber-list.test.ts` — 7 tests: embed code gen, health stats (empty + populated), CSV import (dedup + validation), CSV export (headers + field escaping), list query mapping.

- `tests/content-engine/ce11-fleet-overview.test.ts` — 3 tests: empty summary, populated summary with counts, empty fleet list.

**Files edited:**

- `app/lite/content/_components/content-tabs.tsx` — Activated List tab with `/lite/content/list` href.
- `lib/content-engine/index.ts` — Added CE-11 barrel exports (subscriber list + fleet overview).

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **`generateEmbedCode` inlined in client component.** The library version imports `@/lib/db` transitively. Client component gets a pure copy to avoid pulling better-sqlite3 into the browser bundle. Library version kept for server-side consumers.

2. **CSV import starts as `pending_confirmation`.** Spec §4.2: "mandatory permission pass email." Imported contacts require confirmation before becoming active. The permission-pass email send is not wired in this session — that's a downstream concern for the email adapter.

3. **Fleet status derivation priority.** `domain_not_verified` > `draft_waiting` > `list_declining` > `healthy`. Domain issues are the most critical (engine can't function), then churn signals.

4. **Admin-wide view for fleet.** Fleet overview shows all companies with content engine configs. No company selector yet — CE-10 set this precedent.

5. **Health thresholds.** Bounce rate > 5%, unsub rate > 2%, inactive rate > 10% trigger amber styling. These are industry-standard warning thresholds.

## Verification (G0–G12)

- **G0** — CMS-2 and CE-10 handoffs read. Spec §8.1, §4.2, §4.3, §8.2 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `newsletter_subscribers` table, `content_engine_config` table with `embed_form_token`, `ContentTabs` component, `companies` table, `blog_posts` table, `logActivity()` — all present.
- **G2** — Files match CE-11 scope (List tab + fleet overview + supporting components + tests).
- **G3** — No motion work. UI surface session.
- **G4** — No numeric/string literals in autonomy-sensitive paths.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 165 test files / 1322 passed + 1 skipped (+10 new), clean production build, lint 0 errors (68 warnings, 0 from CE-11 files after fixes).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1322 passed. `npm run build` → success.
- **G9** — No browser-testable state yet (no real data in dev db). UI structure verified via build.
- **G10** — Subscriber list + fleet overview behaviours exercised by 10 unit tests.
- **G10.5** — N/A (admin UI surface, standard build).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_11_permission_pass_email_send`** — CSV import creates `pending_confirmation` subscribers but doesn't trigger the permission pass confirmation email. Needs wiring to `sendEmail()` with a confirmation link + handler at `/api/newsletter/confirm`.
- **`ce_11_fleet_overview_n_plus_one`** — `getFleetList()` queries all subscribers for each company to derive `list_declining` status. Fine at small scale but should be optimised with a single aggregation query when subscriber count grows.
- **`ce_11_company_selector_on_list`** — List tab uses `contentEngineConfig.limit(1)` to find the first company. Needs a company selector when multiple subscribers exist. Same precedent as CE-10's `ce_10_company_filter_on_topics`.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- List tab page + server actions
- Fleet overview page
- Subscriber table, CSV import, CSV export, embed code, health panel components
- Subscriber list + fleet overview library modules + barrel exports
- Test files
- ContentTabs List activation (would revert to disabled)

## What the next session (CE-12) inherits

CE-12 covers the **Content Engine onboarding wizard** (3-step: domain verification + seed keyword review + newsletter preferences). CE-12 inherits:

- **Full content pipeline through to all admin surfaces** — CE-1→CE-11 complete.
- **`ContentTabs` fully activated** — all 5 tabs (Review, Social, Metrics, Topics, List) live.
- **`listSubscribers()` + `importSubscribersFromCsv()`** — available for the newsletter preferences step (Step 3 CSV import).
- **`embed_form_token` on `content_engine_config`** — generated during onboarding, consumed by List tab's embed code panel.
- **`WizardShell` from SW-1** — onboarding renders inside `<WizardShell>` per spec §1.1.
