# `CLD-2` — Portal gallery page (Cloudinary-powered grid) — Handoff

**Closed:** 2026-04-19
**Type:** UI (large)
**Model tier:** Sonnet

---

## What was built

### 1. Gallery server actions (`app/lite/portal/[token]/gallery/actions.ts`)

- `fetchGalleryItems()` — fetches gallery resources from Cloudinary via `listFolder()` using the deal's `cloudinary_gallery_folder`. Returns typed `GalleryItem[]` with thumb URLs (600px scaled), full URLs, download URLs (with `fl_attachment` flag), dimensions, and file metadata. Also generates a ZIP archive URL via `generateArchiveUrl()` for "Download all".
- Deal lookup traverses `contacts → companies → deals`, filtering to active deal stages (`won`, `trial_shoot`, `quoted`, `negotiating`). First deal with a `cloudinary_gallery_folder` wins.
- Logs `deliverables_viewed` activity on every gallery load with item count in the body.
- ZIP generation degrades gracefully — if Cloudinary rejects the archive request (large folders), `archiveUrl` returns null and the "Download all" button hides.

### 2. Gallery client component (`components/lite/portal/gallery.tsx`)

- `PortalGallery` — responsive masonry grid using CSS `columns` (2 on mobile, 3 on tablet, 4 on desktop). Each card preserves the source image's aspect ratio.
- `GalleryCard` — hover reveals format label + per-item download button. Staggered fade-in animation via `houseSpring`. Video items show a play button overlay on the thumbnail.
- `GalleryLightbox` — full-screen overlay with `AnimatePresence`. Images display at native aspect; videos auto-play with controls. Shows format, file size, download link, and close button. Backdrop click or close button dismisses.
- `GalleryEmpty` — bartender-voice empty state: "nothing here yet. when there is, you'll know."
- Header matches the portal section pattern: "YOUR ROOM" eyebrow, "Gallery" title, file count + "download all" button (when archive URL available).
- All animations respect `useReducedMotion`.

### 3. Gallery page (`app/lite/portal/[token]/gallery/page.tsx`)

Replaced the placeholder. Server component that calls `requirePortalSession()` + `fetchGalleryItems()` and renders `PortalGallery`.

### New files (3)

| File | Purpose |
|---|---|
| `app/lite/portal/[token]/gallery/actions.ts` | Server actions — Cloudinary data fetch + activity logging |
| `components/lite/portal/gallery.tsx` | Gallery client component (masonry grid + lightbox) |
| `tests/cld2-portal-gallery.test.ts` | 7 tests |

### Edited files (1)

| File | Change |
|---|---|
| `app/lite/portal/[token]/gallery/page.tsx` | Replaced placeholder with real gallery |

## Key decisions

1. **CSS columns masonry over JS-based layout.** Simpler, no layout thrashing, works with responsive breakpoints natively. Trade-off: items flow column-first not row-first, which is standard for photo galleries.

2. **Aspect ratio from Cloudinary metadata.** Each card uses the source image's width/height ratio via `style={{ aspectRatio }}`, so the masonry avoids layout shift on load.

3. **`fl_attachment` for downloads.** Cloudinary's URL flag forces browser download instead of inline display. No server-side proxy needed.

4. **Wider max-width for gallery (1200px vs 780px).** Other portal sections use 780px. Gallery uses 1200px to give the masonry grid enough room for 4 columns on desktop.

5. **Activity log on data fetch, not on client mount.** `deliverables_viewed` fires inside `fetchGalleryItems()` (server action called from the server component), not via a client-side effect. Simpler, no extra round-trip, and logs even if JS fails.

## What the next session should know

- **CM-7** builds the bundled first-visit hub (Gallery + Plan tiles). The gallery tile routes to `/portal/[token]/gallery` (this page). CM-7 does not need to know about Cloudinary internals — it just links here.
- The gallery page is visible in both `pre_retainer` and `retainer` modes (per `PORTAL_SECTIONS` gating in `lib/portal/mode.ts`). Content is deal-scoped — if no deal has a `cloudinary_gallery_folder`, the empty state shows.
- **IF-2** (Wave 14) builds the admin gallery upload UI and the "Your gallery is ready" launch card. That session will set `deals.cloudinary_gallery_folder` when Andy publishes a gallery. Until then, the folder is null and the empty state renders.
- No pagination implemented. `listFolder` fetches up to 100 items. If galleries grow beyond 100, add cursor-based pagination (the `nextCursor` return from `listFolder` is already wired).

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 203 files, 1712 passed, 0 failures, 1 skipped
- No browser check (gallery requires a live Cloudinary folder with real assets; structural correctness validated via typecheck + tests + code review of the server action data flow)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No schema changes. Reverting the commit restores the placeholder page. No other sessions depend on CLD-2's output yet (CM-7 only links to the route, which would fall back to the placeholder).
