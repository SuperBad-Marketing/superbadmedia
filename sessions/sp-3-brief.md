# SP-3 — Kanban board — Brief

**Type:** UI (large)
**Model tier:** Opus (`/deep`) — large UI session, new primitive + new route + DnD integration + motion discipline.
**Spec:** `docs/specs/sales-pipeline.md` §§ 4.2, 5.1–5.6, 7.1–7.2, 11, 11A, 12, 13
**Depends on:** SP-1 (schema + `createDealFromLead`), SP-2 (`transitionDealStage` + `LEGAL_TRANSITIONS`), design system baseline primitives (`AdminShell`, `EmptyState`, `toast`, `MotionProvider`).

## 1. Goal

Ship the live Sales Pipeline Kanban at `/lite/admin/pipeline` — 8 columns, drag-to-transition wired to `transitionDealStage`, Tier 1 motion only, stale halo visual from §8/§5.6 (snooze action is SP-4). The board is the first real admin feature surface; SP-1/SP-2 are plumbing.

## 2. Scope (what ships)

### 2.1 New generic primitive — `components/lite/kanban-board.tsx`

- Generic `<KanbanBoard<Card, Column>>` — takes `columns: Column[]`, `cards: Card[]`, `getColumnId(card)`, `canDrop(card, toColumnId)`, `onDrop(card, toColumnId)`, `renderCard(card)`, `renderColumnHeader(column)`, `emptyStateForColumn(column)`.
- dnd-kit `DndContext` + `SortableContext` per column, custom drop overlay with house spring (mass:1 / stiffness:220 / damping:25).
- Horizontal scroll when viewport < 1600px.
- **Generic-by-construction** per spec §12.5 — no "deal" vocabulary inside the primitive. Hiring Pipeline (future) consumes the same component.
- Accessible: keyboard drag via dnd-kit `KeyboardSensor` defaults. Reduced-motion: drop settles without spring.

### 2.2 Pipeline-specific layer — `components/lite/sales-pipeline/`

- `pipeline-board.tsx` — client component wrapping `<KanbanBoard>` with the 8-stage column config + `canDrop` delegating to a client-side mirror of `LEGAL_TRANSITIONS` (imported from `lib/crm`).
- `deal-card.tsx` — compact 5-element view (company name, title, value w/ `est.` prefix, next action, stale halo). Hover-overlay (desktop only, 300ms intent delay): primary contact + role, last activity "N days ago", quick actions row (Send nudge / Open detail / Snooze — all no-op stubs in SP-3, each posts a dry toast "Ships in {SP-4|SP-5|Lead Gen}").
- `won-badge.tsx` — RETAINER (pink/cream) + SAAS (orange/charcoal), Black Han Sans caption. PROJECT won_outcome renders no badge (spec §5.4 only specifies the two).
- `stage-column-header.tsx` — DM Sans semibold stage label + mono count. Column bg tint per §5.2 starting values from §15.1 (neutral-1..6 + cream wash on Won). Exact tuning deferred.

### 2.3 Route — `app/lite/admin/pipeline/page.tsx`

- Server Component. Reads all non-archived deals JOIN companies + primary contact in one query, plus `lastActivityAtMs` per deal via a correlated subquery on `activity_log`. Passes into `<PipelineBoard>` client component.
- Auth-gated via existing `AdminShell` pattern (admin role only — check `requireAdmin()` or equivalent helper in the codebase during preflight).
- `density-comfort`, single-pane full-bleed, no secondary sidebar.

### 2.4 Server Action — `app/lite/admin/pipeline/actions.ts`

- `transitionDealAction(dealId, toStage)` → thin wrapper around `transitionDealStage(dealId, toStage, { by: "user:admin" })`. Returns `{ ok: true }` or `{ ok: false, error }`.
- Revalidates `/lite/admin/pipeline` on success.
- Client component animates a bounce-back on `ok: false` (card returns to origin column, urgent toast).
- **Won/Lost drops are blocked in SP-3.** `canDrop` returns false if `toStage ∈ {won, lost}`; the client shows a toast *"Won/Lost flows land in SP-6."* This preserves scope against SP-6 (Won/Lost modals + billing_mode + loss-reason modal).

### 2.5 Stale halo (visual only — snooze is SP-4)

- `lib/crm/is-stale.ts` — pure function `isDealStale(deal, thresholds, nowMs)` using per-stage thresholds from `settings.get()`.
- `deal-card.tsx` applies a `data-stale="true"` attribute; CSS adds a 2px amber outer glow at `--color-warning` 30% alpha, Tier 1 spring fade-in.
- `snoozed_until` check: if set and future, halo suppressed.
- **No Snooze popover UI in SP-3.** That's SP-4.

### 2.6 Settings seed — `lib/db/migrations/0012_sp3_pipeline_settings.sql`

Seeds 8 rows into `settings` with defaults per §8.1:
- `pipeline.stale_thresholds.lead_days = 14`
- `pipeline.stale_thresholds.contacted_days = 5`
- `pipeline.stale_thresholds.conversation_days = 7`
- `pipeline.stale_thresholds.trial_shoot_days = 14`
- `pipeline.stale_thresholds.quoted_days = 5`
- `pipeline.stale_thresholds.negotiating_days = 3`
- `pipeline.snooze_default_days = 3`
- (Won / Lost terminal — no threshold row.)

Values read via `settings.get('pipeline.stale_thresholds.<stage>_days')` — no literals in component code (AUTONOMY G4).

