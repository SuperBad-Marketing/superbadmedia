# `CM-7` — Bundled first-visit hub (Gallery + Plan tiles) — Handoff

**Closed:** 2026-04-19
**Type:** UI (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Bundle hub library (`lib/portal/bundle-hub.ts`)

- `getBundleHubState(contactId)` — derives whether the one-shot hub should render. Checks `contacts.bundled_hub_seen_at_ms` (null = not yet shown) and `deals.cloudinary_gallery_folder` (proxy for deliverables-ready gate until IF-1 lands). Returns `BundleHubState` with `showHub`, `hasGallery`, `hasPlan` flags.
- `dismissBundleHub(contactId, dismissedTo)` — stamps `bundled_hub_seen_at_ms` on contacts, logs `bundled_hub_dismissed` activity with target section.
- `hasPlan` always returns `false` until SWP-1 builds the `six_week_plans` table.

### 2. Bundle hub client component (`components/lite/portal/bundle-hub.tsx`)

- Two equal-weight tiles: "Your photos & video" (gallery) and "Your plan" (strategy).
- Tile click fires server action `dismissHub()` then navigates to the target section.
- `motion:bundle-reveal` Tier-2 choreography: tiles stagger up with fade + scale.
- Plan tile shows as disabled placeholder ("arriving shortly.") when `hasPlan` is false.
- Gallery tile uses pink accent icon, plan tile uses orange accent icon.
- Logs `bundled_hub_shown` activity on mount (once via ref guard).
- Reduced-motion support throughout.

### 3. Bundle-reveal choreography (`lib/motion/choreographies.ts`)

- New Tier-2 entry `bundle-reveal` (slot 9, BUILD_PLAN assigns as motion moment #3).
- 600ms total, staggered tiles (120ms inter-tile delay), slow-out ease.
- Container orchestration with `staggerChildren: 0.12`.

### 4. Portal home page update (`app/lite/portal/[token]/page.tsx`)

- Conditional render: hub state checked first; if `showHub` is true, renders `BundleHub` instead of `ChatHome`.
- Chat-only data (history, rate limit) deferred behind hub check — not loaded if hub renders.

### 5. Plan page stub (`app/lite/portal/[token]/plan/page.tsx`)

- Uses `PortalSectionPlaceholder` with "Your Plan" heading. SWP build sessions replace this.

### 6. Portal sections registry update (`lib/portal/mode.ts`)

- Added `plan` section (key: "plan", preRetainer: true). Appears in menu overlay.

### 7. Hub server actions (`app/lite/portal/[token]/hub-actions.ts`)

- `dismissHub(dismissedTo)` — portal-session-gated, calls `dismissBundleHub`.
- `logHubShown()` — portal-session-gated, logs `bundled_hub_shown` activity.

### 8. Schema + migration

- `contacts.bundled_hub_seen_at_ms` column (nullable integer). Temporary home — spec places it on `intro_funnel_submissions` (IF-1). PATCHES_OWED.
- Migration `0046_cm7_bundle_hub.sql`.
- 2 new `ACTIVITY_LOG_KINDS`: `bundled_hub_shown`, `bundled_hub_dismissed`.

### New files (5)

| File | Purpose |
|---|---|
| `lib/portal/bundle-hub.ts` | Hub trigger + dismiss logic |
| `components/lite/portal/bundle-hub.tsx` | Two-tile hub client component |
| `app/lite/portal/[token]/hub-actions.ts` | Server actions for hub |
| `app/lite/portal/[token]/plan/page.tsx` | Plan page stub |
| `tests/cm7-bundle-hub.test.ts` | 8 tests |

### Edited files (7)

| File | Change |
|---|---|
| `app/lite/portal/[token]/page.tsx` | Conditional hub vs chat-home render |
| `lib/portal/mode.ts` | Added plan section to registry |
| `lib/motion/choreographies.ts` | Added `bundle-reveal` Tier-2 entry |
| `lib/db/schema/contacts.ts` | Added `bundled_hub_seen_at_ms` column |
| `lib/db/schema/activity-log.ts` | Added 2 hub activity kinds |
| `tests/motion-sound.test.ts` | Updated to expect 9 Tier-2 keys |
| `tests/cm6-portal-menu.test.ts` | Updated section count + pre-retainer list |
| `tests/cm1-contacts-columns.test.ts` | Added `bundled_hub_seen_at_ms` to row fixture |
| `tests/inbox-conversation-view.test.tsx` | Added `bundled_hub_seen_at_ms` to contact fixture |

## Key decisions

1. **`bundled_hub_seen_at_ms` on `contacts`, not `intro_funnel_submissions`.** IF table doesn't exist yet (Wave 14). Contacts is the right temporary home — it's a per-contact flag. IF-1 can migrate it to the spec-canonical location.

2. **Hub trigger currently can't fire.** The full trigger chain requires `intro_funnel_submissions.deliverables_ready_at` (IF-1), but we approximate with `deals.cloudinary_gallery_folder IS NOT NULL`. In practice, no deal has this set until IF-2 (admin gallery upload). Component is structurally correct and ready for upstream wiring.

3. **`hasPlan` always false.** `six_week_plans` table doesn't exist yet (SWP-1). The plan tile shows as a disabled placeholder. When SWP-1 lands, wire a query into `getBundleHubState`.

4. **Tier-2 key list expanded to 9.** Spec calls `bundle-reveal` a "candidate" but BUILD_PLAN assigns it as motion moment #3. The choreography registry is the right home. Test updated from 8→9.

5. **No `getPortalMode` import in plan page.** The plan is accessible in both pre-retainer and retainer modes per spec. No mode gating needed.

## What the next session should know

- **CM-7b** builds the portal deliverables page (inline preview, approve/reject). Unrelated to the hub — reads the Task Manager schema.
- **CM-8** builds the retainer-mode kickoff (Brand DNA gate + bartender variant). The hub's `bundled_hub_seen_at_ms` suppresses the 3-step tour for bundled-release portals (spec §10.2.1: "the hub IS the orchestrated first-visit moment"). CM-8 should check this flag when deciding tour vs kickoff.
- **IF-1** (Wave 14) creates `intro_funnel_submissions`. When it does, move `bundled_hub_seen_at_ms` from `contacts` to that table and update `getBundleHubState` to query it instead. PATCHES_OWED.
- **SWP-1** creates `six_week_plans`. When it does, wire a plan-existence check into `getBundleHubState` so `hasPlan` can return true.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` noise)
- `npm test` — 204 files, 1719 passed, 0 failures, 1 skipped
- `npm run build` — clean, `/lite/portal/[token]/plan` visible in build output
- No browser check (hub requires a portal session + deal with gallery folder; structural correctness validated via typecheck + tests + component review)

## PATCHES_OWED (raised this session)

| Target | What | Why |
|---|---|---|
| `contacts.bundled_hub_seen_at_ms` → `intro_funnel_submissions` | Migrate column when IF-1 lands | Spec canonical location is `intro_funnel_submissions` |
| `getBundleHubState` plan check | Wire `six_week_plans` query when SWP-1 lands | `hasPlan` currently hardcoded false |

## Rollback strategy

**Git-revertable.** Migration adds one nullable column (no data loss on revert via `ALTER TABLE DROP COLUMN` or full revert). No other sessions depend on CM-7's output yet.
