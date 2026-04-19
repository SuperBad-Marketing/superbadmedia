# SWP-8 Handoff — PDF Render Overlay

**Date:** 2026-04-20
**Wave:** 15
**Status:** COMPLETE

## What was built

- **`PdfRenderOverlay` reusable component** (`components/lite/pdf-render-overlay.tsx`):
  - Consumes the `pdfRenderOverlay` Tier-1 motion token from `lib/motion/choreographies.ts`
  - Full-screen backdrop: SuperBad mark + configurable label (default "Rendering your plan…") + animated spinner
  - Respects `prefers-reduced-motion` via the token's `reduced` fallback
  - `AnimatePresence`-wrapped for clean enter/exit
  - Reusable — QB-3 and BI-2 can import the same component for their PDF downloads

- **Plan-view PDF download with overlay** (`components/lite/portal/plan-view.tsx`):
  - Replaced the plain `<a href>` link with a `<button>` + client-side `fetch()`
  - On click: sets `pdfRendering` state → overlay appears → fetches PDF blob from `/api/lite/portal/plan/[planId]/pdf` → parses `Content-Disposition` for filename → creates transient `<a>` element → triggers browser download → overlay dismisses
  - Button disabled during render to prevent double-clicks
  - Error path: overlay dismisses on fetch failure, no error UI (graceful fail)

## New files

- `components/lite/pdf-render-overlay.tsx`
- `tests/pdf-render-overlay.test.ts`
- `sessions/swp8-handoff.md`

## Edited files

- `components/lite/portal/plan-view.tsx` — import overlay, add state + handler, replace `<a>` with `<button>`

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 224 files, 1851 passed, 1 skipped (unchanged)
- `next build` — clean production build

## Key decisions

- Built as a reusable component rather than plan-view-specific — QB-3 and BI-2 per BUILD_PLAN also consume this token
- Client-side fetch + blob download (not `window.location` redirect) so the overlay can control timing precisely
- Filename extracted from `Content-Disposition` header with `SuperBad-Six-Week-Plan.pdf` fallback
- No error toast on fetch failure — the overlay just dismisses. The existing 404/401 responses from the API route handle auth/not-found cases; a toast would need a toast provider dependency that doesn't exist in the portal shell yet

## Rollback

- Git-revertable: no data shape changes, no migration, no settings keys
- No kill switch needed — the overlay is purely cosmetic UX on an existing download path

## Next session should know

- SWP-9 through SWP-10 remain: migrate-on-Won to CCE active_strategy (SWP-9 — scope likely reduced since migration handler is already built in SWP-6), non-converter expiry (SWP-10), E2E tests, settings audit
- The `PdfRenderOverlay` component is ready for QB-3 and BI-2 to adopt — they currently use plain `<a>` tags
- The `label` prop defaults to "Rendering your plan…" but can be overridden (e.g. "Rendering your quote…")
