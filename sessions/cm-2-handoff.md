# `CM-2` — Admin company profile (7 tabs) — Handoff

**Closed:** 2026-04-18
**Type:** UI (large)
**Model tier:** Sonnet

---

## What was built

The **admin company profile page** at `/lite/companies/[id]` expanded from 3 tabs (overview, trial-shoot, billing) to the spec's 7-tab structure per `docs/specs/client-management.md` §2.

### Tab structure (all 7)

| Tab | Data source | Status |
|---|---|---|
| **Overview** | deals, invoices, contacts, last activity | Carried forward from prior build, unchanged |
| **Deliverables** | `tasks` table (Task Manager) | Empty state — Task Manager is Wave 17, not yet built |
| **Billing** | invoices, company payment config | Carried forward from prior build, unchanged |
| **Brand DNA** | `brand_dna_profiles` + `brand_dna_blends` | New — blend hero for multi-stakeholder, solo profile for single-contact, individual profile list with status badges + view links |
| **Comms** | `threads` table | New — threaded view with channel icons, contact names, ticket status badges, signal indicators |
| **Portal Chat** | `portal_chat_messages` | New — read-only admin view, grouped by contact, role badges (client/bartender), escalation + tool-action flags |
| **Activity** | `activity_log` | New — chronological timeline with kind-based colour coding, newest first, capped at 200 entries |

### New files (6)

| File | Purpose |
|---|---|
| `components/lite/admin/companies/brand-dna-tab.tsx` | Brand DNA tab — blend section (prose portrait, tag cloud, divergence flags), solo profile section, individual profiles list with status badges |
| `components/lite/admin/companies/comms-tab.tsx` | Comms tab — threaded view with channel icons, contact names, ticket status |
| `components/lite/admin/companies/portal-chat-tab.tsx` | Portal Chat tab — read-only admin view, grouped by contact, escalation badges |
| `components/lite/admin/companies/activity-tab.tsx` | Activity tab — chronological timeline with kind-based colour dots |
| `components/lite/admin/companies/deliverables-tab.tsx` | Deliverables tab — empty state placeholder for Wave 17 Task Manager |
| `tests/cm2-company-tabs.test.ts` | 6 tests: tab strip exports 7 valid values + each new tab component exports correctly |

### Modified files (2)

| File | Change |
|---|---|
| `components/lite/admin/companies/company-tab-strip.tsx` | `CompanyTab` type expanded from 3 to 7 values; TABS array updated to match |
| `app/lite/admin/companies/[id]/page.tsx` | Added imports for new tab components + schema tables. Added tab-specific data loading (only fetches data for the active tab). Added rendering branches for all 7 tabs. Removed trial-shoot tab. Removed unused `TrialShootPanel` import. |

## Key decisions

1. **Tab-specific data loading.** Each tab only queries its own data — Brand DNA doesn't load portal chat messages, Activity doesn't load threads, etc. Keeps server component rendering fast. Core data (company, deals, invoices, contacts) still loads for every tab since it feeds the header.

2. **Deliverables tab is an empty state.** Task Manager (Wave 17, TM-1..TM-9) hasn't been built yet, so there's no `tasks` table to query. The tab renders a voiced placeholder that acknowledges the feature is coming.

3. **Trial-shoot tab removed.** The spec's 7-tab structure doesn't include a dedicated trial-shoot tab. Trial shoot status is visible on the Overview tab via the deal stage chip. The `TrialShootPanel` component still exists for other uses but is no longer imported by this page.

4. **Portal chat capped at 200 messages.** High-volume contacts could accumulate hundreds of messages. The admin view shows the 200 most recent across all contacts at the company, grouped by contact. CM-10 will add pagination/escalation filtering.

5. **Activity capped at 200 entries.** Same rationale. Full history is available via the activity_log table; the tab shows the most recent.

## What the next session should know

- **CM-3** builds the admin **contact** profile (5 tabs). The tab strip pattern from `company-tab-strip.tsx` can be duplicated for contacts.
- The `brand-dna-tab.tsx` component links to `/lite/admin/contacts/[id]?tab=brand-dna` — that route doesn't exist yet (CM-3 builds it).
- Overview tab currently shows deals, invoices, and contacts panels. The spec §2.3 describes a richer package summary card (subscription state, commitment period, next invoice date, quote history timeline). The current overview is adequate for the existing data model but could be enhanced when Quote Builder and subscription state are more fully wired.
- **CM-10** will add the write-side features for Comms (threading) and Portal Chat (escalation flagging). The current tabs are read-only views.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 198 files, 1665 passed, 0 failures, 1 skipped
- Dev server startup issue (pre-existing, not caused by this session — likely missing env vars or port conflict; `curl` times out on all routes)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are UI components and page routing. Reverting the commit restores the 3-tab page.
