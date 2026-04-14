# SP-4 — Stale-deal snooze affordance — Handoff

**Closed:** 2026-04-14
**Spec:** `docs/specs/sales-pipeline.md` §§ 8.2, 8.3
**Brief:** `sessions/sp-4-brief.md`

## What shipped

- `lib/crm/snooze-deal.ts` — pure helper. Updates `deals.snoozed_until_ms` +
  `updated_at_ms`, inserts `activity_log` row (`kind:"note"`,
  `meta:{kind:"snooze", until_ms, by}`) in one transaction. Rejects past or
  equal-to-now untilMs; rejects unknown deal id.
- `lib/crm/index.ts` — barrel re-exports `snoozeDeal` + `SnoozeDealOpts`.
- `app/lite/admin/pipeline/snooze-action.ts` — `snoozeDealAction(dealId,
  untilMs)` Server Action with admin re-check, future-date re-check, and
  `revalidatePath("/lite/admin/pipeline")`.
- `components/lite/sales-pipeline/snooze-popover.tsx` — Base-UI Popover
  anchored to the Snooze quick-action button. Three presets (1d / 3d / 7d,
  default preset reads `pipeline.snooze_default_days`) + a native custom
  date input (min = tomorrow; sets to 23:59 local). Commits via server
  action → success toast `"Snoozed until {dd Mmm yyyy}."` (Australia/Melbourne).
- `components/lite/sales-pipeline/deal-card.tsx` — `Snooze` QuickAction
  swapped for `<SnoozePopover />`. New props: `onSnoozed(dealId, untilMs)`
  and `snoozeDefaultDays`. `onQuickAction` union narrowed to `"nudge" | "open"`.
- `components/lite/sales-pipeline/pipeline-board.tsx` — new
  `snoozeDefaultDays` prop threaded from page; new `onSnoozed` handler
  drops `is_stale` on the local card immediately (optimistic halo
  suppression; server revalidate confirms).
- `app/lite/admin/pipeline/page.tsx` — loads
  `pipeline.snooze_default_days` via `settings.get()` and passes to
  `PipelineBoard`.
- `tests/crm/snooze-deal.test.ts` — 5 unit tests: happy path (row +
  activity_log assertion), past rejection, equal-to-now rejection, unknown
  deal id rejection with no side effects, overwrite-prior-snooze path
  writes a second activity row.
- `scripts/seed-pipeline.ts` — dev utility that populated 8 cross-stage
  deals (two backdated for stale-halo testing). Written during SP-3
  verification; not part of the app bundle.

## Decisions

- **`activity_log.kind = "note"` + `meta.kind = "snooze"`** per brief §2
  option (a). Smaller footprint than widening the enum; filterable via
  `meta.kind` when needed. No PATCHES_OWED row opened.
- **Custom date input anchors to end-of-day (23:59:59.999) Melbourne
  local.** A user picking "today" would otherwise set an already-expired
  snooze; the pre-commit guard would reject it. End-of-day avoids the
  footgun. Still stored as UTC ms.
- **Presets are hardcoded (1 / 3 / 7 days).** Spec-locked choices, not
  autonomy thresholds. Only the default highlight reads from settings.

## Preconditions verified

- `deals.snoozed_until_ms` column present (SP-1). ✓
- `pipeline.snooze_default_days` seeded = 3 (SP-3). ✓
- House Popover primitive present at `components/ui/popover.tsx`. ✓
- sonner toast wiring live (SP-3). ✓

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — **452/452 green** (+5 new SP-4 tests).
- G4 literal-grep — default-days value pulls from `settings.get()`;
  presets are UX choices per spec brief §2, not autonomy thresholds.
- Manual browser — owed next session. Back-dated fixtures from
  `scripts/seed-pipeline.ts` (Northcote Dental / Preston Plumbing)
  already present; open a stale card → hover → Snooze → 3 days → halo
  drops instantly + toast fires.

## Not shipped (out of scope per brief §3)

- Manual unsnooze UI (time-driven only).
- Bulk snooze.
- `deal_snoozed` / `deal_unsnoozed` enum extension.

## Next session

SP-5 — next session per `BUILD_PLAN.md`.
