# SP-9 — Voice + delight pass on Sales Pipeline (handoff)

**Closed:** 2026-04-14
**Wave:** 5 (CRM spine — final row)
**Brief:** `BUILD_PLAN.md` Wave 5 SP-9 — *Voice + delight (empty states, Tier 2 Won flavour, sprinkle claims per S&D registry)*.

## What shipped

- **Empty-state copy bank** at `lib/copy/empty-states.ts` — 10 entries keyed `pipeline.column.<stage>` + `pipeline.deal_activity_feed` + `pipeline.company_feed_new`. Copy lives here, never inline, per sales-pipeline §11A.1.
- **`stage-config.ts` refactored** to carry `emptyKey: EmptyStateKey` instead of inline `emptyHero`/`emptyMessage`. `getStageEmptyState(column)` resolves against the bank.
- **`useToastWithSound()` hook** at `components/lite/toast-with-sound.tsx` — the locked toast primitive per §11A.2. Wraps sonner; accepts `{ sound?: SoundKey }`; plays via `SoundProvider`. Feature code never calls sound APIs directly.
- **Pipeline toast copy pass** (§11A.2):
  - Stage advance: *"Moved to {stage}."* + `kanban-drop`
  - Won (Stripe-billed): *"{Company} converted. Nice."* + `quote-accepted` (retainer/project) or `subscription-activated` (saas)
  - Won (manual): *"Logged as Won. Hope you invoiced them."* + same sound
  - Lost: *"Marked Lost. Reason saved."* (no sound — muted event)
  - Snooze: *"Snoozed until {date}."* + `kanban-drop`
- **S&D admin egg #3 — "Three Wons in a session"** — client-side session counter on `PipelineBoard`; server-side ≤ once/30-day gate at `app/lite/admin/pipeline/three-wons-egg.ts`. Copy: *"That's three. Either you're crushing it or it's a slow Tuesday."* Registered in `docs/specs/surprise-and-delight.md` admin egg catalogue.
- **New settings key** `pipeline.sd_three_wons_last_fired_ms` (integer, default `0`) — seed migration `0015_sp9_three_wons_egg_setting.sql`, registry totals bumped 83 → 84 (Sales Pipeline 9 → 10).
- **10 new tests** — 5 empty-state bank coverage (all keys, unique copy, spec-canonical copy, cheerleading ban, stage-column resolution) + 5 three-wons gate (fires fresh, cooldown blocks, cooldown elapse re-fires, non-admin refused, unauthenticated refused). **514/514 green**, typecheck clean.

## Sound-key translation

Spec §11A.2 / §11 uses slot names (`chime-bright`, `tick-warm`, `urgent-thud`) that aren't in the 8-locked sound registry. SP-9 maps them via code comments:

| Spec slot | Registry key | Used for |
|---|---|---|
| `chime-bright` | `quote-accepted` / `subscription-activated` | Won (retainer/project vs saas) |
| `tick-warm` | `kanban-drop` | Drag settle, snooze |
| `urgent-thud` | `error` | Bounce, payment-fail (deferred — needs realtime channel) |

Logged as `sp9_sound_registry_name_map` in `PATCHES_OWED.md` for the design-system-baseline revisit to reconcile names.

## Not done (by design)

- **Bounce-rollback toast** (§11A.2 *"{Contact} bounced. Deal rolled back to Lead."* + `urgent-thud`) — requires a server-sent-events / realtime push to Andy's open pipeline tab. SP-8 performs the rollback silently; the activity_log row is the audit trail. Logged as `sp9_bounce_rollback_toast`.
- **`invoice.payment_failed` urgent toast** — same shape, same gate. Logged as `sp9_payment_failed_urgent_toast`.
- **Hidden-egg-fires migration** — three-wons egg currently uses a settings cooldown stamp. When the S&D spec's `hidden_egg_fires` table lands in Phase 5, migrate to a row insert and retire the settings key. Logged as `sp9_three_wons_migrate_to_hidden_egg_fires`.
- **Manual browser verification** for SP-5 + SP-6 + SP-9 still owed (not regressed). Seed via `scripts/seed-pipeline.ts`; walk empty Won column, drag a card into Won (stripe + manual modes), confirm toast copy + sounds (files land later — silent no-op is expected).

## Files touched

- `lib/copy/empty-states.ts` *(new)*
- `lib/settings.ts` — add key
- `lib/db/migrations/0015_sp9_three_wons_egg_setting.sql` *(new)*
- `components/lite/toast-with-sound.tsx` *(new)*
- `components/lite/sales-pipeline/stage-config.ts`
- `components/lite/sales-pipeline/pipeline-board.tsx`
- `components/lite/sales-pipeline/snooze-popover.tsx`
- `app/lite/admin/pipeline/three-wons-egg.ts` *(new)*
- `docs/specs/surprise-and-delight.md` — admin egg #3 added
- `docs/settings-registry.md` — key + totals
- `PATCHES_OWED.md` — four entries opened
- `tests/empty-states.test.ts` *(new)*, `tests/three-wons-egg.test.ts` *(new)*, `tests/settings.test.ts` — count bumps

## Verification (G0–G12)

- G0 preflight: sales-pipeline spec §11A + surprise-and-delight admin catalogue + SP-7/SP-8 handoffs read at session start. `EmptyState`, `SoundProvider`, sonner, settings runtime confirmed in repo.
- G4 settings discipline: new `pipeline.sd_three_wons_last_fired_ms` key routed through `settings.get/set`. `COOLDOWN_MS` + `>= 3` threshold kept as constants (spec-canonical rules, not tunables).
- G10 typecheck: `npx tsc --noEmit` — 0 errors.
- G11 tests: `npm test` — 514/514 green (was 504 at SP-8 close).
- G12 artefacts: every new file listed in "Files touched" verified present before handoff.

## Next

**Wave 5 CRM spine complete.** `BUILD_PLAN.md` routes next to **Wave 6 QB-1** (Quote Builder — schema + scheduled_tasks handler slots). Landing the QB spine lands Puppeteer at QB-3. Pre-session should pick up the two `sp7_*` Stripe metadata contracts (Intro Funnel + Quote Builder Checkout Sessions must stamp `metadata.deal_id` + `metadata.product_type`).
