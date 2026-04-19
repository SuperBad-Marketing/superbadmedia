# `PM-1` — Settings → Display UI — Handoff

**Closed:** 2026-04-19
**Type:** UI (small)
**Model tier:** Sonnet

---

## What was built

### 1. Display settings page (`app/lite/admin/settings/display/page.tsx`)

Server component at `/lite/admin/settings/display`. Admin-only with auth gate. Reads the authenticated user's 6 preference columns from the `user` table and passes them to the client component. Breadcrumb header matches the existing settings page pattern (catalogue, quote-templates).

### 2. Display settings client component (`app/lite/admin/settings/display/display-settings.tsx`)

6-control preferences panel:
- **Motion** — RadioGroup: Full / Reduced / Off
- **Sounds** — Switch toggle
- **Density** — RadioGroup: Comfortable / Compact
- **Text size** — RadioGroup: Standard / Large
- **Theme** — RadioGroup: Standard / Late Shift / Quiet Hours
- **Typeface** — RadioGroup: House / Long Read / Dispatch

Each control fires a server action on change via `useTransition`. Changes persist immediately to the `user` table and trigger a `revalidatePath`.

### 3. Server actions (`app/lite/admin/settings/display/actions.ts`)

6 server actions, one per preference axis. Each: authenticates the user, validates the incoming value against the design-tokens enum, updates the `user` table via Drizzle, and revalidates the page.

### 4. User schema enum alignment (`lib/db/schema/user.ts`)

Fixed enum drift between the A2 design-tokens and the A5 user schema:
- `density_preference`: `["compact","comfortable","spacious"]` → `["comfort","compact"]`, default `"comfortable"` → `"comfort"`
- `text_size_preference`: `["small","default","large"]` → `["standard","large"]`, default `"default"` → `"standard"`
- `theme_preset`: default `"base-nova"` → `"standard"`
- `typeface_preset`: default `"default"` → `"house"`

SQLite doesn't enforce text enums, so no SQL migration needed — this is purely a TypeScript type fix. Seed scripts (`seed-sb6b-e2e.ts`, `seed-sb7-e2e.ts`) updated to match.

### New files (4)

| File | Purpose |
|---|---|
| `app/lite/admin/settings/display/page.tsx` | Server page — auth + user read + header |
| `app/lite/admin/settings/display/display-settings.tsx` | Client component — 6 controls |
| `app/lite/admin/settings/display/actions.ts` | 6 server actions for preference updates |
| `tests/pm1-display-settings.test.ts` | 6 structural + enum consistency tests |

### Edited files (3)

| File | Change |
|---|---|
| `lib/db/schema/user.ts` | Aligned density/text_size enums and theme/typeface defaults to design-tokens |
| `scripts/seed-sb6b-e2e.ts` | Updated seed values to match new enums |
| `scripts/seed-sb7-e2e.ts` | Updated seed values to match new enums |

## Key decisions

1. **Enum alignment over migration.** The A5 user schema had drifted from A2 design-tokens (different enum values for density and text_size, different defaults for theme and typeface). Fixed the schema TypeScript types to match design-tokens since those drive CSS. No SQL migration needed — SQLite stores text, not enforced enums.

2. **Existing dev user rows have stale values.** Any `user` row created before this session stores the old enum values ("comfortable", "default", "base-nova"). The UI shows no selection for those controls until the user clicks one. Fresh rows use the correct defaults. This is dev-only data; production will never have the old values.

3. **No nav link added.** The Settings nav item points to `/lite/admin/settings/catalogue`. Adding a sub-nav or tabbed settings layout is a PM-2 or future session concern. The display page is reachable by direct URL.

## What the next session should know

- **Theme/typeface controls don't yet update the `<html>` class list in real-time.** The server actions write to the `user` table, but the root layout still reads from the cookie-based `getActivePresets()`. A future session should wire `getActivePresets()` to read from the user table when authenticated, falling back to cookies for logged-out visitors. The `lib/presets.ts` file documents this migration path.
- **No sub-navigation between settings pages.** Catalogue, Quote Templates, and Display are all under `/lite/admin/settings/` but there's no tabbed or sidebar nav to switch between them. Future PM or polish session.
- **Pre-existing test failure:** `tests/brand-dna-card.test.ts` (7 tests) fails due to the untracked `lib/brand-dna/question-bank.ts` file — unrelated to this session.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates and unrelated `resolveQuestionText` import)
- `npm test` — 216 files, 1818 passed, 0 new failures (brand-dna-card failure is pre-existing)
- Browser: all 6 controls render, Motion + Density + Text Size persist on click + reload

## Rollback strategy

**Git-revertable.** No schema migrations, no new tables, no settings keys. The user schema enum change is cosmetic (TypeScript only, no SQL). Pure UI addition — 4 new files + 3 edited files.
