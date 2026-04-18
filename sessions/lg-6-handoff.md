# `lg-6` — Warmup ramp enforcement + sender reputation tracking — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (6 of 10)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Warmup enforcement module

**`lib/lead-gen/warmup.ts`** — three exported functions + one exported helper:

- `enforceWarmupCap(db?)` — The ONLY reader/writer of `resend_warmup_state` (§12.I). Computes current week from `started_at` (not manually advanced), maps to the 5→10→15→20→30 ramp, counts actual sends today from `outreach_sends` (authoritative — not the stale `sent_today` column), subtracts pending sequence touches due today (returns 0 until LG-9 wires the sequence scheduler), auto-updates the row when week/cap changes or midnight Melbourne resets. Returns `{ cap, used, remaining, can_send, current_week, is_graduated, days_until_next_ramp, scheduled_sequence_touches_today }`.

- `recordWarmupSend(db?)` — Increments `sent_today` via SQL `+ 1`. Called by the send path after `sendEmail()` succeeds. Single write path for `sent_today`.

- `initWarmupState(db?)` — Seeds the single warmup row on first Lead Gen enablement. Idempotent (no-op if row exists). Setup wizard calls this.

- `getMelbourneDayBounds(nowMs)` — DST-safe Melbourne midnight-to-midnight window computation. Exported for testing.

### 2. Daily search wiring

**`lib/lead-gen/daily-search.ts`** — Step 1 replaced from settings stub to real `enforceWarmupCap()`:

- `effective_cap = min(settings.max_per_day, warmupState.remaining)` — warmup cap is authoritative, settings is the user-configured upper bound.
- `warmupCap` and `effectiveCap` now reflect real warmup state in `lead_runs` summary rows.

### 3. Barrel exports

**`lib/lead-gen/index.ts`** — `enforceWarmupCap`, `recordWarmupSend`, `initWarmupState`, `WarmupCapResult` exported.

## Files created

- `lib/lead-gen/warmup.ts`
- `tests/lead-gen/lg6-warmup.test.ts`

## Files edited

- `lib/lead-gen/daily-search.ts` — step 1 warmup stub replaced, `enforceWarmupCap` import added
- `lib/lead-gen/index.ts` — LG-6 barrel exports added

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Sends counted from `outreach_sends`, not `sent_today` column.** The `sent_today` column on `resend_warmup_state` can drift if the process crashes mid-send. Counting actual `outreach_sends` rows within today's Melbourne day bounds is authoritative. The column is still maintained for observability but isn't the source of truth for cap enforcement.

2. **Scheduled sequence touches query uses `LIKE 'lead_gen_sequence_%'` prefix.** No sequence task types exist yet (LG-9's work). The query naturally returns 0 until LG-9 adds its task types. When it does, any type starting with `lead_gen_sequence_` is automatically counted.

3. **effective_cap = min(settings.max_per_day, warmupState.remaining).** The warmup cap is non-overrideable (spec §10.1), but the user-configured `max_per_day` acts as an independent upper bound. If the warmup allows 10/day but the user sets 5/day, effective is 5.

4. **Week progression computed from `started_at`, not manually advanced.** `current_week = floor((now - started_at) / 7 days) + 1`, capped at 5. No "skip ahead" possible. The row's `current_week` column is updated as a side effect for observability.

5. **Melbourne day bounds via `Intl.DateTimeFormat` — DST-safe.** Same approach as `next3amMelbourneMs` from LG-4. Handles AEST ↔ AEDT transitions correctly.

## Verification (G0–G12)

- **G0** — LG-5 and LG-4 handoffs read. Spec §10, §3.4, §12.I read.
- **G1** — Preconditions verified: `resendWarmupState` schema, `outreachSends` schema, `outreachSequences` schema, `scheduled_tasks` schema, `SUPERBAD_SENDER`, `settings.get`, `db`, `eq`/`and`/`gte`/`lt`/`sql` from drizzle — all present.
- **G2** — Files match LG-6 scope (warmup enforcement + daily search wiring + tests).
- **G3** — No motion work.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Ramp values (5/10/15/20/30) and week count (4) are operational constants per §10.1, not autonomy thresholds.
- **G5** — Context budget held. Small-medium session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 188 test files / 1579 passed + 1 skipped (+23 new), clean production build.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1579 passed.
- **G9** — No browser-testable surface. Library-only session.
- **G10** — Melbourne day bounds: 3 tests (24h window, bounds contain now, consistency). Ramp week computation: 7 tests (weeks 1–5, day 6 edge, 60-day graduated). Cap mapping: 6 tests (each week + graduated). Effective cap: 4 tests (basic, at cap, over cap, negative clamp). Days until ramp: 2 tests (mid-week, graduated null).
- **G10.5** — N/A (standard build session).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`lg_6_sequence_touch_count_wiring`** — `countScheduledSequenceTouchesToday` uses `LIKE 'lead_gen_sequence_%'` prefix match. LG-9 must name its sequence task types with this prefix for accurate effective_cap computation.
- **`lg_6_sent_today_observability_drift`** — `sent_today` column is maintained but not authoritative. If observability tools read it directly (rather than through `enforceWarmupCap`), they'll see stale values after midnight until the next `enforceWarmupCap` call triggers a reset.

## PATCHES_OWED (closed this session)

- **`lg_4_warmup_enforcement_stub`** — `runDailySearch` step 1 now uses real `enforceWarmupCap()` instead of `settings.max_per_day` stub.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Warmup enforcement module
- Daily search wiring (reverts to settings stub)
- Barrel export additions
- Test files

## What the next session (LG-7) inherits

LG-7 is **Lead Gen UI: queue + runs log + metrics panel** — the three-tab admin surface. LG-6 provides:

- **`enforceWarmupCap()`** — the metrics panel warmup progress card (§14.2 panel 4) reads `{ cap, used, current_week, is_graduated, days_until_next_ramp }` directly from this function.
- **Full daily search pipeline with real warmup enforcement** — runs produce accurate `warmup_cap_at_run` and `effective_cap_at_run` values in `lead_runs` for the runs log.
- **`WarmupCapResult` type** — exported for the UI to consume without reaching into the warmup module's internals.
