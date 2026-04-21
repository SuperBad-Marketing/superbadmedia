# DC-6 Handoff — Daily Cockpit: Mobile PWA Layout

**Date:** 2026-04-21
**Wave:** 22 (sixth session)
**Status:** COMPLETE

## What was built

### 1. PWA manifest + viewport meta

- `app/manifest.ts` — Next.js route handler producing a web manifest with SuperBad branding, `/lite/cockpit` as `start_url`, standalone display, charcoal theme color.
- `app/layout.tsx` — added `viewport` export with `themeColor`, `viewportFit: "cover"` for notch-safe rendering, and `appleWebApp` metadata for iOS home screen install.

### 2. AdminShell responsive layout

- `components/lite/admin-shell.tsx` — sidebar hidden below `md` breakpoint (768px). Main content gets tighter padding on mobile (`p-4 pb-20`) with `pb-20` clearing the bottom nav bar.
- `components/lite/admin-bottom-nav.tsx` — **new** fixed bottom navigation bar (mobile only, `md:hidden`). 5 key items: Cockpit, Pipeline, Inbox, Tasks, Settings. Active state via pink accent icon, `safe-area-inset-bottom` padding for iOS home bar.
- `components/lite/admin-shell-with-nav.tsx` — wires `AdminBottomNav` into the shell.

### 3. Tabbed kanban on mobile

- `components/lite/cockpit/planning-view.tsx` — on mobile (`<768px`), the 3-col kanban grid is replaced with a tabbed interface. Three tabs (Must Do / Should Do / If Time) with task counts. Tab switching animates content with the house spring via Framer Motion `AnimatePresence`. Reduced motion respected. Desktop layout unchanged.
- `lib/use-media-query.ts` — **new** hook for responsive JS branching with proper cleanup.

### 4. Cockpit page responsive polish

- `app/lite/cockpit/page.tsx` — removed horizontal padding on mobile (AdminShell main already has `p-4`), tighter vertical padding. Desktop unchanged.

## New files

- `app/manifest.ts`
- `components/lite/admin-bottom-nav.tsx`
- `lib/use-media-query.ts`
- `tests/dc6-mobile-pwa.test.ts`

## Edited files

- `app/layout.tsx` — viewport + appleWebApp metadata
- `app/lite/cockpit/page.tsx` — responsive padding
- `components/lite/admin-shell.tsx` — responsive grid + mobile padding
- `components/lite/admin-shell-with-nav.tsx` — bottom nav import
- `components/lite/cockpit/planning-view.tsx` — tabbed kanban + useMediaQuery

## Verification

- `npx tsc --noEmit` — 4 pre-existing errors (dc4 test + hp19 test), zero new
- `npx vitest run tests/dc6-mobile-pwa.test.ts` — 6 passed
- Full suite — 288 files, 2928 tests, 1 pre-existing failure (`sb10-headline-signals.test.ts`, confirmed pre-existing via stash test), zero new regressions

## Rollback

- All changes are additive — git-revertable
- Bottom nav is `md:hidden`, sidebar is `hidden md:block` — desktop layout completely unchanged
- Tabbed kanban only activates on `<768px` via `useMediaQuery` — desktop kanban grid untouched

## Key decisions

- **5 items in bottom nav, not all 13.** Cockpit, Pipeline, Inbox, Tasks, Settings are the high-frequency admin surfaces. Other pages (Lead Gen, Content, Finance, Observatory, etc.) remain accessible via desktop sidebar. If mobile access to those is needed later, a "More" tab with a full menu overlay would be the right move.
- **Tab animation uses house spring, not CSS transitions.** Spec calls for "house motion spring" on tab switch. AnimatePresence with `popLayout` mode prevents layout jumps during transition.
- **useMediaQuery returns false on SSR.** Mobile tabbed view only activates client-side. SSR renders the desktop kanban grid. Brief FOUC is acceptable — the kanban data is small and Framer's first paint is fast.
- **PWA icons not yet generated.** Manifest references `/pwa-icon-192.png` and `/pwa-icon-512.png` which need to be created in an asset session. The manifest works without them — the home-screen install just uses a default icon.

## Pre-existing issues

- `sb10-headline-signals.test.ts` failure — confirmed pre-existing, not from DC-6 changes
- `sd11_rain_ambient_mp3` — audio file needs sourcing (asset session)
- The egg build error (`lib/eggs/admin-triggers/three-wons.ts` → `pipeline-board.tsx` client component chain) still blocks dev overlay and production builds

## Next session should know

- **DC-6 completes Wave 22 (Daily Cockpit).** All 6 sessions (DC-1 through DC-6) shipped.
- **PWA icons are owed.** Two PNG files needed in `/public/` for the manifest. Low-priority — add during an asset session.
- The `useMediaQuery` hook at `lib/use-media-query.ts` is available for any future component that needs responsive JS branching (e.g., Unified Inbox mobile layout at UI-11).
- The bottom nav component at `components/lite/admin-bottom-nav.tsx` is reusable — any admin page wrapped in `AdminShellWithNav` automatically gets it.
