# `CM-4` — Clients index + global search — Handoff

**Closed:** 2026-04-18
**Type:** UI (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Clients index page (`/lite/admin/clients`)

Server component at `app/lite/admin/clients/page.tsx` with:

- **Auth gate** — redirects non-admins
- **Won-deal-based client identification** — companies appear when a deal hits the `won` stage (spec §11.5)
- **Relationship stage derivation** — Active (has active subscription), Completed (all subscriptions ended naturally), Churned (explicit cancellation)
- **Health score derivation** — simplified from activity_log recency (healthy ≤7d, cooling ≤14d, at_risk ≤30d, stale >30d). Context Engine (Wave 16) will provide richer scoring later.
- **Monthly revenue calculation** — sums deal values for active subscriptions, dividing annual-upfront by 12

### 2. Clients index client component

`components/lite/admin/clients/clients-index-client.tsx` with:

- **Four summary cards** — Active Clients, Monthly Revenue, Needing Attention, Overdue Invoices. Cards with attention-worthy values get a red-orange gradient accent.
- **Relationship stage filter tabs** — Active (default) / Completed / Churned with Framer Motion layoutId sliding indicator
- **Health score dropdown filter** — All / Healthy / Cooling / At risk / Stale
- **Search within list** — by company or contact name
- **Compact row table** — Company name (linked to company profile), primary contact, health dot (4 colours), package type, monthly value, last activity, next action (overdue invoices flagged in orange)
- **Default sort** — worst health first, then most recent activity

### 3. Global search modal

`components/lite/global-search.tsx` with:

- **Trigger** — sidebar nav button ("Search") with ⌘K keyboard shortcut
- **Modal overlay** — backdrop click to close, ESC to close, arrow key + enter navigation
- **Debounced API search** — 200ms debounce, searches across companies, contacts, deals, invoices, quotes
- **Results grouped by type** — Companies / People / Deals / Invoices / Quotes with type icons
- **Navigation** — click or keyboard-select navigates to the entity

### 4. Search API route

`app/api/lite/search/route.ts` — admin-only GET endpoint, LIKE-based search across 5 entity types, max 5 results per type.

### 5. Nav update

Clients nav item flipped from `status: "soon"` to `status: "live"` with `href: "/lite/admin/clients"`.

Search trigger integrated into sidebar between primary nav and utility nav.

### New files (4)

| File | Purpose |
|---|---|
| `app/lite/admin/clients/page.tsx` | Server component: auth, data loading, summary aggregation, header |
| `components/lite/admin/clients/clients-index-client.tsx` | Client component: summary cards, stage/health filters, search, client list table |
| `components/lite/global-search.tsx` | Global search trigger button + modal overlay with API-backed search |
| `app/api/lite/search/route.ts` | Admin-only search API endpoint |

### Modified files (2)

| File | Change |
|---|---|
| `components/lite/admin-shell-nav.tsx` | Clients nav item: `status: "soon"` → `"live"`, `href` + `matchPrefix` set |
| `components/lite/admin-shell-with-nav.tsx` | Added `GlobalSearchTrigger` import and render in sidebar |

### Test file (1)

| File | Tests |
|---|---|
| `tests/cm4-clients-index.test.ts` | 7 tests: ClientsIndexClient exports + ClientStageFilter 3 values + HealthScore 4 values + GlobalSearchTrigger exports + GlobalSearchResult 5 types + clients nav live + search route file exists |

## Key decisions

1. **URL is `/lite/admin/clients` not `/lite/clients`.** The spec says `/lite/clients` but all admin pages route through `/lite/admin/` for the admin layout wrapper. Using `/lite/admin/clients` is consistent with the existing pattern and gets the sidebar nav automatically.

2. **Health score is derived from activity_log recency.** The spec references the Context Engine for health scoring, but that's Wave 16. The current implementation uses a simple days-since-last-activity heuristic. When CCE-1..3 ships, it can replace `deriveHealthScore()` with the real Context Engine's health assessment.

3. **Search uses a dedicated API route.** The spec describes `Cmd+K` + header click; the admin shell has no header bar, so the trigger is a sidebar button. The API route keeps search server-side and avoids shipping all entity data to the client.

4. **No "tasks" in search.** The spec §12.2 includes tasks in global search scope, but the `tasks` table doesn't exist yet (Wave 17, Task Manager). Tasks will be added to the search route when TM-1 ships.

5. **No "recent items" empty state.** The spec §12.4 describes showing recently visited entities when search is empty. This requires a client-side recency store (localStorage or similar) — deferred to a polish pass rather than adding client-side storage for a single use case.

## What the next session should know

- **CM-5** builds portal chat home (bartender Opus) + rate-limited chat.
- Health scoring is a placeholder. Context Engine (CCE-1..3) replaces it.
- Global search's "recent items" empty state and tasks search scope are deferred.
- The `GlobalSearchTrigger` component is rendered in the sidebar nav between primary and utility groups. If the design system or admin shell evolves, the trigger placement may need updating.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 200 files, 1677 passed, 0 failures, 1 skipped
- No browser check (pre-existing dev server issue from CM-2, not caused by this session)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are UI components, an API route, page routing, and tests. Reverting the commit removes `/lite/admin/clients` and the global search.
