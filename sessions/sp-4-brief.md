# SP-4 — Stale-deal halo + snooze affordance — Brief

**Type:** UI (small)
**Model tier:** Sonnet (/normal) — small UI session, snooze popover + one server action + halo already live from SP-3.
**Spec:** `docs/specs/sales-pipeline.md` §§ 8.2, 8.3
**Depends on:** SP-3 (card component, halo already rendering via `is_stale`, quick-action wiring stub).

## 1. Goal

Replace the SP-3 snooze toast stub with a real popover (1d / 3d / 1w / custom), wire a `snoozeDealAction` server action, and make sure `snoozed_until_ms` flows back into the board so the halo suppresses correctly.

## 2. Scope

- **`components/lite/sales-pipeline/snooze-popover.tsx`** — Radix `Popover` anchored to the Snooze quick-action button. Four presets (1 / 3 / 7 days from now; default 3 reads `settings.get("pipeline.snooze_default_days")`) plus a custom date-picker input. Click commits via the server action. Close on commit + toast *"Snoozed until {date}."* with `tick-warm` sound via sonner `success`.
- **`app/lite/admin/pipeline/snooze-action.ts`** — `snoozeDealAction(dealId, untilMs)` Server Action: admin re-check, write `deals.snoozed_until_ms = untilMs` + `deals.updated_at_ms`, insert `activity_log.kind = 'note'` with `body: "Snoozed until {date}."` + `meta: {kind: "snooze", until_ms}`. Revalidate `/lite/admin/pipeline`.
- **Wire-through in `pipeline-board.tsx`**: replace the `onQuickAction("snooze", id)` toast stub with an anchor-state pattern — clicking the button opens the popover inside the card. Needs a small refactor so the card exposes the button's ref, or the popover lives in the card itself.
- **Spec-locked activity kind.** `sales-pipeline.md §4.1` `activity_log.kind` enum has no `snooze`/`unsnooze` values. Options: (a) use `'note'` with `meta.kind = "snooze"`; (b) patch the enum to add `deal_snoozed` / `deal_unsnoozed`. **Recommendation (a)** — smaller footprint, spec note can reference it; log as PATCHES_OWED if consensus lands on (b).

## 3. Out of scope

- Unsnooze UI (expiry is time-driven; manual unsnooze isn't in the spec).
- Bulk snooze.
- Notification-on-unsnooze. Stale halo returns on next page render ≥ `snoozed_until_ms`; that's enough.

## 4. Preflight

- `deals.snoozed_until_ms` column exists (SP-1 shipped it).
- `pipeline.snooze_default_days` seeded (SP-3 shipped it).
- Radix Popover primitive present (check `components/ui/` — otherwise install `@radix-ui/react-popover`, flag the install).
- sonner + `tick-warm` / success icon mapping already live (SP-3 dependency).

## 5. Verification

- `npx tsc --noEmit` clean; `npm test` green.
- Unit test: `snoozeDealAction` writes `snoozed_until_ms` + activity row (or extend the existing CRM test suite).
- Manual browser: back-date a deal's `last_stage_change_at_ms`, confirm halo; open Snooze popover, pick 3d, confirm halo disappears immediately and toast fires; verify activity_log row via DB query.

## 6. Risks

- **Popover interaction with DnD.** Make sure the popover doesn't swallow the dnd-kit pointer sensor. Isolate via `onPointerDown={e => e.stopPropagation()}` on the trigger (already done on the quick-action button in SP-3).
- **Time-zone rendering.** Display snooze date in Australia/Melbourne (match `errors/page.tsx` formatter). Store UTC ms.
