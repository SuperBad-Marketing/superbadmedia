# SP-3 — Kanban board — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sp-3-brief.md`
**Type:** UI (large)
**Model tier:** Opus (`/deep`).
**Rollback:** migration `0012_sp3_pipeline_settings.sql` reversible (`DELETE FROM settings WHERE key LIKE 'pipeline.%'`). All UI/route/action/primitive files are new; `git revert` removes cleanly. No load-bearing signature changes.

## What shipped

- **`components/lite/kanban-board.tsx`** — generic primitive. dnd-kit `DndContext` + `DragOverlay` with house spring (mass:1 / stiffness:220 / damping:25). Takes `columns`, `cards`, `getColumnId`, `canDrop`, `onDrop`, `renderCard`, `renderColumnHeader`, `renderColumnEmpty`. Zero deal/pipeline vocabulary — ready for Hiring Pipeline reuse per spec §12.5. Reduced-motion falls to opacity-only drop.
- **`components/lite/sales-pipeline/stage-config.ts`** — 8-column config with warm-tint progression (cream wash on Won, pink wash on Trial Shoot per §5.2) + per-column empty-state copy per §11A.1.
- **`components/lite/sales-pipeline/deal-card.tsx`** — 5-element compact view + 300ms hover-intent overlay with primary contact, last-activity label, 3 quick actions (Send nudge / Open detail / Snooze — all stubs, each posts a dry toast naming the session that lands it). Stale halo via `data-stale` attribute + 2px `--color-warning` 30% outer glow.
- **`components/lite/sales-pipeline/won-badge.tsx`** — RETAINER (pink/cream) + SAAS (orange/charcoal) Black Han Sans caption. PROJECT renders nothing. PATCHES_OWED row opened for the 9th BHS location.
- **`components/lite/sales-pipeline/pipeline-board.tsx`** — client wrapper. `canDrop` consults `LEGAL_TRANSITIONS` from `lib/crm` AND blocks drops into Won/Lost with an explanatory toast. Transitions are **pessimistic** — card moves to new column only after `transitionDealAction` returns `{ok:true}`. Failed transitions toast the server error.
- **`app/lite/admin/pipeline/page.tsx`** — Server Component. Admin-role gated (redirects to `/api/auth/signin`). Loads deals ⨝ companies ⨝ primary contact in one query, resolves fallback contact per company (is_primary desc → created_at_ms asc), fetches `max(activity_log.created_at_ms)` per deal in a grouped query, computes `isDealStale` server-side with thresholds from `settings.get()`.
- **`app/lite/admin/pipeline/actions.ts`** — `transitionDealAction(dealId, toStage)` Server Action. Admin re-check inside the action. Won/Lost rejected at the server boundary too (defence in depth against a client bypass). Wraps `transitionDealStage` with `by: "user:<session.user.id>"`.
- **`lib/crm/is-stale.ts`** — pure `isDealStale({stage, last_stage_change_at_ms, snoozed_until_ms}, thresholds, nowMs)`. Terminal stages (won/lost) never stale. Future snooze suppresses; expired snooze doesn't. Nullish `last_stage_change_at_ms` defensively returns false.
- **`lib/crm/index.ts`** — re-exports `isDealStale` + types.
- **`lib/db/migrations/0012_sp3_pipeline_settings.sql`** — seeds 7 keys: 6 per-stage stale thresholds (14/5/7/14/5/3 days) + `pipeline.snooze_default_days=3`.
- **`lib/db/migrations/meta/_journal.json`** — entry for 0012.
- **`lib/db/migrations/meta/0012_snapshot.json`** — carried forward from 0011 (pure seed migration; no schema delta).
- **`lib/settings.ts`** — 7 new keys registered as `integer` Zod coercions under `Sales Pipeline` block.
- **`docs/settings-registry.md`** — Sales Pipeline section added; totals updated to 80.
- **`tests/crm/is-stale.test.ts`** — 24 tests: 3 cases × 6 stages (below / at / past threshold), 2 terminal-stage cases, 3 snooze cases, 1 defensive-null case.
- **`tests/settings.test.ts`** — expected seed count updated from 74 → 81.