### 2.7 Empty states + toasts

- Copy entries added to `lib/copy/empty-states.ts` (or equivalent — verify path in preflight) per spec §11A.1 (6 entries).
- Toast copy strings per §11A.2 live inline in `pipeline-board.tsx` where fired. Sound pairings come from the central `toast()` primitive automatically.
- No S&D easter egg in SP-3 — that's a later dedicated pass.

## 3. Explicitly out of scope

- **SP-4:** snooze popover UI, snooze action wiring.
- **SP-5:** Trial Shoot panel on company profile.
- **SP-6:** Won/Lost drop modals, `billing_mode` field, loss-reason modal, DestructiveConfirmModal primitive, won-card chime-bright sound on webhook-driven Won.
- **SP-7/SP-8:** Stripe + Resend webhook handlers.
- **Deal detail slide-over** (`SheetWithSound`) — "Open detail" quick action is a stub toast in SP-3; slide-over is a later UI session (not in current BUILD_PLAN Wave 5).
- **Multi-contact picker** for bounce rollback — SP-8.
- **Auto-nudge draft via Lead Gen pipeline** — deferred per spec §8.4.
- **Company / contact list pages** — separate spec (Client Management).
- **Pipeline search / filters / analytics** — per spec §14.9–10.

## 4. Dependencies to install (flag per CLAUDE.md)

- **`@dnd-kit/core`** + **`@dnd-kit/sortable`** + **`@dnd-kit/utilities`** — one new npm package family. Reason: spec §5.2 explicitly locks dnd-kit as the DnD library (accessible, React 19 compatible, Framer Motion friendly). No alternative viable for accessible keyboard DnD.

Flag before installing. No other deps needed.

## 5. Preflight (AUTONOMY G1 — verify before any code change)

- `lib/crm/transition-deal-stage.ts` + `LEGAL_TRANSITIONS` exported.
- `lib/crm/index.ts` re-exports.
- `lib/settings.ts` + `settings.get()` helper exists.
- `settings` table present; check shape before adding seed migration.
- `components/lite/admin-shell.tsx` + `empty-state.tsx` + `motion-provider.tsx` present.
- `toast()` primitive location (search for `toast-with-sound` or similar).
- Existing admin auth helper (`requireAdmin()` / middleware gate) — find and use.
- `lib/copy/empty-states.ts` exists or equivalent empty-state bank location.
- Black Han Sans + DM Sans tokens wired.
- Framer Motion `MotionProvider` mounted in root layout.
- No prior dnd-kit install (confirm none).

If any missing, stop and either patch or reroute per §G1.

## 6. Verification gates

- **G4 literal-grep** — stale thresholds consumed via `settings.get()`; no numeric-day literals in pipeline code.
- **G5 motion** — card hover Tier 1 spring only; drag lift/settle house spring only; NO Tier 2 cinematic. Verify reduced-motion falls back to opacity-only.
- **G6 rollback** — migration `0012` reversible (DELETE 8 settings rows); rest is git-revertable (no schema change beyond settings seed).
- **G7 artefacts** — all files in §2 present in repo before handoff.
- **G8 typecheck + tests** — `npx tsc --noEmit` zero errors; `npm test` green.
- **G9 E2E** — optional per AUTONOMY §G12 (pipeline drag isn't one of the 5 critical flows — quote accept / invoice pay / trial shoot booking / portal auth / SaaS signup). Skip unless a single happy-path smoke is trivial to add.
- **G10 manual browser** — drag lead→contacted, conversation→trial_shoot, confirm bounce-back on illegal drop, confirm stale halo on a date-backdated fixture, confirm won/lost drop blocked with toast, confirm reduced-motion mode.
- **G11 handoff** — `sessions/sp-3-handoff.md` with files touched, decisions, SP-4 open threads.
- **G11.b** — pre-compile `sessions/sp-4-brief.md` before commit.
- **G12** — tracker Next Action → SP-4.

## 7. Risks

1. **dnd-kit + Framer Motion drop overlay interaction.** Risk: double-transform/flicker on drop. Mitigation: use dnd-kit's own `DragOverlay` with our spring rather than nesting motion on the draggable child.
2. **Server Action + optimistic UI reconciliation.** Risk: card jumps stage, action fails, bounce-back desyncs with the store. Mitigation: pessimistic transition by default — card animates to new column only after `{ok:true}` returns. Feel: slightly slower but honest.
3. **Hover-intent delay feel.** 300ms may be too slow — spec §15.5 flags this as Phase-5 tunable. Leave 300ms and add a comment pointing at the open question.
4. **Black Han Sans 9th location.** Won badge adds a BHS location the design-system-baseline hasn't formally accepted (spec §7.3 flag). **Action:** add `PATCHES_OWED.md` row requesting baseline §6 update — do NOT touch the baseline spec this session.
5. **Scope drift into SP-4.** Snooze affordance is right there in the hover-overlay quick actions. Stub it with a toast and move on.

## 8. PATCHES_OWED to open

- `sp3_bhs_ninth_location_won_badge` — design-system-baseline §6 owes either +1 BHS location or a swap to hold the count at 8. Flagged in spec §7.3.

## 9. Rollback

- Migration `0012_sp3_pipeline_settings.sql` is a pure INSERT → reversible via `DELETE FROM settings WHERE key LIKE 'pipeline.%'`.
- All UI / route / action / primitive files are new — `git revert` removes them cleanly. No prior file signatures changed on a load-bearing contract.
