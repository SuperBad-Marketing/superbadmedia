# `CM-12` — Portal polish + responsive + S&D ambient slots — Handoff

**Closed:** 2026-04-19
**Type:** UI (small)
**Model tier:** Opus (session started on Opus; standard Sonnet session scope)

---

## What was built

### 1. Responsive polish — portal shell (`components/lite/portal/portal-shell.tsx`)

- Header padding reduced on mobile (`px-4 py-4` → `sm:px-8 sm:py-5`).
- Logo text scales down on mobile (`text-[18px]` → `sm:text-[22px]`).
- "[Name]'s room" label hidden on small screens (`hidden sm:inline`) — logo alone is sufficient.

### 2. Responsive polish — menu bubble (`components/lite/portal/menu-bubble.tsx`)

- Bubble smaller on mobile (`h-[46px]`, `bottom-5 right-5`) scaling to desktop at `sm:`.
- Overlay close button repositioned for mobile (`right-5 top-5` → `sm:right-10 sm:top-7`).
- Overlay content padding reduced on mobile (`px-5 py-14` → `sm:px-10 sm:py-20`).
- Section card padding reduced on mobile (`px-4 py-5` → `sm:px-6 sm:py-7`).
- Section title scales (`text-[20px]` → `sm:text-[26px]`).

### 3. Responsive polish — chat bubble (`components/lite/portal/chat-bubble.tsx`)

- Matches menu bubble mobile positioning (`bottom-5 left-5`, `h-[46px] w-[46px]` → `sm:` desktop sizes).

### 4. Responsive polish — chat home (`components/lite/portal/chat-home.tsx`)

- Composer bottom padding increased on mobile (`pb-20 sm:pb-6`) to clear the menu bubble.

### 5. Responsive polish — section headers (4 components)

All portal section headers converted from `flex items-end justify-between` (breaks on narrow viewports) to `flex-col gap-2 sm:flex-row sm:items-end sm:justify-between`:

- `deliverables-header.tsx` — title scales `text-3xl sm:text-4xl`, description `text-[14px] sm:text-[15px]`.
- `section-placeholder.tsx` — same pattern.
- `data-export-panel.tsx` — same pattern.
- `gallery.tsx` — both empty and populated headers. Populated header uses `gap-3` for the download-all row.

### 6. Responsive polish — deliverables list (`components/lite/portal/deliverables-list.tsx`)

- Card title row gets `gap-3` and `min-w-0 flex-1` on the text side to prevent overflow.
- Status badge gets `shrink-0` to prevent compression.
- Title text size tuned for mobile (`text-[15px] sm:text-base`).

### 7. Responsive polish — brand DNA gate (`components/lite/portal/brand-dna-gate.tsx`)

- Heading scales through three breakpoints (`text-[28px] sm:text-[32px] md:text-[40px]`).

### 8. S&D ambient slots — 9 slots wired

Each slot is a `data-ambient-slot` attribute on the text element that Wave 20 (SD-*) will target with `generateInVoice()` copy. The attribute value is the slot name; the element's current text content is the fallback.

| Slot name | Component | Current fallback |
|---|---|---|
| `portal_chat_subtitle` | `chat-home.tsx` | "ask me anything about your work with us…" |
| `portal_chat_footer` | `chat-home.tsx` | "the bartender reads your whole history. always." |
| `portal_deliverables_empty` | `deliverables-list.tsx` | "nothing here yet. when there is, you'll know." |
| `portal_deliverables_description` | `deliverables-header.tsx` | "everything we've made for you" |
| `portal_gallery_empty` | `gallery.tsx` | "nothing here yet. when there is, you'll know." |
| `portal_section_placeholder` | `section-placeholder.tsx` | "arriving shortly." |
| `portal_section_locked` | `section-locked.tsx` | "when you're ready, we'll unlock everything." |
| `portal_data_export_idle` | `data-export-panel.tsx` | "request a copy of everything we hold for you…" |
| `portal_data_export_success` | `data-export-panel.tsx` | "export requested. a download link will appear…" |
| `portal_data_export_description` | `data-export-panel.tsx` | "export everything." |
| `portal_plan_arriving` | `bundle-hub.tsx` | "arriving shortly." |

### 9. Dark-mode — no-op

Platform is dark-only per Foundations (`globals.css` line 9: "Dark-only in v1"). No light-mode support required. No changes made.

### New files (0)

### Edited files (10)

| File | Change |
|---|---|
| `components/lite/portal/portal-shell.tsx` | Mobile header padding + logo size + room label visibility |
| `components/lite/portal/menu-bubble.tsx` | Mobile bubble size + overlay padding + section card sizing |
| `components/lite/portal/chat-bubble.tsx` | Mobile position + size |
| `components/lite/portal/chat-home.tsx` | Composer bottom clearance + ambient slots |
| `components/lite/portal/deliverables-header.tsx` | Stacking header + ambient slot |
| `components/lite/portal/deliverables-list.tsx` | Card overflow fix + ambient slot |
| `components/lite/portal/section-placeholder.tsx` | Stacking header + ambient slot |
| `components/lite/portal/section-locked.tsx` | Ambient slot |
| `components/lite/portal/gallery.tsx` | Stacking headers + ambient slot |
| `components/lite/portal/data-export-panel.tsx` | Stacking header + ambient slots |
| `components/lite/portal/bundle-hub.tsx` | Ambient slot on plan-arriving |
| `components/lite/portal/brand-dna-gate.tsx` | Responsive heading |

## Key decisions

1. **`data-ambient-slot` attribute pattern.** Each slot is a data attribute on the text element, not a component wrapper. Wave 20 (SD-*) will use `document.querySelector('[data-ambient-slot="..."]')` or server-side prop injection to swap in generated copy. Current text is the hardcoded fallback. No runtime dependency on the S&D module.

2. **Mobile breakpoint at `sm:` (640px).** All responsive changes use Tailwind's `sm:` breakpoint as the single mobile/desktop threshold. The portal is a focused tool, not a complex dashboard — one breakpoint is sufficient.

3. **Composer clearance on mobile.** Added `pb-20` on mobile to prevent the menu bubble from overlapping the input. On `sm:` and up the bubbles sit in the margin so `pb-6` is fine.

4. **"[Name]'s room" hidden on mobile.** The header is tight on small screens. The logo alone identifies the platform; the possessive room label is supplementary.

## What the next session should know

- **CM-E** is the Referral surface (portal menu item + form + deal creation). Portal shell and menu bubble are now mobile-ready.
- **CM-E2E** is the Playwright E2E for magic link → session cookie → unlocked portal.
- **SD-* sessions** (Wave 20) will consume the `data-ambient-slot` attributes to inject `generateInVoice()` copy. The slot names are listed in the table above — treat them as a contract.
- No migration, no schema changes, no new settings keys.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 209 files, 1782 passed, 0 failures, 1 skipped
- No browser check (portal requires auth + data; responsive changes are structural — validated via class inspection + typecheck)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are CSS class adjustments and data attributes on existing components. Reverting restores previous fixed-width layout.