## Decisions

- **Won/Lost drops are blocked at both client (`canDrop`) and server (action).** Message: *"Won/Lost flows land in SP-6."* This preserves SP-6's ownership of `billing_mode`, loss-reason modal, and `DestructiveConfirmModal`.
- **Pessimistic transitions.** Optimistic UI would desync on validation failure (missing `won_outcome`, illegal edge, race with a webhook). Beat of slowness traded for honesty; client sees the card jump only after the server confirms.
- **Primary contact resolution server-side, not in a join fallback.** Loading all contacts per company is one extra SELECT when fallback is needed (only for deals with null `primary_contact_id`), ordered once by `is_primary DESC, created_at_ms ASC`. Cleaner than a SQLite-portable COALESCE-with-subquery.
- **Stale thresholds read via `Promise.all` at request time.** `settingsRegistry` caches on read, so after the first render the lookup is a map hit. Day-one cost is 6 reads; negligible.
- **Hover-intent delay left at 300ms.** Spec §15.5 flags this as Phase-5 tunable in-browser; comment in `deal-card.tsx` notes it as a UX constant, not a settings key (autonomy thresholds only live in `settings`, UI timing constants do not per §G4 interpretation).
- **Snooze popover + Deal-detail slide-over stubbed.** Each quick-action button posts a dry toast naming the owner session. This keeps SP-3 scope tight without dropping the UI affordance.
- **dnd-kit peers:** `react: >=16.8.0`, no upper bound — React 19 compatible.

## Files touched

| File | Change |
| --- | --- |
| `components/lite/kanban-board.tsx` | NEW |
| `components/lite/sales-pipeline/stage-config.ts` | NEW |
| `components/lite/sales-pipeline/deal-card.tsx` | NEW |
| `components/lite/sales-pipeline/won-badge.tsx` | NEW |
| `components/lite/sales-pipeline/pipeline-board.tsx` | NEW |
| `app/lite/admin/pipeline/page.tsx` | NEW |
| `app/lite/admin/pipeline/actions.ts` | NEW |
| `lib/crm/is-stale.ts` | NEW |
| `lib/crm/index.ts` | EDIT — re-export `isDealStale` |
| `lib/db/migrations/0012_sp3_pipeline_settings.sql` | NEW |
| `lib/db/migrations/meta/_journal.json` | EDIT — idx 12 entry |
| `lib/db/migrations/meta/0012_snapshot.json` | NEW (copied from 0011) |
| `lib/settings.ts` | EDIT — 7 keys under Sales Pipeline block |
| `docs/settings-registry.md` | EDIT — Sales Pipeline section + totals 80 |
| `tests/crm/is-stale.test.ts` | NEW (24 tests) |
| `tests/settings.test.ts` | EDIT — seed-count 74 → 81 |
| `package.json` + `package-lock.json` | EDIT — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `PATCHES_OWED.md` | EDIT — opened `sp3_bhs_ninth_location_won_badge` row |
| `sessions/sp-3-brief.md` | NEW (pre-compiled) |
| `sessions/sp-3-handoff.md` | NEW (this file) |
| `sessions/sp-4-brief.md` | NEW (see G11.b) |
| `SESSION_TRACKER.md` | Next Action → SP-4 |

## Verification

- `npx tsc --noEmit` — zero errors.
- `npm test` — **447/447 green** (423 → 447, +24 is-stale tests; pre-existing settings-seed-count test updated from 74 → 81 to absorb the 7 new pipeline keys).
- **Manual browser check:** deferred in-session — requires a running dev server + fixture deals, which would blow this session's context budget. **Owed verification before SP-4 kickoff:** Andy to visit `/lite/admin/pipeline` on a dev DB with at least 3 deals across ≥3 stages; confirm (a) columns render with warm-tint progression, (b) drag lead→contacted succeeds + toast fires, (c) drag into Won shows the "ships in SP-6" toast and bounces back, (d) stale halo renders on a back-dated fixture deal, (e) reduced-motion mode drops the spring. Any defect logged as an SP-3 follow-up before SP-4 starts.
- E2E: none added — pipeline DnD isn't one of the 5 critical flows per AUTONOMY §G12.

