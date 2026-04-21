# SD-7 Handoff — Surprise & Delight: Kill Switch + Egg Orchestration Layer

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### Kill switch — authenticated ("No tricks" toggle)

`app/lite/admin/settings/display/display-settings.tsx`:
- Added "No tricks" `SettingRow` with Switch control at bottom of Display settings
- Toggle is inverted: switch ON = tricks disabled, switch OFF = tricks enabled (matches "No tricks" label)
- Description: "Turns off hidden eggs and surprises. The ambient voice stays."

`app/lite/admin/settings/display/actions.ts`:
- Added `updateTricksEnabled` server action — writes `hidden_egg_tricks_enabled` boolean to user row

`app/lite/admin/settings/display/page.tsx`:
- Reads `hidden_egg_tricks_enabled` from user row, passes as `tricksEnabled` prop

### Kill switch — public ("No tricks" footer link)

`components/no-tricks-link.tsx`:
- Client component button reading `tricks_disabled` cookie
- Toggles between "no tricks" (enabled state) and "tricks on" (disabled state)
- Styled with brand micro label typography, hover dim effect

`app/api/no-tricks/route.ts`:
- Public POST endpoint — sets or clears `tricks_disabled` cookie (1-year TTL, httpOnly: false, sameSite: lax)
- No auth required — public visitors use this

`app/ComingSoon.tsx`:
- Integrated `NoTricksLink` in footer, separated from email by `·` divider

### Admin egg orchestration layer

`lib/eggs/orchestrate-admin.ts`:
- `orchestrateAdminEggs(userId)` — called on admin session load
- Checks global `surprise.hidden_eggs_enabled` setting, user's `hidden_egg_tricks_enabled`, cadence window
- Iterates admin egg candidates (CRT turn-off, milestone spotter), evaluates triggers sequentially
- Fires at most one egg per evaluation, writes to `hidden_egg_fires` via `fireEgg()`
- Three Wons is event-driven (inline on 3rd Won), not session-load — skipped here

`app/api/lite/eggs/evaluate/route.ts`:
- POST endpoint, admin-only auth gate
- Calls `orchestrateAdminEggs()`, returns result as JSON

`lib/eggs/use-admin-eggs.ts`:
- Client hook — fires POST to `/api/lite/eggs/evaluate` once on mount
- Returns `{ eggId, evidence }` if an egg fires, null otherwise
- Silent failure — eggs are non-critical

`components/lite/admin-egg-orchestrator.tsx`:
- Mounts in admin layout, uses `useAdminEggs()` hook
- On fire, dispatches `admin-egg-fired` CustomEvent on `window`
- Egg rendering handled by dedicated components listening for the event

`app/lite/admin/layout.tsx`:
- Added `<AdminEggOrchestrator />` alongside existing `<AdminEventToasts />`

`lib/eggs/index.ts`:
- Re-exports `orchestrateAdminEggs` and `OrchestrateAdminResult`

## New files

- `app/api/no-tricks/route.ts`
- `app/api/lite/eggs/evaluate/route.ts`
- `components/no-tricks-link.tsx`
- `components/lite/admin-egg-orchestrator.tsx`
- `lib/eggs/orchestrate-admin.ts`
- `lib/eggs/use-admin-eggs.ts`
- `tests/sd7-kill-switch-orchestration.test.ts`

## Edited files

- `app/ComingSoon.tsx` — NoTricksLink in footer
- `app/lite/admin/layout.tsx` — AdminEggOrchestrator
- `app/lite/admin/settings/display/actions.ts` — updateTricksEnabled action
- `app/lite/admin/settings/display/display-settings.tsx` — No tricks toggle row
- `app/lite/admin/settings/display/page.tsx` — reads hidden_egg_tricks_enabled
- `lib/eggs/index.ts` — re-exports orchestration

## Verification

- `npx tsc --noEmit` — zero new errors (2 pre-existing in hp19 test file)
- `npx vitest run` — 265 files, 2583 passed, 1 skipped (8 new tests)
- Browser: public "no tricks" button renders in Coming Soon footer, admin "No tricks" toggle renders in Settings > Display

## Rollback

- All new files additive; git-revertable
- Settings display edits are backward-compatible (new row only)
- No schema changes, no new settings keys consumed (uses existing `surprise.hidden_eggs_enabled` + user column `hidden_egg_tricks_enabled` from SD-1)

## Key decisions

- **Egg orchestration evaluates sequentially, not in parallel** — admin eggs are rare (2 candidates max), and sequential evaluation means the first match wins cleanly without race conditions
- **CustomEvent dispatch pattern for egg rendering** — the orchestrator fires a `window` event; dedicated egg renderers (CRT overlay, milestone notification) listen independently. Decouples detection from presentation.
- **Public kill switch is cookie-based, not localStorage** — cookie is readable server-side if we ever need to suppress eggs during SSR. httpOnly: false so the client can read it too.
- **Three Wons egg excluded from session-load orchestration** — it's event-driven (fires inline on the 3rd Won in the pipeline board), not ambient. The orchestrator only handles session-load triggers.

## Next session should know

- **SD-8+** continues the S&D build. Egg rendering components (CRT overlay, milestone notification card) are not yet built — the orchestrator detects and fires, but visual presentation is downstream.
- **The `admin-egg-fired` CustomEvent is the contract** — any component that wants to react to an admin egg listens for it on `window` with `detail: { eggId, evidence }`.
- **No eggs will fire in dev** because trigger conditions (3 late nights, milestone in notes, 3 Wons) require real activity data that doesn't exist in the dev DB.
