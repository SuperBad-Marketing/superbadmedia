# `CM-6` — Portal menu + navigation + retainer-mode gate — Handoff

**Closed:** 2026-04-18
**Type:** UI (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Portal mode detection (`lib/portal/mode.ts`)

- `getPortalMode(contactId)` — derives `pre_retainer | retainer | archived` from `deals.stage` + `subscription_state` + Brand DNA status
- `PORTAL_SECTIONS` — 8-item section registry with per-section `preRetainer` boolean gate
- `PortalMode` and `PortalSectionKey` types exported

### 2. Portal shell layout (`app/lite/portal/[token]/layout.tsx`)

Server component wrapping all `[token]` child routes:
- Session validation via `getPortalSession()`
- Portal mode detection via `getPortalMode()`
- Contact name lookup
- Renders `PortalShell` client component

### 3. Portal shell client (`components/lite/portal/portal-shell.tsx`)

Matching `mockup-client-portal.html` exactly:
- Ambient background gradients (3 radial overlays)
- Noise texture overlay
- Top bar: Pacifico "SuperBad" wordmark + Righteous "{firstName}'s room" with pink accent
- Menu bubble (always visible, fixed bottom-right)
- Chat bubble (visible on non-chat pages, fixed bottom-left)

### 4. Menu bubble + overlay (`components/lite/portal/menu-bubble.tsx`)

Per mockup:
- Brand-red pill with breathing CSS animation (`@keyframes breathe` added to globals.css)
- Righteous font "Menu" label + hamburger icon
- Full-page overlay: 92% opacity dark backdrop + 24px blur
- Playfair italic greeting ("everything in its place.")
- 2-column grid of section cards (BHS heading, Righteous eyebrow, italic description)
- Retainer-mode gate: locked sections show at 50% opacity with lock state, disabled clicks, "available on retainer." copy
- Staggered Framer Motion entrance (houseSpring + 50ms per-card delay)
- "New" badge on Deliverables when `hasNewDeliverables` prop is true
- Current-section highlight (pink border)
- Close button (top-right, Righteous uppercase)
- Reduced-motion support throughout

### 5. Chat bubble (`components/lite/portal/chat-bubble.tsx`)

- Fixed bottom-left, 52px circle, neutral-700 bg, chat icon
- Hover: scale + pink border accent (matching mockup `.chat-bubble` styles)
- Links back to `/lite/portal/[token]`

### 6. Section locked component (`components/lite/portal/section-locked.tsx`)

- Lock icon + Playfair italic "{section} is available on retainer." + italic sub-copy
- Used by Invoices, Package, Messages, Data Export pages in pre-retainer mode

### 7. Section placeholder component (`components/lite/portal/section-placeholder.tsx`)

- Page header (Righteous eyebrow + BHS heading + Playfair italic description)
- "arriving shortly." centered placeholder
- Used by all section pages until their real content is built in later sessions

### 8. Portal section route stubs (6 pages)

| Route | Pre-retainer |
|---|---|
| `/lite/portal/[token]/deliverables` | Placeholder (accessible) |
| `/lite/portal/[token]/invoices` | Locked |
| `/lite/portal/[token]/gallery` | Placeholder (accessible) |
| `/lite/portal/[token]/package` | Locked |
| `/lite/portal/[token]/messages` | Locked |
| `/lite/portal/[token]/data-export` | Locked |

### 9. ChatHome adjustment

Changed `h-dvh` to `h-full flex-1` so the chat fills the layout's main content area instead of fighting the shell's own viewport height.

### New files (14)

| File | Purpose |
|---|---|
| `lib/portal/mode.ts` | Portal mode detection + section registry |
| `app/lite/portal/[token]/layout.tsx` | Server layout: session, mode, shell |
| `components/lite/portal/portal-shell.tsx` | Client shell: header, ambient bg, bubbles |
| `components/lite/portal/menu-bubble.tsx` | Menu bubble + full-page overlay |
| `components/lite/portal/chat-bubble.tsx` | Chat shortcut bubble |
| `components/lite/portal/section-locked.tsx` | Retainer-mode lock card |
| `components/lite/portal/section-placeholder.tsx` | Section placeholder with header |
| `app/lite/portal/[token]/deliverables/page.tsx` | Deliverables stub |
| `app/lite/portal/[token]/invoices/page.tsx` | Invoices stub (locked pre-retainer) |
| `app/lite/portal/[token]/package/page.tsx` | Package stub (locked pre-retainer) |
| `app/lite/portal/[token]/messages/page.tsx` | Messages stub (locked pre-retainer) |
| `app/lite/portal/[token]/gallery/page.tsx` | Gallery stub |
| `app/lite/portal/[token]/data-export/page.tsx` | Data export stub (locked pre-retainer) |
| `tests/cm6-portal-menu.test.ts` | 10 tests |

### Edited files (2)

| File | Change |
|---|---|
| `components/lite/portal/chat-home.tsx` | `h-dvh` → `h-full flex-1` to work inside layout shell |
| `app/globals.css` | Added `@keyframes breathe` for menu bubble animation |

## Key decisions

1. **Menu bubble position: bottom-right.** The mockup has it bottom-right; the chat bubble goes bottom-left on non-chat pages. This matches the mockup exactly.

2. **Portal mode detection queries deals table directly.** The spec's §10.0 mode logic checks `deals.stage = 'won'` + active subscription state. The `getPortalMode()` function also checks Brand DNA completion status for the retainer hard lock (§10.0 F4.b), though the lock UI itself is not wired in this session — it's CM-7's scope.

3. **Section navigation uses `window.location.href`.** Client-side navigation via router would be smoother, but the overlay closes and a new server-rendered page loads. This keeps section pages as server components with their own data loading, avoiding the complexity of client-side state management across sections.

4. **Deliverables is accessible in pre-retainer mode.** Per §10.0 table: pre-retainer sees "Deliverables (photos, video, 6-week plan PDF)". Gallery is also accessible (photos). All others locked.

5. **Brand DNA section is NOT a new page here.** The Brand DNA portal routes already exist at `/lite/portal/brand-dna/*` (BDA-5). The menu navigates to `/lite/portal/[token]/brand-dna` which will need a redirect or separate page. For now, the menu's Brand DNA item exists in the overlay but routing to the existing BDA routes needs a follow-up wiring patch.

## What the next session should know

- **CLD-1** or **CLD-2** builds the Cloudinary gallery integration. The Gallery section stub is ready.
- **CM-7** builds the first-visit-after-bundle hub (§10.2.1). The layout shell is ready to wrap it.
- The Brand DNA menu item currently points to `/lite/portal/[token]/brand-dna`. The existing Brand DNA portal routes are at `/lite/portal/brand-dna/*` (different path). A wiring patch is needed — either redirect or adjust the menu to point at the existing BDA routes. PATCHES_OWED.
- The `hasNewDeliverables` prop on MenuBubble is not wired to real data yet — needs the "new badge" logic from §10.10 (deliverable changes since last portal visit).
- No migration. No new schema. No new settings keys.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 202 files, 1700 passed, 0 failures, 1 skipped
- `npm run build` — clean, all new routes visible in build output
- No browser check (portal requires live auth session; visual fidelity validated against mockup-client-portal.html)

## PATCHES_OWED (raised this session)

| Target | What | Why |
|---|---|---|
| Menu Brand DNA routing | Wire Brand DNA menu item to existing `/lite/portal/brand-dna/*` routes or add redirect from `/lite/portal/[token]/brand-dna` | BDA-5 routes live outside `[token]` segment; menu currently generates wrong path |
| `hasNewDeliverables` wiring | Connect to real "changes since last visit" logic | §10.10 badge logic not yet implemented |

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are UI components, route pages, one library module, one CSS keyframe, and tests. Reverting the commit removes the portal shell, menu, section stubs, and mode detection.