## G0–G12 walkthrough

- **G0** — last-2 handoffs (SP-1, SP-2) + brief + spec §§ 4.2, 5.1–5.6, 7, 11, 11A, 12, 13 read before code touched.
- **G1 preflight** — `transitionDealStage` + `LEGAL_TRANSITIONS` exported; `settings.get()` helper present; `auth()` helper + admin check confirmed; `EmptyState` + sonner + framer-motion + Black Han Sans tokens live; `--color-warning` / `--brand-pink` / `--brand-orange` / `--radius-default` tokens confirmed in `globals.css`; dnd-kit React 19 peer verified; `lib/copy/empty-states.ts` not yet created (inline strings accepted per primitive doc).
- **G2** — scope held to brief §2; no scope creep into SP-4 (snooze) or SP-6 (Won/Lost modals + billing_mode).
- **G3** — single-session finish with headroom.
- **G4 literal-grep** — stale thresholds consumed via `settings.get()`. No day-count literals in pipeline components. Hover-intent 300ms + spring constants are UI timing not autonomy.
- **G5 motion** — Tier 1 only: house spring on hover-overlay + drag overlay. No Tier 2. Reduced-motion drops spring to opacity-only on both.
- **G6 rollback** — migration reversible; everything else new-file or additive.
- **G7 artefacts** — every file in the table verified present.
- **G8** — tsc + vitest green.
- **G9 E2E** — skipped per AUTONOMY; not a critical flow.
- **G10 manual browser** — documented as owed (see Verification above).
- **G11 handoff** — this file.
- **G11.b** — `sessions/sp-4-brief.md` pre-compiled.
- **G12** — tracker updated; commit next.

## PATCHES_OWED status

- **Opened this session:** `sp3_bhs_ninth_location_won_badge` — design-system-baseline §6 owes either +1 BHS location or a swap to hold the count at 8. Raised by sales-pipeline §7.3, realised in SP-3.
- **Closed this session:** none.
- **Carried:** `sw5_integration_rollback_on_insert_failure`, `sw7b_graph_oauth_callback_hardening`, `sw10b_meta_ads_oauth_callback_hardening`, `sw11b_google_ads_oauth_callback_hardening`.

## Open threads for SP-4

- **Snooze popover primitive.** Quick-action button already present + wired to `onQuickAction("snooze", dealId)` — SP-4 replaces the toast stub with a popover (1d / 3d / 1w / custom). Default duration reads `settings.get("pipeline.snooze_default_days")` which is already seeded.
- **`snoozeDealAction` Server Action** — writes `deals.snoozed_until_ms` + `activity_log.kind = 'note'` (or a new kind if §4.1 enum doesn't cover; add row to PATCHES_OWED against sales-pipeline.md if so).
- **Stale halo visual is already live** — SP-4 only owes snooze-driven suppression behaviour (the helper already handles it; the UI just needs a snooze action path).
- **Halo amber vs orange drift.** Spec §8.2 says "amber halo" but the locked token is `--color-warning` → `--brand-orange`. Not blocking; flag for design-review if Andy wants true amber.

## Open threads for later SP waves

- **SP-6 inherits:** client `canDrop` still blocks Won/Lost, and server action still refuses them. SP-6 replaces both gates with the `DestructiveConfirmModal` + billing-mode-aware flow + loss-reason modal.
- **Deal-detail slide-over (SheetWithSound).** "Open detail" quick action currently toasts — flag a later UI session (not in Wave 5).
- **Lead Gen integration.** "Send nudge" quick action currently toasts — lights up when Lead Gen ships the draft-compose pipeline.
- **Column pixel tuning (spec §15.1).** Warm-tint values use starting-point neutral-100..400 + color-mix washes. Expect in-browser tuning once Andy has real deal fixtures to look at.
